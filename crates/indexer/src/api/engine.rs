use crate::{
    exec::EthereumIndexer,
    pool::ProviderPool,
    providers::{build_rpc_clients, build_rpc_clients_with_retry},
};
use alloy::transports::http::reqwest::Url;

pub struct EngineBuilder {
    urls: Vec<Url>,
    per_rpc_parallel: usize,
    retry: Option<(u32, u64, u64)>,
}
impl EngineBuilder {
    pub fn new() -> Self {
        Self {
            urls: vec![],
            per_rpc_parallel: 5,
            retry: None,
        }
    }
    pub fn rpc_urls(mut self, urls: Vec<Url>) -> Self {
        self.urls = urls;
        self
    }
    pub fn parallel_per_rpc(mut self, n: usize) -> Self {
        self.per_rpc_parallel = n;
        self
    }
    pub fn retry(mut self, max: u32, backoff_ms: u64, jitter_ms: u64) -> Self {
        self.retry = Some((max, backoff_ms, jitter_ms));
        self
    }
    pub fn build(self) -> anyhow::Result<EthereumIndexer> {
        let clients = if let Some((m, b, j)) = self.retry {
            build_rpc_clients_with_retry(self.urls, m, b, j)
        } else {
            build_rpc_clients(self.urls)
        };
        let pool = ProviderPool::new(clients, self.per_rpc_parallel);
        Ok(EthereumIndexer::new(pool, self.per_rpc_parallel))
    }
}
