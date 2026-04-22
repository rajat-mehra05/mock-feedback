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
        // `read_timeout` is per-chunk (resets on each successful read), so a
        // long TTS stream plays fine while a stalled connection is caught.
        // `timeout` is the upper bound for the whole request — big enough to
        // accommodate a multi-paragraph TTS response without aborting a
        // legitimate stream.
        .read_timeout(Duration::from_secs(30))
        .timeout(Duration::from_secs(300))
        .build()
        .expect("reqwest client build")
}

pub const OPENAI_BASE_URL: &str = "https://api.openai.com/v1";
