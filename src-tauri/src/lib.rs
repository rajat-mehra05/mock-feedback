use parking_lot::Mutex;
use reqwest::Client;
use std::collections::HashMap;
use std::time::{Duration, Instant};
use tauri::Manager;
use tokio_util::sync::CancellationToken;

mod commands;
mod error;
#[cfg(target_os = "macos")]
mod menu;
mod openai;
mod secrets;

/// A streamed-transcribe buffer plus the timestamp of its last write. The
/// background janitor (see `setup` below) drops entries that haven't been
/// touched in a while so an abandoned recording — one that started pushing
/// chunks but never reached commit/discard/cancel — can't accumulate across
/// a long-running session.
pub struct TranscribeBuffer {
    pub bytes: Vec<u8>,
    pub last_updated: Instant,
}

/// App-wide state. One pooled reqwest client plus a map of cancellation
/// tokens keyed by `request_id` so the renderer can cancel in-flight calls.
/// The mutex is synchronous (`parking_lot`) because the cancel path never
/// awaits — holding a `tokio::sync::Mutex` here would force `.lock().await`
/// across a trivial critical section.
///
/// `transcribe_buffers` accumulates audio chunks as the recorder streams them
/// in during a session's recording phase (Phase 9.2). On mic-stop the matching
/// `transcribe_commit` drains the buffer straight into a multipart upload,
/// avoiding the JS → Rust IPC transit of the full blob after the user stops
/// talking. Buffers are dropped on commit or cancel.
pub struct AppState {
    pub http: Client,
    pub cancel_tokens: Mutex<HashMap<String, CancellationToken>>,
    pub transcribe_buffers: Mutex<HashMap<String, TranscribeBuffer>>,
}

/// How often the janitor scans `transcribe_buffers`.
const TRANSCRIBE_JANITOR_INTERVAL: Duration = Duration::from_secs(60);
/// Entries idle longer than this are evicted. Longest legitimate path is
/// `MAX_RECORDING_SECONDS` (240s) + upload + retries; 10 minutes covers it
/// with generous headroom.
const TRANSCRIBE_BUFFER_TTL: Duration = Duration::from_secs(600);

/// Pure helper for the janitor: drop any buffer whose `last_updated` sits
/// further than `ttl` in the past from `now`. Split out of the scanner task
/// so it's straightforward to test.
pub fn evict_expired_buffers(
    buffers: &mut HashMap<String, TranscribeBuffer>,
    now: Instant,
    ttl: Duration,
) {
    buffers.retain(|_, buf| now.duration_since(buf.last_updated) < ttl);
}

pub fn run() {
    let state = AppState {
        http: openai::client::build(),
        cancel_tokens: Mutex::new(HashMap::new()),
        transcribe_buffers: Mutex::new(HashMap::new()),
    };

    tauri::Builder::default()
        // Second launch of the app focuses the existing window instead of
        // opening a new one. See tauri-plugin-single-instance docs.
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.show();
                let _ = window.set_focus();
            }
        }))
        .manage(state)
        .invoke_handler(tauri::generate_handler![
            secrets::secret_set,
            secrets::secret_has,
            secrets::secret_clear,
            commands::openai::openai_chat,
            commands::openai::openai_chat_stream,
            commands::openai::openai_transcribe,
            commands::openai::transcribe_push_chunk,
            commands::openai::transcribe_commit,
            commands::openai::transcribe_discard,
            commands::openai::openai_tts,
            commands::openai::cancel_request,
        ])
        .setup(|app| {
            #[cfg(target_os = "macos")]
            {
                let menu = menu::build(app.handle())?;
                app.set_menu(menu)?;
            }

            // Background janitor: evict transcribe buffers whose last write
            // is older than `TRANSCRIBE_BUFFER_TTL`. Handles the edge case
            // where a recording started pushing chunks but no subsequent
            // commit / discard / cancel ever fired (e.g. webview crash,
            // component unmount during an unusual state transition).
            let handle = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                let mut interval = tokio::time::interval(TRANSCRIBE_JANITOR_INTERVAL);
                // Skip the immediate first tick so we don't scan an empty
                // map right after boot.
                interval.tick().await;
                loop {
                    interval.tick().await;
                    if let Some(state) = handle.try_state::<AppState>() {
                        let mut buffers = state.transcribe_buffers.lock();
                        evict_expired_buffers(&mut buffers, Instant::now(), TRANSCRIBE_BUFFER_TTL);
                    }
                }
            });

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn janitor_drops_idle_buffers_past_the_ttl_and_keeps_recent_ones() {
        let now = Instant::now();
        let ttl = Duration::from_secs(600);

        let mut buffers: HashMap<String, TranscribeBuffer> = HashMap::new();
        // A fresh upload in flight (written "just now") — must survive.
        buffers.insert(
            "live".into(),
            TranscribeBuffer {
                bytes: vec![],
                last_updated: now,
            },
        );
        // An abandoned buffer last touched well past the TTL — must go.
        buffers.insert(
            "stale".into(),
            TranscribeBuffer {
                bytes: vec![],
                last_updated: now - Duration::from_secs(1200),
            },
        );
        // Right at the boundary — `<` not `<=` means exactly-TTL entries
        // are evicted. Document the inclusive/exclusive choice via the test.
        buffers.insert(
            "borderline".into(),
            TranscribeBuffer {
                bytes: vec![],
                last_updated: now - ttl,
            },
        );

        evict_expired_buffers(&mut buffers, now, ttl);

        assert!(buffers.contains_key("live"));
        assert!(!buffers.contains_key("stale"));
        assert!(!buffers.contains_key("borderline"));
    }
}
