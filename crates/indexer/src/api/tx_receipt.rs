use crate::methods::eth::get_transaction_receipt::TxReceiptPlan;
use alloy::primitives::B256;

#[derive(Clone, Debug)]
pub struct TxReceiptBuilder {
    hashes: Vec<B256>,
    max_hashes: usize, // server safety guard
}

impl TxReceiptBuilder {
    pub fn new() -> Self {
        Self {
            hashes: Vec::new(),
            max_hashes: 10_000,
        }
    }

    pub fn hashes(mut self, hashes: Vec<B256>) -> Self {
        self.hashes = hashes;
        self
    }

    pub fn push(mut self, h: B256) -> Self {
        self.hashes.push(h);
        self
    }

    /// Set a safety limit for number of receipts fetched in one go.
    pub fn limit(mut self, max_hashes: usize) -> Self {
        self.max_hashes = max_hashes.max(1);
        self
    }

    pub fn plan(self) -> anyhow::Result<TxReceiptPlan> {
        if self.hashes.len() > self.max_hashes {
            anyhow::bail!(
                "too many hashes ({} > {})",
                self.hashes.len(),
                self.max_hashes
            );
        }
        // (Optional) dedupe while preserving order
        // use index_of first occurrence
        let mut seen = std::collections::HashSet::with_capacity(self.hashes.len());
        let hashes = self
            .hashes
            .into_iter()
            .filter(|h| seen.insert(*h))
            .collect();

        Ok(TxReceiptPlan { hashes })
    }
}
