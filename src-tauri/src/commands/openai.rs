use crate::error::AppError;
use crate::openai::client::OPENAI_BASE_URL;
use crate::secrets::read_key;
use crate::AppState;
use futures_util::StreamExt;
use reqwest::header::{AUTHORIZATION, CONTENT_TYPE};
use serde::{Deserialize, Serialize};
use serde_json::json;
use tauri::{
    ipc::{Channel, InvokeBody, InvokeResponseBody, Request},
    State,
};
use tokio_util::sync::CancellationToken;

// --- Request / response shapes shared with the frontend ---

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ChatMessage {
    pub role: String,
    pub content: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ChatRequestBody {
    pub model: String,
    pub messages: Vec<ChatMessage>,
    pub temperature: Option<f32>,
    pub max_tokens: Option<u32>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ChatArgs {
    pub request_id: String,
    pub request: ChatRequestBody,
}

/// Delta events sent over the frontend channel during streaming chat.
///
/// Tauri's `Channel<T>` serialises each message with serde, so the JS side
/// receives one of these three variants per callback invocation.
#[derive(Debug, Clone, Serialize)]
#[serde(tag = "kind", rename_all = "snake_case")]
pub enum ChatDelta {
    Content { text: String },
    Done,
    Error { message: String },
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TtsRequestBody {
    pub model: String,
    pub voice: String,
    pub input: String,
    pub instructions: Option<String>,
    pub response_format: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TtsArgs {
    pub request_id: String,
    pub request: TtsRequestBody,
}

// --- Cancellation token management ---

fn register_token(state: &AppState, id: &str) -> CancellationToken {
    let token = CancellationToken::new();
    state
        .cancel_tokens
        .lock()
        .insert(id.to_string(), token.clone());
    token
}

fn drop_token(state: &AppState, id: &str) {
    state.cancel_tokens.lock().remove(id);
}

fn api_key() -> Result<String, AppError> {
    read_key().map_err(AppError::from)?.ok_or_else(AppError::missing_key)
}

// --- Commands ---

#[tauri::command]
pub async fn openai_chat(args: ChatArgs, state: State<'_, AppState>) -> Result<String, AppError> {
    let key = api_key()?;
    let token = register_token(&state, &args.request_id);
    let client = state.http.clone();

    let body = build_chat_body(&args.request, false);

    let request = client
        .post(format!("{OPENAI_BASE_URL}/chat/completions"))
        .header(AUTHORIZATION, format!("Bearer {key}"))
        .header(CONTENT_TYPE, "application/json")
        .json(&body);

    let result = tokio::select! {
        _ = token.cancelled() => return Err(AppError::Aborted { message: "cancelled".into() }),
        res = request.send() => res,
    };

    drop_token(&state, &args.request_id);

    let response = result?;
    let status = response.status();
    if !status.is_success() {
        let text = response.text().await.unwrap_or_default();
        return Err(classify_status(status.as_u16(), text));
    }

    let body: serde_json::Value = response.json().await?;
    let content = body
        .get("choices")
        .and_then(|c| c.get(0))
        .and_then(|c| c.get("message"))
        .and_then(|m| m.get("content"))
        .and_then(|c| c.as_str())
        .ok_or_else(|| AppError::other("empty response from chat"))?;
    Ok(content.to_string())
}

/// Phase 9.1: stream chat completions token-by-token so the frontend can hand
/// each completed sentence to TTS before the full response finishes. The wire
/// format is OpenAI's SSE stream — line-buffered events separated by `\n\n`,
/// each carrying a `data: {...}` JSON payload (or the literal `[DONE]`).
#[tauri::command]
pub async fn openai_chat_stream(
    args: ChatArgs,
    channel: Channel<ChatDelta>,
    state: State<'_, AppState>,
) -> Result<(), AppError> {
    let key = api_key()?;
    let token = register_token(&state, &args.request_id);
    let client = state.http.clone();

    let body = build_chat_body(&args.request, true);

    let request = client
        .post(format!("{OPENAI_BASE_URL}/chat/completions"))
        .header(AUTHORIZATION, format!("Bearer {key}"))
        .header(CONTENT_TYPE, "application/json")
        .json(&body);

    let response = tokio::select! {
        _ = token.cancelled() => {
            drop_token(&state, &args.request_id);
            return Err(AppError::Aborted { message: "cancelled".into() });
        }
        res = request.send() => res?,
    };

    let status = response.status();
    if !status.is_success() {
        drop_token(&state, &args.request_id);
        let text = response.text().await.unwrap_or_default();
        return Err(classify_status(status.as_u16(), text));
    }

    let mut stream = response.bytes_stream();
    // Byte buffer, not String — a multi-byte UTF-8 codepoint (em-dash, emoji,
    // smart quotes) can split across chunks. Searching for `\n\n` as ASCII
    // bytes is safe regardless, and each complete SSE event is guaranteed to
    // be valid UTF-8 because OpenAI's JSON payloads are.
    let mut buffer: Vec<u8> = Vec::new();

    loop {
        tokio::select! {
            _ = token.cancelled() => {
                drop_token(&state, &args.request_id);
                let _ = channel.send(ChatDelta::Error { message: "cancelled".into() });
                return Err(AppError::Aborted { message: "cancelled".into() });
            }
            next = stream.next() => {
                match next {
                    Some(Ok(bytes)) => {
                        buffer.extend_from_slice(&bytes);

                        // Drain complete SSE events (blank-line terminated).
                        while let Some(sep) = find_event_boundary(&buffer) {
                            let event_bytes: Vec<u8> = buffer.drain(..sep + 2).collect();
                            let Ok(event) = std::str::from_utf8(&event_bytes[..sep]) else {
                                // A validly-framed SSE event with non-UTF-8 payload would be
                                // an OpenAI contract violation. Skip and continue rather than
                                // tearing the whole turn down.
                                continue;
                            };
                            for line in event.lines() {
                                let Some(data) = line.strip_prefix("data: ") else { continue };
                                if data == "[DONE]" { continue }
                                let Ok(parsed) = serde_json::from_str::<serde_json::Value>(data)
                                else { continue };
                                let Some(content) = parsed
                                    .get("choices")
                                    .and_then(|c| c.get(0))
                                    .and_then(|c| c.get("delta"))
                                    .and_then(|d| d.get("content"))
                                    .and_then(|s| s.as_str())
                                else { continue };
                                // OpenAI's first delta is a role marker with empty content.
                                // Forwarding it would trip the frontend's first_token perf
                                // mark before any real text arrives.
                                if content.is_empty() { continue }
                                if channel
                                    .send(ChatDelta::Content { text: content.into() })
                                    .is_err()
                                {
                                    drop_token(&state, &args.request_id);
                                    return Err(AppError::Aborted {
                                        message: "renderer dropped channel".into(),
                                    });
                                }
                            }
                        }
                    }
                    Some(Err(e)) => {
                        drop_token(&state, &args.request_id);
                        let msg = e.to_string();
                        let _ = channel.send(ChatDelta::Error { message: msg.clone() });
                        return Err(AppError::Network { message: msg });
                    }
                    None => break,
                }
            }
        }
    }

    drop_token(&state, &args.request_id);
    let _ = channel.send(ChatDelta::Done);
    Ok(())
}

#[tauri::command]
pub async fn openai_transcribe(
    request: Request<'_>,
    state: State<'_, AppState>,
) -> Result<String, AppError> {
    // Metadata travels in headers so the audio body is transported as raw
    // bytes (InvokeBody::Raw). JSON-wrapped number[] costs ~4x the bytes and
    // adds 50-100ms of serialisation on a 1MB upload.
    let header = |name: &str| -> Result<String, AppError> {
        request
            .headers()
            .get(name)
            .and_then(|v| v.to_str().ok())
            .map(String::from)
            .ok_or_else(|| AppError::other(format!("missing or invalid header: {name}")))
    };
    let request_id = header("x-request-id")?;
    let model = header("x-model")?;
    let filename = header("x-filename")?;
    let content_type = header("x-content-type")?;
    let audio = match request.body() {
        InvokeBody::Raw(bytes) => bytes.clone(),
        InvokeBody::Json(_) => {
            return Err(AppError::other(
                "openai_transcribe requires a raw binary body",
            ))
        }
    };

    let key = api_key()?;
    let token = register_token(&state, &request_id);
    let client = state.http.clone();

    let part = reqwest::multipart::Part::bytes(audio)
        .file_name(filename)
        .mime_str(&content_type)
        .map_err(|e| AppError::other(e.to_string()))?;
    let form = reqwest::multipart::Form::new()
        .text("model", model)
        .part("file", part);

    let http_request = client
        .post(format!("{OPENAI_BASE_URL}/audio/transcriptions"))
        .header(AUTHORIZATION, format!("Bearer {key}"))
        .multipart(form);

    let result = tokio::select! {
        _ = token.cancelled() => return Err(AppError::Aborted { message: "cancelled".into() }),
        res = http_request.send() => res,
    };

    drop_token(&state, &request_id);

    let response = result?;
    let status = response.status();
    if !status.is_success() {
        let text = response.text().await.unwrap_or_default();
        return Err(classify_status(status.as_u16(), text));
    }

    let body: serde_json::Value = response.json().await?;
    let text = body
        .get("text")
        .and_then(|t| t.as_str())
        .ok_or_else(|| AppError::other("empty transcription response"))?;
    Ok(text.to_string())
}

#[tauri::command]
pub async fn openai_tts(
    args: TtsArgs,
    channel: Channel<InvokeResponseBody>,
    state: State<'_, AppState>,
) -> Result<(), AppError> {
    let key = api_key()?;
    let token = register_token(&state, &args.request_id);
    let client = state.http.clone();

    let mut body = serde_json::Map::new();
    body.insert("model".into(), serde_json::Value::String(args.request.model.clone()));
    body.insert("voice".into(), serde_json::Value::String(args.request.voice.clone()));
    body.insert("input".into(), serde_json::Value::String(args.request.input.clone()));
    if let Some(ref instructions) = args.request.instructions {
        body.insert("instructions".into(), serde_json::Value::String(instructions.clone()));
    }
    body.insert(
        "response_format".into(),
        serde_json::Value::String(
            args.request.response_format.clone().unwrap_or_else(|| "mp3".into()),
        ),
    );
    let body = serde_json::Value::Object(body);

    let request = client
        .post(format!("{OPENAI_BASE_URL}/audio/speech"))
        .header(AUTHORIZATION, format!("Bearer {key}"))
        .header(CONTENT_TYPE, "application/json")
        .json(&body);

    let response = tokio::select! {
        _ = token.cancelled() => {
            drop_token(&state, &args.request_id);
            return Err(AppError::Aborted { message: "cancelled".into() });
        }
        res = request.send() => res?,
    };

    let status = response.status();
    if !status.is_success() {
        drop_token(&state, &args.request_id);
        let text = response.text().await.unwrap_or_default();
        return Err(classify_status(status.as_u16(), text));
    }

    let mut stream = response.bytes_stream();
    loop {
        tokio::select! {
            _ = token.cancelled() => {
                drop_token(&state, &args.request_id);
                let _ = channel.send(control_event(json!({ "kind": "error", "message": "cancelled" })));
                return Err(AppError::Aborted { message: "cancelled".into() });
            }
            next = stream.next() => {
                match next {
                    Some(Ok(bytes)) => {
                        // Raw bytes travel as InvokeResponseBody::Raw, which the
                        // JS channel callback receives as an ArrayBuffer. The
                        // alternative (serde-serialised Vec<u8>) expands to a
                        // JSON number[] and costs ~50ms across a full TTS
                        // response.
                        if channel.send(InvokeResponseBody::Raw(bytes.to_vec())).is_err() {
                            drop_token(&state, &args.request_id);
                            return Err(AppError::Aborted { message: "renderer dropped channel".into() });
                        }
                    }
                    Some(Err(e)) => {
                        drop_token(&state, &args.request_id);
                        let msg = e.to_string();
                        let _ = channel.send(control_event(json!({ "kind": "error", "message": msg.clone() })));
                        return Err(AppError::Network { message: msg });
                    }
                    None => break,
                }
            }
        }
    }

    drop_token(&state, &args.request_id);
    let _ = channel.send(control_event(json!({ "kind": "done" })));
    Ok(())
}

fn control_event(value: serde_json::Value) -> InvokeResponseBody {
    // `to_string` on a known-valid JSON value can't fail; default keeps the
    // signature infallible at the call site.
    InvokeResponseBody::Json(serde_json::to_string(&value).unwrap_or_default())
}

#[tauri::command]
pub fn cancel_request(request_id: String, state: State<'_, AppState>) {
    if let Some(token) = state.cancel_tokens.lock().remove(&request_id) {
        token.cancel();
    }
}

/// Shared between `openai_chat` and `openai_chat_stream`. `serde_json`'s default
/// behaviour with `Option::None` is to emit JSON `null`, which OpenAI rejects
/// for `temperature` / `max_tokens`, so we build the body by hand and only
/// insert the optionals when present.
fn build_chat_body(request: &ChatRequestBody, stream: bool) -> serde_json::Value {
    let mut body = serde_json::Map::new();
    body.insert("model".into(), serde_json::Value::String(request.model.clone()));
    if stream {
        body.insert("stream".into(), serde_json::Value::Bool(true));
    }
    body.insert(
        "messages".into(),
        serde_json::Value::Array(
            request
                .messages
                .iter()
                .map(|m| json!({ "role": m.role, "content": m.content }))
                .collect(),
        ),
    );
    if let Some(t) = request.temperature {
        body.insert("temperature".into(), json!(t));
    }
    if let Some(n) = request.max_tokens {
        body.insert("max_tokens".into(), json!(n));
    }
    serde_json::Value::Object(body)
}

/// SSE events are terminated by a blank line (`\n\n`). We search at the byte
/// level because `bytes_stream()` chunks may split multi-byte UTF-8 codepoints
/// mid-character; the separators themselves are ASCII so this is safe.
fn find_event_boundary(buf: &[u8]) -> Option<usize> {
    buf.windows(2).position(|w| w == b"\n\n")
}

fn classify_status(status: u16, body: String) -> AppError {
    let message = if body.is_empty() {
        format!("upstream status {status}")
    } else {
        body
    };
    match status {
        401 => AppError::Auth { message, status },
        404 => AppError::NotFound { message, status },
        429 => {
            let is_quota = message.to_lowercase().contains("quota")
                || message.to_lowercase().contains("billing");
            if is_quota {
                AppError::Quota { message, status }
            } else {
                AppError::RateLimit { message, status }
            }
        }
        _ => AppError::Upstream { message, status },
    }
}
