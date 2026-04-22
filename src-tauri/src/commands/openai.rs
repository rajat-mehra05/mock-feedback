use crate::error::AppError;
use crate::openai::client::OPENAI_BASE_URL;
use crate::secrets::read_key;
use crate::AppState;
use bytes::Bytes;
use futures_util::StreamExt;
use reqwest::header::{AUTHORIZATION, CONTENT_TYPE};
use serde::{Deserialize, Serialize};
use serde_json::json;
use tauri::{ipc::Channel, State};
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

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TranscribeArgs {
    pub request_id: String,
    pub model: String,
    pub filename: String,
    pub content_type: String,
    pub audio: Vec<u8>,
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

#[derive(Debug, Clone, Serialize)]
#[serde(tag = "kind", rename_all = "snake_case")]
pub enum TtsEvent {
    Chunk { bytes: Vec<u8> },
    Done,
    Error { message: String },
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

    // `json!` with `Option::None` emits JSON `null`, which OpenAI rejects for
    // `temperature` / `max_tokens`. Build the body manually and only insert
    // optional fields when they're `Some`.
    let mut body = serde_json::Map::new();
    body.insert("model".into(), serde_json::Value::String(args.request.model.clone()));
    body.insert(
        "messages".into(),
        serde_json::Value::Array(
            args.request
                .messages
                .iter()
                .map(|m| json!({ "role": m.role, "content": m.content }))
                .collect(),
        ),
    );
    if let Some(t) = args.request.temperature {
        body.insert("temperature".into(), json!(t));
    }
    if let Some(n) = args.request.max_tokens {
        body.insert("max_tokens".into(), json!(n));
    }
    let body = serde_json::Value::Object(body);

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

#[tauri::command]
pub async fn openai_transcribe(
    args: TranscribeArgs,
    state: State<'_, AppState>,
) -> Result<String, AppError> {
    let key = api_key()?;
    let token = register_token(&state, &args.request_id);
    let client = state.http.clone();

    let part = reqwest::multipart::Part::bytes(args.audio)
        .file_name(args.filename.clone())
        .mime_str(&args.content_type)
        .map_err(|e| AppError::other(e.to_string()))?;
    let form = reqwest::multipart::Form::new()
        .text("model", args.model)
        .part("file", part);

    let request = client
        .post(format!("{OPENAI_BASE_URL}/audio/transcriptions"))
        .header(AUTHORIZATION, format!("Bearer {key}"))
        .multipart(form);

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
    let text = body
        .get("text")
        .and_then(|t| t.as_str())
        .ok_or_else(|| AppError::other("empty transcription response"))?;
    Ok(text.to_string())
}

#[tauri::command]
pub async fn openai_tts(
    args: TtsArgs,
    channel: Channel<TtsEvent>,
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
                let _ = channel.send(TtsEvent::Error { message: "cancelled".into() });
                return Err(AppError::Aborted { message: "cancelled".into() });
            }
            next = stream.next() => {
                match next {
                    Some(Ok(bytes)) => {
                        let bytes: Bytes = bytes;
                        // Send as Vec<u8>; cost is a clone but the API is simpler and
                        // audio chunks are modest in size.
                        if channel.send(TtsEvent::Chunk { bytes: bytes.to_vec() }).is_err() {
                            // Renderer side dropped the channel — treat as cancel.
                            drop_token(&state, &args.request_id);
                            return Err(AppError::Aborted { message: "renderer dropped channel".into() });
                        }
                    }
                    Some(Err(e)) => {
                        drop_token(&state, &args.request_id);
                        let msg = e.to_string();
                        let _ = channel.send(TtsEvent::Error { message: msg.clone() });
                        return Err(AppError::Network { message: msg });
                    }
                    None => break,
                }
            }
        }
    }

    drop_token(&state, &args.request_id);
    let _ = channel.send(TtsEvent::Done);
    Ok(())
}

#[tauri::command]
pub fn cancel_request(request_id: String, state: State<'_, AppState>) {
    if let Some(token) = state.cancel_tokens.lock().remove(&request_id) {
        token.cancel();
    }
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
