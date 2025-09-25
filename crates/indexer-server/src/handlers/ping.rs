use crate::types::PingResponse;
use axum::response::Json;

pub async fn ping() -> Json<PingResponse> {
    Json(PingResponse {
        message: "pong!".to_string(),
    })
}
