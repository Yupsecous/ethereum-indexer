use crate::exec::{OrderingKey, WorkItem};
use alloy::primitives::{Address, U256};
use alloy::rpc::types::eth::BlockNumberOrTag;

#[derive(Clone, Debug)]
pub struct GetBalancePlan {
    pub queries: Vec<(Address, BlockNumberOrTag)>,
}

impl GetBalancePlan {
    pub fn plan(&self) -> anyhow::Result<Vec<WorkItem>> {
        self.queries
            .iter()
            .map(|(addr, n)| {
                Ok(WorkItem {
                    method: "eth_getBalance",
                    params: vec![serde_json::to_value(addr)?, serde_json::to_value(n)?],
                    key: OrderingKey::None,
                })
            })
            .collect()
    }

    pub fn decode(v: serde_json::Value) -> anyhow::Result<U256> {
        Ok(serde_json::from_value(v)?)
    }
}

pub fn work_one(addr: Address, n: BlockNumberOrTag) -> anyhow::Result<WorkItem> {
    Ok(WorkItem {
        method: "eth_getBalance",
        params: vec![serde_json::to_value(addr)?, serde_json::to_value(n)?],
        key: OrderingKey::None,
    })
}
