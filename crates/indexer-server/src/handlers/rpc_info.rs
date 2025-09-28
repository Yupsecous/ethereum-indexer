use crate::types::RpcInfoResponse;
use axum::response::Json;

pub async fn rpc_info() -> Json<RpcInfoResponse> {
    let rpc_urls: Vec<String> = std::env::var("RPC_URLS")
        .unwrap_or_else(|_| "https://eth.drpc.org".to_string())
        .split(',')
        .map(|url| url.trim().to_string())
        .collect();

    let parallel_per_rpc = std::env::var("PARALLEL_PER_RPC")
        .ok()
        .and_then(|s| s.parse::<usize>().ok())
        .unwrap_or(8); // Match the default from main.rs

    Json(RpcInfoResponse {
        rpc_urls,
        parallel_per_rpc,
    })
}
