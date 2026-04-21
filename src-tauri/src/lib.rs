use tauri::Manager;

#[cfg(target_os = "macos")]
mod menu;
mod secrets;

pub fn run() {
    tauri::Builder::default()
        // Second launch of the app focuses the existing window instead of
        // opening a new one. See tauri-plugin-single-instance docs.
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.show();
                let _ = window.set_focus();
            }
        }))
        .invoke_handler(tauri::generate_handler![
            secrets::secret_set,
            secrets::secret_has,
            secrets::secret_clear,
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
