use crate::{
    exec::{OrderingKey, Range, WorkItem},
    order::chunk_range,
};
use alloy::primitives::{Address, B256};
use alloy::rpc::types::eth::{BlockNumberOrTag, Log};
use serde_json::json;

#[derive(Clone, Debug)]
pub enum Topic {
    Any,
    One(B256),
    Or(Vec<B256>),
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

#[derive(Clone, Debug)]
pub struct GetLogsPlan {
    pub range: Range,
    pub chunk_size: u64,
    pub addresses: Vec<Address>, // empty => omit
    pub topics: Vec<Topic>,      // 0..=3; missing => null
}

impl GetLogsPlan {
    pub fn plan(&self) -> anyhow::Result<Vec<WorkItem>> {
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

        chunk_range(self.range, self.chunk_size)
            .map(|r| {
                let from_v = serde_json::to_value(BlockNumberOrTag::Number(r.from))?;
                let to_v = serde_json::to_value(BlockNumberOrTag::Number(r.to))?;

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
            .collect()
    }

    pub fn decode(v: serde_json::Value) -> anyhow::Result<Vec<Log>> {
        Ok(serde_json::from_value(v)?)
    }
}
