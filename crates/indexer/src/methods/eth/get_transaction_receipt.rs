use crate::exec::{OrderingKey, WorkItem};
use alloy::primitives::B256;
use alloy::rpc::types::eth::TransactionReceipt;

/// Plan for fetching receipts by transaction hash.
/// Pure planner: no IO, just produces WorkItems.)
#[derive(Clone, Debug)]
pub struct TxReceiptPlan {
    pub hashes: Vec<B256>,
}

impl TxReceiptPlan {
    /// Emit one JSON-RPC call per hash: `eth_getTransactionReceipt`.
    /// We use `OrderingKey::Index(i)`-like behavior by just preserving slice order via `None`
    /// or you can add an Index key to keep strict ordering if you want.
    pub fn plan(&self) -> anyhow::Result<Vec<WorkItem>> {
        self.hashes
            .iter()
            .map(|h| {
                Ok(WorkItem {
                    method: "eth_getTransactionReceipt",
                    // B256 serializes to "0x..." automatically via serde
                    params: vec![serde_json::to_value(h)?],
                    key: OrderingKey::None,
                })
            })
            .collect()
    }

    pub fn decode(value: serde_json::Value) -> anyhow::Result<Option<TransactionReceipt>> {
        Ok(serde_json::from_value(value)?)
    }
}
