use reqwest::Client;
use std::time::Duration;

/// Shared `reqwest::Client` built once at app startup. HTTP/2 is negotiated
/// via ALPN; idle connections stay warm so the TLS handshake does not
/// reappear on every turn.
pub fn build() -> Client {
    Client::builder()
        // Keep connections warm across turns. The server will close idles too,
        // this is just an upper bound.
        .pool_idle_timeout(Some(Duration::from_secs(90)))
        .connect_timeout(Duration::from_secs(15))
        // Request-level safety net. The renderer can still cancel earlier via
        // `cancel_request`, but this guarantees no invoke hangs forever if the
        // upstream stops responding mid-stream.
        .timeout(Duration::from_secs(60))
        .build()
        .expect("reqwest client build")
}

pub const OPENAI_BASE_URL: &str = "https://api.openai.com/v1";
