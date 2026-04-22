use serde::Serialize;
use thiserror::Error;

/// Errors returned from command handlers. The `code` tag gives the frontend
/// a discriminated union to classify failures (auth, rate_limit, network,
/// ...) without inspecting free-form `message` strings.
#[derive(Debug, Error, Serialize)]
#[serde(tag = "code", rename_all = "snake_case")]
pub enum AppError {
    #[error("no api key configured")]
    MissingApiKey { message: String },
    #[error("invalid api key")]
    Auth { message: String, status: u16 },
    #[error("rate limited")]
    RateLimit { message: String, status: u16 },
    #[error("quota exhausted")]
    Quota { message: String, status: u16 },
    #[error("not found")]
    NotFound { message: String, status: u16 },
    #[error("request aborted")]
    Aborted { message: String },
    #[error("network error")]
    Network { message: String },
    #[error("request timed out")]
    Timeout { message: String },
    #[error("upstream error")]
    Upstream { message: String, status: u16 },
    #[error("other error")]
    Other { message: String },
}

impl AppError {
    pub fn other(msg: impl Into<String>) -> Self {
        Self::Other { message: msg.into() }
    }

    pub fn missing_key() -> Self {
        Self::MissingApiKey {
            message: "No API key configured. Please add your OpenAI key in Settings.".into(),
        }
    }
}

impl From<reqwest::Error> for AppError {
    fn from(e: reqwest::Error) -> Self {
        if e.is_timeout() {
            return AppError::Timeout { message: e.to_string() };
        }
        if let Some(status) = e.status() {
            let status_u16 = status.as_u16();
            let message = e.to_string();
            return match status_u16 {
                401 => AppError::Auth { message, status: status_u16 },
                404 => AppError::NotFound { message, status: status_u16 },
                429 => AppError::RateLimit { message, status: status_u16 },
                _ => AppError::Upstream { message, status: status_u16 },
            };
        }
        AppError::Network { message: e.to_string() }
    }
}

impl From<keyring::Error> for AppError {
    fn from(e: keyring::Error) -> Self {
        match e {
            keyring::Error::NoEntry => AppError::missing_key(),
            other => AppError::other(other.to_string()),
        }
    }
}

impl From<serde_json::Error> for AppError {
    fn from(e: serde_json::Error) -> Self {
        AppError::other(e.to_string())
    }
}

impl From<std::io::Error> for AppError {
    fn from(e: std::io::Error) -> Self {
        AppError::other(e.to_string())
    }
}
