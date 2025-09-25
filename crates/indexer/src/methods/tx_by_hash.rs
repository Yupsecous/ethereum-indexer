use crate::exec::{OrderingKey, WorkItem};
use alloy::consensus::Transaction as ConsensusTx; // bring trait methods into scope
use alloy::primitives::{Address, B256, U256};
use alloy::rpc::types::eth::Transaction;

/// Pure planner: one `eth_getTransactionByHash` per hash.
#[derive(Clone, Debug)]
pub struct TxByHashPlan {
    pub hashes: Vec<B256>,
}

impl TxByHashPlan {
    pub fn plan(&self) -> Vec<WorkItem> {
        self.hashes
            .iter()
            .map(|h| WorkItem {
                method: "eth_getTransactionByHash",
                params: serde_json::json!(h),
                key: OrderingKey::None,
            })
            .collect()
    }

    /// Nodes return `null` for unknown → `Ok(None)`.
    pub fn decode(v: serde_json::Value) -> anyhow::Result<Option<Transaction>> {
        Ok(serde_json::from_value(v)?)
    }
}

/// A small normalized view for frontends, using consensus::Transaction trait
/// via `tx.inner` (Recovered envelope).
#[derive(Clone, Debug)]
pub struct TxView {
    pub hash: B256, // computed from signed tx
    pub block_hash: Option<B256>,
    pub block_number: Option<u64>,
    pub tx_index: Option<u64>,

    pub from: Address,
    pub to: Option<Address>,
    pub value: U256,
    pub nonce: u64,

    pub gas_limit: u64,
    pub legacy_gas_price: Option<U256>,         // legacy only
    pub max_fee_per_gas: Option<U256>,          // EIP-1559/4844
    pub max_priority_fee_per_gas: Option<U256>, // EIP-1559/4844

    pub input_len: usize,
    pub effective_gas_price: Option<U256>, // from RPC, real paid is in receipt
}

pub fn to_view(tx: &Transaction) -> TxView {
    // `tx.inner` is Recovered<...> and implements the `Transaction` trait methods.
    let rec = &tx.inner;

    TxView {
        hash: *rec.hash(), // compute tx hash from signed envelope
        block_hash: tx.block_hash,
        block_number: tx.block_number,
        tx_index: tx.transaction_index,

        from: rec.signer(),
        to: rec.to(),
        value: rec.value(),
        nonce: rec.nonce(),

        gas_limit: rec.gas_limit(),
        legacy_gas_price: rec.gas_price().map(U256::from), // Convert u128 to U256
        max_fee_per_gas: Some(U256::from(rec.max_fee_per_gas())), // Convert u128 to U256
        max_priority_fee_per_gas: rec.max_priority_fee_per_gas().map(U256::from),

        input_len: rec.input().len(),
        effective_gas_price: tx.effective_gas_price.map(U256::from), // Convert u128 to U256
    }
}
