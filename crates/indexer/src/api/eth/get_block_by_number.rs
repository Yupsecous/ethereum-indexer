use crate::methods::eth::get_block_by_number::BlockByNumberPlan;
use alloy::rpc::types::eth::BlockNumberOrTag;

#[derive(Clone, Debug)]
pub struct BlockByNumberBuilder {
    numbers: Vec<BlockNumberOrTag>,
    start: Option<u64>,
    end: Option<u64>,
    full: bool, // default true
    max_count: usize,
}

impl BlockByNumberBuilder {
    pub fn new() -> Self {
        Self {
            numbers: Vec::new(),
            start: None,
            end: None,
            full: true, // default to full tx objects
            max_count: 10_000,
        }
    }

    pub fn push(mut self, n: BlockNumberOrTag) -> Self {
        self.numbers.push(n);
        self
    }
    pub fn numbers(mut self, ns: Vec<BlockNumberOrTag>) -> Self {
        self.numbers = ns;
        self
    }
    pub fn range(mut self, start: u64, end: u64) -> Self {
        self.start = Some(start);
        self.end = Some(end);
        self
    }

    /// Explicitly set full mode (true = tx objects, false = hashes only).
    pub fn full(mut self, yes: bool) -> Self {
        self.full = yes;
        self
    }

    /// Convenience: request only hashes
    pub fn hashes_only(self) -> Self {
        self.full(false)
    }

    pub fn limit(mut self, max: usize) -> Self {
        self.max_count = max.max(1);
        self
    }

    pub fn plan(mut self) -> anyhow::Result<BlockByNumberPlan> {
        if let (Some(s), Some(e)) = (self.start, self.end) {
            if e < s {
                anyhow::bail!("invalid range: end < start");
            }
            self.numbers.extend((s..=e).map(BlockNumberOrTag::Number));
        }
        if self.numbers.len() > self.max_count {
            anyhow::bail!(
                "too many block queries ({} > {})",
                self.numbers.len(),
                self.max_count
            );
        }
        Ok(BlockByNumberPlan {
            numbers: self.numbers,
            full: self.full,
        })
    }
}
