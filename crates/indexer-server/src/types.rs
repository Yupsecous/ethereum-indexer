use serde::{Deserialize, Serialize};

#[derive(Serialize)]
pub struct PingResponse {
    pub message: String,
}

#[derive(Deserialize)]
pub struct TraceFilterQuery {
    pub startblock: Option<u64>,
    pub endblock: Option<u64>,
}
