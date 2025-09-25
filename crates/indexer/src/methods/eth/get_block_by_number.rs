use crate::{
    Range,
    exec::{OrderingKey, WorkItem},
};
use alloy::rpc::types::eth::{Block, BlockNumberOrTag};
use serde_json::Value;

#[derive(Clone, Debug)]
pub struct BlockByNumberPlan {
    pub numbers: Vec<BlockNumberOrTag>,
    pub full: bool, // passed in from builder (defaults to true there)
}

impl BlockByNumberPlan {
    pub fn plan(&self) -> anyhow::Result<Vec<WorkItem>> {
        self.numbers
            .iter()
            .map(|n| {
                let key = match *n {
                    BlockNumberOrTag::Number(num) => {
                        OrderingKey::Range(Range { from: num, to: num })
                    }
                    _ => OrderingKey::None, // tags cannot be strictly ordered
                };
                Ok(WorkItem {
                    method: "eth_getBlockByNumber",
                    params: vec![serde_json::to_value(n)?, serde_json::to_value(self.full)?],
                    key,
                })
            })
            .collect()
    }

    pub fn decode(v: Value) -> anyhow::Result<Option<Block>> {
        Ok(serde_json::from_value(v)?)
    }
}
