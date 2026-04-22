use crate::error::AppError;
use crate::openai::client::OPENAI_BASE_URL;
use crate::secrets::read_key;
use crate::{AppState, TranscribeBuffer};
use futures_util::StreamExt;
use reqwest::header::{AUTHORIZATION, CONTENT_TYPE};
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::time::Instant;
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
                        while let Some((pos, sep_len)) = find_event_boundary(&buffer) {
                            let event_bytes: Vec<u8> = buffer.drain(..pos + sep_len).collect();
                            let Ok(event) = std::str::from_utf8(&event_bytes[..pos]) else {
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

// --- Phase 9.2: streamed mic chunks ---
//
// The recorder hands raw MediaRecorder chunks to Rust during the user's turn,
// keyed by the request id it will later commit. Eliminates the JS → Rust IPC
// transit of the full blob after mic-stop (~50-150ms for a 1MB recording on
// Tauri's binary IPC) and moves `transcribe_start` in the perf log from
// "after mic_stop" to "during recording".

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TranscribeCommitArgs {
    pub request_id: String,
    pub model: String,
    pub filename: String,
    pub content_type: String,
    /// Phase 9.3: when set, the buffered bytes are treated as raw 16-bit
    /// little-endian mono PCM captured at this rate, and the command
    /// prepends a WAV header before uploading so OpenAI gets a valid file.
    /// Omitted for the (pre-9.3) "buffer already contains a self-contained
    /// container format like webm/mp4" path.
    #[serde(default)]
    pub sample_rate: Option<u32>,
}

/// Hard cap per request so a stuck / runaway recording can't leak memory.
/// `MAX_RECORDING_SECONDS` (240s) * 32KB/s (16kHz mono Int16) = ~7.7MB; we
/// round up to 16MB for headroom on WAV header overhead and silence padding.
/// When the cap is hit we drop the buffer and surface an error so the UI can
/// react instead of silently accumulating partial audio.
const TRANSCRIBE_BUFFER_MAX_BYTES: usize = 16 * 1024 * 1024;

/// Append a chunk of audio bytes to the buffer for this request id. Metadata
/// (the request id) travels in headers so the body stays raw.
#[tauri::command]
pub async fn transcribe_push_chunk(
    request: Request<'_>,
    state: State<'_, AppState>,
) -> Result<(), AppError> {
    let request_id = request
        .headers()
        .get("x-request-id")
        .and_then(|v| v.to_str().ok())
        .ok_or_else(|| AppError::other("transcribe_push_chunk missing x-request-id header"))?
        .to_string();
    let chunk = match request.body() {
        InvokeBody::Raw(bytes) => bytes,
        InvokeBody::Json(_) => {
            return Err(AppError::other(
                "transcribe_push_chunk requires a raw binary body",
            ))
        }
    };
    let mut buffers = state.transcribe_buffers.lock();
    let buf = buffers
        .entry(request_id.clone())
        .or_insert_with(|| TranscribeBuffer {
            bytes: Vec::new(),
            last_updated: Instant::now(),
        });
    if buf.bytes.len() + chunk.len() > TRANSCRIBE_BUFFER_MAX_BYTES {
        // Drop the buffer so the process doesn't keep growing and surface a
        // terminal error to the caller.
        buffers.remove(&request_id);
        return Err(AppError::other(
            "transcribe buffer exceeded maximum size",
        ));
    }
    buf.bytes.extend_from_slice(chunk);
    buf.last_updated = Instant::now();
    Ok(())
}

/// Drain the buffered chunks for this request id, build a multipart upload
/// and send it to OpenAI. Buffer is removed whether the upload succeeds or
/// fails so we don't leak memory on error.
#[tauri::command]
pub async fn transcribe_commit(
    args: TranscribeCommitArgs,
    state: State<'_, AppState>,
) -> Result<String, AppError> {
    // Clone the buffer so it stays intact if the upload fails — the caller
    // may retry (withRetry on the frontend) and we don't want the first
    // attempt's drain to starve retries with a "no buffered audio" error.
    // Buffer is explicitly removed on success below, and via
    // `transcribe_discard` / `cancel_request` on abandon.
    let pcm = state
        .transcribe_buffers
        .lock()
        .get(&args.request_id)
        .map(|buf| buf.bytes.clone())
        .ok_or_else(|| AppError::other("no buffered audio for request id"))?;
    if pcm.is_empty() {
        state.transcribe_buffers.lock().remove(&args.request_id);
        return Err(AppError::other("transcribe_commit received empty buffer"));
    }

    // If the recorder streamed raw Int16 PCM (Phase 9.3), wrap it in a RIFF
    // WAVE header so OpenAI's multipart parser sees a valid .wav upload.
    // Without a sample rate the buffer is already a self-contained
    // container (webm/mp4/etc.) and we upload as-is.
    let audio = match args.sample_rate {
        Some(rate) => wrap_pcm_in_wav(&pcm, rate),
        None => pcm,
    };

    let key = api_key()?;
    let token = register_token(&state, &args.request_id);
    let client = state.http.clone();

    let part = reqwest::multipart::Part::bytes(audio)
        .file_name(args.filename)
        .mime_str(&args.content_type)
        .map_err(|e| AppError::other(e.to_string()))?;
    let form = reqwest::multipart::Form::new()
        .text("model", args.model)
        .part("file", part);

    let http_request = client
        .post(format!("{OPENAI_BASE_URL}/audio/transcriptions"))
        .header(AUTHORIZATION, format!("Bearer {key}"))
        .multipart(form);

    let result = tokio::select! {
        _ = token.cancelled() => return Err(AppError::Aborted { message: "cancelled".into() }),
        res = http_request.send() => res,
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
    // Upload succeeded — now it's safe to drop the buffer. Retries on
    // upstream errors (429, 5xx, network) reuse the clone we made above.
    state.transcribe_buffers.lock().remove(&args.request_id);
    Ok(text.to_string())
}

/// Drop the buffer without uploading. Called when a recording is aborted or
/// abandoned so memory doesn't leak across stopped sessions.
#[tauri::command]
pub fn transcribe_discard(request_id: String, state: State<'_, AppState>) {
    state.transcribe_buffers.lock().remove(&request_id);
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
    // Also drop any in-progress transcribe buffer keyed by this id so we
    // don't leak memory if the renderer cancels a recording before commit.
    state.transcribe_buffers.lock().remove(&request_id);
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

/// Wrap little-endian 16-bit mono PCM in a RIFF/WAVE header. 44 bytes of
/// header + the original samples. Shape matches the front-end's wavEncoder
/// so a round-trip produces identical output regardless of which side
/// constructs the WAV.
fn wrap_pcm_in_wav(pcm: &[u8], sample_rate: u32) -> Vec<u8> {
    const SAMPLE_BYTES: u32 = 2;
    const CHANNELS: u16 = 1;
    let data_bytes = pcm.len() as u32;
    let byte_rate = sample_rate * u32::from(CHANNELS) * SAMPLE_BYTES;
    let block_align = CHANNELS * SAMPLE_BYTES as u16;

    let mut out = Vec::with_capacity(44 + pcm.len());
    out.extend_from_slice(b"RIFF");
    out.extend_from_slice(&(36u32 + data_bytes).to_le_bytes());
    out.extend_from_slice(b"WAVE");
    out.extend_from_slice(b"fmt ");
    out.extend_from_slice(&16u32.to_le_bytes()); // fmt chunk size
    out.extend_from_slice(&1u16.to_le_bytes()); // PCM
    out.extend_from_slice(&CHANNELS.to_le_bytes());
    out.extend_from_slice(&sample_rate.to_le_bytes());
    out.extend_from_slice(&byte_rate.to_le_bytes());
    out.extend_from_slice(&block_align.to_le_bytes());
    out.extend_from_slice(&((SAMPLE_BYTES as u16) * 8).to_le_bytes()); // bits per sample
    out.extend_from_slice(b"data");
    out.extend_from_slice(&data_bytes.to_le_bytes());
    out.extend_from_slice(pcm);
    out
}

/// SSE events are terminated by a blank line. The spec (W3C) requires clients
/// to accept all three line-ending variants — `\r\n\r\n`, `\n\n`, and `\r\r` —
/// even though OpenAI currently emits `\n\n`. A proxy between us and the API
/// could rewrite line endings, and hanging forever waiting for `\n\n` is a
/// bad failure mode. Byte-level search is safe because the separators are
/// ASCII regardless of how UTF-8 codepoints split across stream chunks.
///
/// Returns `(position_of_content_end, separator_length)` so the caller can
/// drain the right number of bytes from the buffer.
fn find_event_boundary(buf: &[u8]) -> Option<(usize, usize)> {
    if let Some(pos) = buf.windows(4).position(|w| w == b"\r\n\r\n") {
        return Some((pos, 4));
    }
    if let Some(pos) = buf.windows(2).position(|w| w == b"\n\n") {
        return Some((pos, 2));
    }
    if let Some(pos) = buf.windows(2).position(|w| w == b"\r\r") {
        return Some((pos, 2));
    }
    None
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn wav_header_matches_openai_expected_riff_layout_for_16khz_mono_pcm() {
        // Two samples of PCM — small enough to inspect every field, large
        // enough to prove the data section and header sizes line up. Mirrors
        // the JS `wavEncoder.test.ts` so a cross-runtime round-trip is
        // guaranteed to produce identical bytes.
        let pcm: [u8; 4] = [0x01, 0x00, 0xff, 0xff]; // two LE Int16: 1, -1
        let wav = wrap_pcm_in_wav(&pcm, 16000);

        assert_eq!(wav.len(), 44 + 4);
        assert_eq!(&wav[0..4], b"RIFF");
        assert_eq!(&wav[8..12], b"WAVE");
        assert_eq!(&wav[12..16], b"fmt ");
        assert_eq!(&wav[36..40], b"data");

        // RIFF chunk size = file size - 8 = 40
        assert_eq!(u32::from_le_bytes(wav[4..8].try_into().unwrap()), 40);
        // fmt subchunk size = 16 (PCM)
        assert_eq!(u32::from_le_bytes(wav[16..20].try_into().unwrap()), 16);
        // format code 1 = PCM, 1 channel, 16kHz
        assert_eq!(u16::from_le_bytes(wav[20..22].try_into().unwrap()), 1);
        assert_eq!(u16::from_le_bytes(wav[22..24].try_into().unwrap()), 1);
        assert_eq!(u32::from_le_bytes(wav[24..28].try_into().unwrap()), 16000);
        // byte rate = 16000 * 1 * 2
        assert_eq!(u32::from_le_bytes(wav[28..32].try_into().unwrap()), 32_000);
        // bits per sample
        assert_eq!(u16::from_le_bytes(wav[34..36].try_into().unwrap()), 16);
        // data size
        assert_eq!(u32::from_le_bytes(wav[40..44].try_into().unwrap()), 4);
        // payload preserved exactly
        assert_eq!(&wav[44..48], &pcm);
    }

    #[test]
    fn sse_boundary_detection_accepts_all_three_blank_line_variants_from_the_spec() {
        // OpenAI emits `\n\n` today; proxies can rewrite to CRLF. Spec says
        // clients MUST accept `\r\n\r\n`, `\n\n`, and `\r\r`. Missing a
        // variant means the stream hangs forever waiting for the wrong
        // terminator.
        assert_eq!(find_event_boundary(b"data: 1\n\nrest"), Some((7, 2)));
        assert_eq!(find_event_boundary(b"data: 1\r\n\r\nrest"), Some((7, 4)));
        assert_eq!(find_event_boundary(b"data: 1\r\rrest"), Some((7, 2)));
        // Incomplete event: still waiting for more bytes.
        assert_eq!(find_event_boundary(b"data: 1\n"), None);
        assert_eq!(find_event_boundary(b""), None);
    }

    #[test]
    fn sse_boundary_prefers_crlf_over_bare_lf_when_both_could_match() {
        // `\r\n\r\n` shares `\n\n` as a substring. The parser must report
        // the 4-byte separator so the caller drains the full terminator
        // instead of leaving a stray `\r\n` in the buffer.
        let (_, sep_len) = find_event_boundary(b"x\r\n\r\ny").unwrap();
        assert_eq!(sep_len, 4);
    }
}
