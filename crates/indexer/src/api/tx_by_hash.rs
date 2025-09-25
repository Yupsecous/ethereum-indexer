use crate::methods::eth::get_transaction_by_hash::TxByHashPlan;
use alloy::primitives::B256;
use std::collections::HashSet;

/// Ergonomic builder for planning `eth_getTransactionByHash` calls.
/// - Dedupes hashes while preserving order
/// - Enforces a server-side safety limit (`max_hashes`)
#[derive(Clone, Debug)]
pub struct TxByHashBuilder {
    hashes: Vec<B256>,
    max_hashes: usize,
}

impl TxByHashBuilder {
    /// Defaults: empty set, limit = 10_000
    pub fn new() -> Self {
        Self {
            hashes: Vec::new(),
            max_hashes: 10_000,
        }
    }

    /// Replace all hashes (order preserved).
    pub fn hashes(mut self, hashes: Vec<B256>) -> Self {
        self.hashes = hashes;
        self
    }

    /// Push a single hash (append).
    pub fn push(mut self, h: B256) -> Self {
        self.hashes.push(h);
        self
    }

    /// Set a safety cap for number of RPC calls planned at once.
    pub fn limit(mut self, max_hashes: usize) -> Self {
        self.max_hashes = max_hashes.max(1);
        self
    }

    /// Validate + dedupe (stable) → `TxByHashPlan`.
    pub fn plan(self) -> anyhow::Result<TxByHashPlan> {
        if self.hashes.len() > self.max_hashes {
            anyhow::bail!(
                "too many hashes ({} > {})",
                self.hashes.len(),
                self.max_hashes
            );
        }

        // Stable dedupe: retain first occurrence order.
        let mut seen = HashSet::with_capacity(self.hashes.len());
        let hashes = self
            .hashes
            .into_iter()
            .filter(|h| seen.insert(*h))
            .collect();

        Ok(TxByHashPlan { hashes })
    }
}
