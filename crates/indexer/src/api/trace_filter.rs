use crate::{exec::Range, methods::trace_filter::TraceFilterPlan};
use alloy::{primitives::Address, rpc::types::trace::filter::TraceFilterMode};

pub struct TraceFilterBuilder {
    start: u64,
    end: u64,
    chunk: u64,
    from: Vec<Address>,
    to: Vec<Address>,
    mode: TraceFilterMode,
    after: Option<u64>,
    count: Option<u64>,
    // server safety limits
    max_span: u64,
    max_chunk: u64,
}
impl TraceFilterBuilder {
    pub fn new() -> Self {
        Self {
            start: 0,
            end: 0,
            chunk: 1000,
            from: vec![],
            to: vec![],
            mode: TraceFilterMode::Union,
            after: None,
            count: None,
            max_span: 100_000,
            max_chunk: 10_000,
        }
    }
    pub fn target(mut self, addr: Address) -> Self {
        self.from = vec![addr];
        self.to = vec![addr];
        self
    }
    pub fn from(mut self, addrs: Vec<Address>) -> Self {
        self.from = addrs;
        self
    }
    pub fn to(mut self, addrs: Vec<Address>) -> Self {
        self.to = addrs;
        self
    }
    pub fn start_block(mut self, b: u64) -> Self {
        self.start = b;
        self
    }
    pub fn end_block(mut self, b: u64) -> Self {
        self.end = b;
        self
    }
    pub fn chunk_size(mut self, sz: u64) -> Self {
        self.chunk = sz;
        self
    }
    pub fn mode(mut self, m: TraceFilterMode) -> Self {
        self.mode = m;
        self
    }
    pub fn limits(mut self, max_span: u64, max_chunk: u64) -> Self {
        self.max_span = max_span;
        self.max_chunk = max_chunk;
        self
    }
    pub fn pagination(mut self, after: Option<u64>, count: Option<u64>) -> Self {
        self.after = after;
        self.count = count;
        self
    }

    pub fn plan(self) -> anyhow::Result<TraceFilterPlan> {
        let span = self.end.saturating_sub(self.start) + 1;
        if span > self.max_span {
            anyhow::bail!("range too large ({span} > {})", self.max_span);
        }
        let chunk = self.chunk.min(self.max_chunk).max(1);
        Ok(TraceFilterPlan {
            range: Range {
                from: self.start,
                to: self.end,
            },
            chunk_size: chunk,
            from: self.from,
            to: self.to,
            mode: Some(self.mode),
            after: self.after,
            count: self.count,
        })
    }
}
