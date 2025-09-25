use crate::pool::{ProviderPool, RpcStats};
use futures::StreamExt;
use std::sync::Arc;

#[derive(Clone, Copy, Debug, PartialEq, Eq, PartialOrd, Ord)]
pub struct Range {
    pub from: u64,
    pub to: u64,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, PartialOrd, Ord)]
pub enum OrderingKey {
    Range(Range),
    None,
}

pub struct WorkItem {
    pub method: &'static str,
    pub params: Vec<serde_json::Value>,
    pub key: OrderingKey,
}

pub struct EthereumIndexer {
    pool: Arc<ProviderPool>,
    global_parallel: usize,
}

impl EthereumIndexer {
    pub fn new(pool: ProviderPool, per_rpc_parallel: usize) -> Self {
        let n = pool.len();
        Self {
            pool: Arc::new(pool),
            global_parallel: n * per_rpc_parallel,
        }
    }

    pub fn run(
        &self,
        items: Vec<WorkItem>,
    ) -> impl futures::Stream<Item = anyhow::Result<(OrderingKey, serde_json::Value)>> {
        let pool = self.pool.clone();
        futures::stream::iter(items.into_iter().map(move |w| {
            let pool = pool.clone();
            async move {
                let v = pool.rr_request(w.method, w.params).await?;
                Ok::<_, anyhow::Error>((w.key, v))
            }
        }))
        .buffer_unordered(self.global_parallel)
    }

    pub fn stats(&self) -> Arc<[RpcStats]> {
        self.pool.stats()
    }
}
