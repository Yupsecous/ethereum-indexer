use alloy::rpc::client::RpcClient;
use std::sync::{
    Arc,
    atomic::{AtomicU64, AtomicUsize, Ordering},
};
use std::time::Instant;
use tokio::sync::Semaphore;

#[derive(Default)]
pub struct RpcStats {
    requests: AtomicU64,
    successes: AtomicU64,
    total_ms: AtomicU64,
}
impl RpcStats {
    pub fn record(&self, ok: bool, dur: std::time::Duration) {
        self.requests.fetch_add(1, Ordering::Relaxed);
        if ok {
            self.successes.fetch_add(1, Ordering::Relaxed);
        }
        self.total_ms
            .fetch_add(dur.as_millis() as u64, Ordering::Relaxed);
    }
    pub fn snapshot(&self) -> (u64, u64, f64) {
        let r = self.requests.load(Ordering::Relaxed);
        let s = self.successes.load(Ordering::Relaxed);
        let t = self.total_ms.load(Ordering::Relaxed);
        (r, s, if r > 0 { t as f64 / r as f64 } else { 0.0 })
    }
}

pub struct ProviderPool {
    clients: Vec<RpcClient>,
    permits: Vec<Arc<Semaphore>>,
    stats: Arc<[RpcStats]>,
    rr: AtomicUsize,
}

impl ProviderPool {
    pub fn new(clients: Vec<RpcClient>, per_rpc_parallel: usize) -> Self {
        let permits = (0..clients.len())
            .map(|_| Arc::new(Semaphore::new(per_rpc_parallel)))
            .collect();
        let stats: Arc<[RpcStats]> = (0..clients.len())
            .map(|_| RpcStats::default())
            .collect::<Vec<_>>()
            .into();
        Self {
            clients,
            permits,
            stats,
            rr: AtomicUsize::new(0),
        }
    }

    pub fn len(&self) -> usize {
        self.clients.len()
    }
    pub fn stats(&self) -> Arc<[RpcStats]> {
        self.stats.clone()
    }

    pub async fn rr_request(
        &self,
        method: &'static str,
        params: Vec<serde_json::Value>,
    ) -> anyhow::Result<serde_json::Value> {
        let idx = self.rr.fetch_add(1, Ordering::Relaxed) % self.clients.len();
        let permit = self.permits[idx].acquire().await?;
        let client = &self.clients[idx];

        let t0 = Instant::now();
        let res = client.request(method, params).await;
        drop(permit);

        self.stats[idx].record(res.is_ok(), t0.elapsed());
        Ok(res?)
    }
}
