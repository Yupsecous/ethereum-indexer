use crate::{
    exec::{OrderingKey, Range, WorkItem},
    order::chunk_range,
};
use alloy::primitives::{Address, B256};
use alloy::rpc::types::eth::{BlockNumberOrTag, Log};
use serde_json::json;

/// Per-slot topic selector for `topics[0..=3]`.
#[derive(Clone, Debug)]
pub enum Topic {
    Any,           // -> null
    One(B256),     // -> "0x.."
    Or(Vec<B256>), // -> ["0x..", ...]
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

/// Chunked `eth_getLogs` plan (range + addresses + topics).
#[derive(Clone, Debug)]
pub struct GetLogsPlan {
    pub range: Range,
    pub chunk_size: u64,
    pub addresses: Vec<Address>, // empty => omit "address"
    pub topics: Vec<Topic>,      // 0..=3; missing => null
}

impl GetLogsPlan {
    pub fn plan(&self) -> anyhow::Result<Vec<WorkItem>> {
        // materialize topics[0..4]
        let topics_json = {
            let mut v = Vec::with_capacity(4);
            for i in 0..4 {
                v.push(
                    self.topics
                        .get(i)
                        .map(Topic::to_json)
                        .unwrap_or(serde_json::Value::Null),
                );
            }
            serde_json::Value::Array(v)
        };

        let have_addresses = !self.addresses.is_empty();

        let items = chunk_range(self.range, self.chunk_size)
            .map(|r| {
                let from_v = serde_json::to_value(BlockNumberOrTag::Number(r.from))?;
                let to_v = serde_json::to_value(BlockNumberOrTag::Number(r.to))?;

                // NOTE: clone topics_json per chunk (small).
                let mut filter = json!({
                    "fromBlock": from_v,
                    "toBlock":   to_v,
                    "topics":    topics_json.clone(),
                });

                if have_addresses {
                    filter
                        .as_object_mut()
                        .unwrap()
                        .insert("address".into(), serde_json::to_value(&self.addresses)?);
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

    pub fn decode(v: serde_json::Value) -> anyhow::Result<Vec<Log>> {
        Ok(serde_json::from_value(v)?)
    }
}

/// Small helpers for common topic encodings.
pub mod helpers {
    use super::*;
    /// Convert an address to a 32-byte topic (right-aligned).
    pub fn address_topic(addr: Address) -> B256 {
        let mut b = [0u8; 32];
        b[12..].copy_from_slice(addr.as_slice());
        B256::from(b)
    }
    /// topics for `Transfer(from=watched, to=*)`
    pub fn erc20_transfer_from(sig_topic: B256, watched: Address) -> [Topic; 4] {
        [
            Topic::One(sig_topic),
            Topic::One(address_topic(watched)),
            Topic::Any,
            Topic::Any,
        ]
    }
    /// topics for `Transfer(from=*, to=watched)`
    pub fn erc20_transfer_to(sig_topic: B256, watched: Address) -> [Topic; 4] {
        [
            Topic::One(sig_topic),
            Topic::Any,
            Topic::One(address_topic(watched)),
            Topic::Any,
        ]
    }
}
