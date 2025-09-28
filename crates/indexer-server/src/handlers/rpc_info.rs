use crate::types::RpcInfoResponse;
use axum::response::Json;

pub async fn rpc_info() -> Json<RpcInfoResponse> {
    let rpc_urls: Vec<String> = std::env::var("RPC_URLS")
        .unwrap_or_else(|_| "https://eth.drpc.org".to_string())
        .split(',')
        .map(|url| url.trim().to_string())
        .collect();

    Json(RpcInfoResponse {
        rpc_urls,
        parallel_per_rpc: 20,
    })
}
