use crate::{
    exec::{OrderingKey, Range, WorkItem},
    order::chunk_range,
};
use alloy::primitives::Address;
use alloy::rpc::types::trace::filter::{TraceFilter, TraceFilterMode};
use alloy::rpc::types::trace::parity::LocalizedTransactionTrace;

/// Pure planner (no IO). Emits raw WorkItems that the executor will run.
#[derive(Clone, Debug)]
pub struct TraceFilterPlan {
    pub range: Range,
    pub chunk_size: u64,
    pub from: Vec<Address>,
    pub to: Vec<Address>,
    pub mode: Option<TraceFilterMode>,
    pub after: Option<u64>,
    pub count: Option<u64>,
}

impl TraceFilterPlan {
    pub fn plan(&self) -> anyhow::Result<Vec<WorkItem>> {
        let mode = self.mode.unwrap_or(TraceFilterMode::Union);
        chunk_range(self.range, self.chunk_size)
            .map(|r| {
                let filter = TraceFilter {
                    from_block: Some(r.from),
                    to_block: Some(r.to),
                    from_address: self.from.clone(),
                    to_address: self.to.clone(),
                    mode,
                    after: self.after,
                    count: self.count,
                };
                Ok(WorkItem {
                    method: "trace_filter",
                    params: vec![serde_json::to_value(filter)?],
                    key: OrderingKey::Range(r),
                })
            })
            .collect()
    }

    pub fn decode(value: serde_json::Value) -> anyhow::Result<Vec<LocalizedTransactionTrace>> {
        Ok(serde_json::from_value(value)?)
    }
}
