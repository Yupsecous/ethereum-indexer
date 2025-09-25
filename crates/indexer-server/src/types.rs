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

#[derive(Debug, Deserialize)]
pub struct BlockByNumberQuery {
    pub from: Option<u64>,
    pub to: Option<u64>,
    pub full: Option<bool>,
}
