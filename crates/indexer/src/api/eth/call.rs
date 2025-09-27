use crate::exec::{OrderingKey, WorkItem};
use alloy::primitives::Bytes;
use alloy::rpc::types::eth::{BlockNumberOrTag, TransactionRequest};

pub fn work_one(call: TransactionRequest, at: BlockNumberOrTag) -> anyhow::Result<WorkItem> {
    Ok(WorkItem {
        method: "eth_call",
        params: vec![serde_json::to_value(call)?, serde_json::to_value(at)?],
        key: OrderingKey::None,
    })
}

pub fn decode_bytes(v: serde_json::Value) -> anyhow::Result<Bytes> {
    Ok(serde_json::from_value(v)?)
}
