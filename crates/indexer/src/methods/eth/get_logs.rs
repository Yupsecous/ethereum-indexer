use crate::{
    exec::{OrderingKey, Range, WorkItem},
    order::chunk_range,
};
use alloy::primitives::{Address, B256};
use alloy::rpc::types::eth::{BlockNumberOrTag, Log};
use serde_json::json;

/// Topic selector for a single slot in `topics[0..=3]`.
#[derive(Clone, Debug)]
pub enum Topic {
    Any,           // null
    One(B256),     // single topic
    Or(Vec<B256>), // OR of multiple topics
}

impl Topic {
    fn to_json(&self) -> serde_json::Value {
        match self {
            Topic::Any => serde_json::Value::Null,
            Topic::One(t) => serde_json::to_value(t).expect("topic serialize"),
            Topic::Or(v) => serde_json::to_value(v).expect("topics serialize"),
        }
    }
}

/// `eth_getLogs` plan: chunked by block range, optional address filter, up to 4 topics.
#[derive(Clone, Debug)]
pub struct GetLogsPlan {
    pub range: Range,
    pub chunk_size: u64,
    /// If non-empty, becomes `address: [addr...]`. If empty, omit field.
    pub addresses: Vec<Address>,
    /// 0..=3 topic slots. Missing slots are serialized as `null`.
    pub topics: Vec<Topic>,
}

impl GetLogsPlan {
    /// Emit one `eth_getLogs` call per chunk.
    pub fn plan(&self) -> anyhow::Result<Vec<WorkItem>> {
        let topics_json = {
            // Build exactly 4 entries as per RPC shape
            let mut v = Vec::with_capacity(4);
            for i in 0..4 {
                v.push(
                    self.topics
                        .get(i)
                        .map(|t| t.to_json())
                        .unwrap_or(serde_json::Value::Null),
                );
            }
            serde_json::Value::Array(v)
        };

        let have_addresses = !self.addresses.is_empty();

        let items = chunk_range(self.range, self.chunk_size)
            .map(|r| {
                // Use Alloy’s BlockNumberOrTag for correct hex serialization
                let from_v = serde_json::to_value(BlockNumberOrTag::Number(r.from))?;
                let to_v = serde_json::to_value(BlockNumberOrTag::Number(r.to))?;

                let mut filter = json!({
                    "fromBlock": from_v,
                    "toBlock":   to_v,
                    "topics":    topics_json,
                });

                if have_addresses {
                    // Single or many addresses; RPC accepts string or array. We always give an array.
                    let addrs = serde_json::to_value(&self.addresses)?;
                    filter
                        .as_object_mut()
                        .expect("filter obj")
                        .insert("address".into(), addrs);
                }

                Ok(WorkItem {
                    method: "eth_getLogs",
                    params: vec![filter],
                    key: OrderingKey::Range(r),
                })
            })
            .collect::<anyhow::Result<Vec<_>>>()?;

        Ok(items)
    }

    /// Decode RPC result into Alloy `Log` types.
    pub fn decode(v: serde_json::Value) -> anyhow::Result<Vec<Log>> {
        Ok(serde_json::from_value(v)?)
    }
}

/// Helpers for ERC-20 Transfer filtering (topic0 hash + indexed address topic encoding).
pub mod helpers {
    use super::*;
    use alloy::primitives::B256;

    /// Convert an address to a 32-byte topic (right-padded in the low 20 bytes).
    pub fn address_topic(addr: Address) -> B256 {
        let mut b = [0u8; 32];
        // Right-align the 20 bytes (topics are ABI-encoded for value types).
        b[12..].copy_from_slice(addr.as_slice());
        B256::from(b)
    }

    /// Build topics array for `Transfer(from=watched, to=*)`.
    pub fn erc20_transfer_from_topics(sig_topic: B256, watched: Address) -> [Topic; 4] {
        [
            Topic::One(sig_topic),              // topic0: event signature
            Topic::One(address_topic(watched)), // topic1: indexed from
            Topic::Any,                         // topic2: indexed to
            Topic::Any,                         // topic3: value (non-indexed -> not in topics)
        ]
    }

    /// Build topics array for `Transfer(from=*, to=watched)`.
    pub fn erc20_transfer_to_topics(sig_topic: B256, watched: Address) -> [Topic; 4] {
        [
            Topic::One(sig_topic),
            Topic::Any,
            Topic::One(address_topic(watched)), // topic2: indexed to
            Topic::Any,
        ]
    }
}
