use keyring::Entry;

// Namespaces the keychain entries under the app identifier so a user running
// multiple Tauri apps does not get cross-app collisions.
const SERVICE: &str = "com.voiceround.app";

// Allowlist of keys the frontend can touch. Prevents the generic adapter
// surface from being used as arbitrary keychain storage if a bug or
// compromise in the webview tries to write unrelated secrets.
const ALLOWED_KEYS: &[&str] = &["openai_api_key"];

fn validate(key: &str) -> Result<(), String> {
    if ALLOWED_KEYS.contains(&key) {
        Ok(())
    } else {
        Err(format!("unknown secret key: {key}"))
    }
}

fn entry(key: &str) -> Result<Entry, String> {
    Entry::new(SERVICE, key).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn secret_set(key: String, value: String) -> Result<(), String> {
    validate(&key)?;
    entry(&key)?.set_password(&value).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn secret_has(key: String) -> Result<bool, String> {
    validate(&key)?;
    match entry(&key)?.get_password() {
        Ok(_) => Ok(true),
        Err(keyring::Error::NoEntry) => Ok(false),
        Err(e) => Err(e.to_string()),
    }
}

#[tauri::command]
pub fn secret_clear(key: String) -> Result<(), String> {
    validate(&key)?;
    match entry(&key)?.delete_credential() {
        Ok(()) | Err(keyring::Error::NoEntry) => Ok(()),
        Err(e) => Err(e.to_string()),
    }
}
