use crate::methods::eth::get_block_by_number::BlockByNumberPlan;
use alloy::rpc::types::eth::BlockNumberOrTag;

#[derive(Clone, Debug)]
pub struct BlockByNumberBuilder {
    numbers: Vec<BlockNumberOrTag>,
    from: Option<u64>,
    to: Option<u64>,
    full: bool, // default: true = full tx objects
    max_count: usize,
}

impl BlockByNumberBuilder {
    pub fn new() -> Self {
        Self {
            numbers: Vec::new(),
            from: None,
            to: None,
            full: true,
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
        self.from = Some(start);
        self.to = Some(end);
        self
    }

    pub fn push_number(self, n: u64) -> Self {
        self.push(BlockNumberOrTag::Number(n))
    }
    pub fn earliest(self) -> Self {
        self.push(BlockNumberOrTag::Earliest)
    }
    pub fn latest(self) -> Self {
        self.push(BlockNumberOrTag::Latest)
    }
    pub fn safe(self) -> Self {
        self.push(BlockNumberOrTag::Safe)
    }
    pub fn finalized(self) -> Self {
        self.push(BlockNumberOrTag::Finalized)
    }
    pub fn pending(self) -> Self {
        self.push(BlockNumberOrTag::Pending)
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
        if let (Some(s), Some(e)) = (self.from, self.to) {
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
