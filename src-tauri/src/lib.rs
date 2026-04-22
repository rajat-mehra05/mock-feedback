use parking_lot::Mutex;
use reqwest::Client;
use std::collections::HashMap;
use tauri::Manager;
use tokio_util::sync::CancellationToken;

mod commands;
mod error;
#[cfg(target_os = "macos")]
mod menu;
mod openai;
mod secrets;

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
    pub transcribe_buffers: Mutex<HashMap<String, Vec<u8>>>,
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
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
