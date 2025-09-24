use alloy::{
    rpc::client::RpcClient,
    transports::{http::reqwest::Url, layers::RetryBackoffLayer},
};

pub fn build_rpc_clients(urls: Vec<Url>) -> Vec<RpcClient> {
    urls.into_iter()
        .map(|url| RpcClient::builder().http(url))
        .collect()
}

pub fn build_rpc_clients_with_retry(
    urls: Vec<Url>,
    retry_max: u32,
    backoff_ms: u64,
    jitter_ms: u64,
) -> Vec<RpcClient> {
    urls.into_iter()
        .map(|url| {
            RpcClient::builder()
                .layer(RetryBackoffLayer::new(retry_max, backoff_ms, jitter_ms))
                .http(url)
        })
        .collect()
}
