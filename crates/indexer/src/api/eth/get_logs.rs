use crate::{
    exec::Range,
    methods::eth::get_logs::{GetLogsPlan, Topic},
};
use alloy::primitives::{Address, B256};

/// General-purpose `eth_getLogs` builder (chunked, parallelizable).
#[derive(Clone, Debug)]
pub struct GetLogsBuilder {
    from: u64,
    to: u64,
    chunk_size: u64,
    addresses: Vec<Address>,
    topics: Vec<Topic>, // 0..=3; missing -> null
    // safety
    max_blocks: u64,
    max_addresses: usize,
    max_topic_or: usize,
}

impl GetLogsBuilder {
    pub fn new(from: u64, to: u64) -> Self {
        Self {
            from,
            to,
            chunk_size: 5_000,
            addresses: vec![],
            topics: vec![],
            max_blocks: 1_000_000,
            max_addresses: 1024,
            max_topic_or: 64,
        }
    }

    pub fn chunk_size(mut self, n: u64) -> Self {
        self.chunk_size = n.max(1);
        self
    }
    pub fn address(mut self, a: Address) -> Self {
        self.addresses.push(a);
        self
    }
    pub fn addresses(mut self, v: Vec<Address>) -> Self {
        self.addresses = v;
        self
    }

    pub fn topic_any(mut self, slot: usize) -> Self {
        if slot < 4 {
            // ensure capacity up to slot
            if self.topics.len() <= slot {
                self.topics.resize(slot + 1, Topic::Any);
            }
            self.topics[slot] = Topic::Any;
        }
        self
    }

    pub fn topic_one(mut self, slot: usize, t: B256) -> Self {
        if slot < 4 {
            if self.topics.len() <= slot {
                self.topics.resize(slot + 1, Topic::Any);
            }
            self.topics[slot] = Topic::One(t);
        }
        self
    }

    pub fn topic_or(mut self, slot: usize, ts: Vec<B256>) -> Self {
        if slot < 4 {
            let mut ts = ts;
            if ts.len() > self.max_topic_or {
                ts.truncate(self.max_topic_or);
            }
            if self.topics.len() <= slot {
                self.topics.resize(slot + 1, Topic::Any);
            }
            self.topics[slot] = Topic::Or(ts);
        }
        self
    }

    pub fn limits(mut self, max_blocks: u64, max_addresses: usize, max_topic_or: usize) -> Self {
        self.max_blocks = max_blocks.max(1);
        self.max_addresses = max_addresses.max(1);
        self.max_topic_or = max_topic_or.max(1);
        self
    }

    pub fn plan(self) -> anyhow::Result<GetLogsPlan> {
        if self.to < self.from {
            anyhow::bail!("invalid range: to < from");
        }
        let blocks = self.to - self.from + 1;
        if blocks > self.max_blocks {
            anyhow::bail!("range too large: {blocks} > {}", self.max_blocks);
        }
        if self.addresses.len() > self.max_addresses {
            anyhow::bail!("too many contract addresses");
        }

        Ok(GetLogsPlan {
            range: Range {
                from: self.from,
                to: self.to,
            },
            chunk_size: self.chunk_size,
            addresses: self.addresses,
            topics: self.topics,
        })
    }
}

/// Convenience: ERC-20 transfers (both directions) for a watched address.
/// If `tokens` is non-empty, we filter `address` by those token contracts.
#[derive(Clone, Debug)]
pub struct Erc20TransfersBuilder {
    watched: Address,
    from: u64,
    to: u64,
    chunk_size: u64,
    tokens: Vec<Address>, // optional allow-list
    max_blocks: u64,
    max_tokens: usize,
    transfer_sig: B256, // topic0 for Transfer
}

impl Erc20TransfersBuilder {
    pub fn new(watched: Address, from: u64, to: u64, transfer_sig: B256) -> Self {
        Self {
            watched,
            from,
            to,
            chunk_size: 10_000,
            tokens: vec![],
            max_blocks: 1_000_000,
            max_tokens: 50_000,
            transfer_sig,
        }
    }

    pub fn chunk_size(mut self, n: u64) -> Self {
        self.chunk_size = n.max(1);
        self
    }
    pub fn tokens(mut self, addrs: Vec<Address>) -> Self {
        self.tokens = addrs;
        self
    }
    pub fn limits(mut self, max_blocks: u64, max_tokens: usize) -> Self {
        self.max_blocks = max_blocks.max(1);
        self.max_tokens = max_tokens.max(1);
        self
    }

    /// Builds *two* `eth_getLogs` batches (FROM and TO) merged into one Vec<WorkItem>.
    pub fn work_items(self) -> anyhow::Result<Vec<crate::exec::WorkItem>> {
        if self.to < self.from {
            anyhow::bail!("invalid range: to < from");
        }
        let blocks = self.to - self.from + 1;
        if blocks > self.max_blocks {
            anyhow::bail!("range too large");
        }
        if self.tokens.len() > self.max_tokens {
            anyhow::bail!("too many token addresses");
        }

        // FROM=watched
        let mut from_topics: Vec<Topic> = Vec::with_capacity(4);
        from_topics.push(Topic::One(self.transfer_sig));
        from_topics.push(Topic::One(
            super::super::super::methods::eth::get_logs::helpers::address_topic(self.watched),
        ));
        from_topics.push(Topic::Any);
        from_topics.push(Topic::Any);

        // TO=watched
        let mut to_topics: Vec<Topic> = Vec::with_capacity(4);
        to_topics.push(Topic::One(self.transfer_sig));
        to_topics.push(Topic::Any);
        to_topics.push(Topic::One(
            super::super::super::methods::eth::get_logs::helpers::address_topic(self.watched),
        ));
        to_topics.push(Topic::Any);

        let base_range = Range {
            from: self.from,
            to: self.to,
        };

        // Helper to materialize GetLogsPlan → WorkItems with a given topic vector
        let build = |topics: Vec<Topic>| -> anyhow::Result<Vec<crate::exec::WorkItem>> {
            let plan = GetLogsPlan {
                range: base_range,
                chunk_size: self.chunk_size,
                addresses: self.tokens.clone(), // if empty, no contract filter
                topics,
            };
            plan.plan()
        };

        let mut out = Vec::new();
        out.extend(build(from_topics)?);
        out.extend(build(to_topics)?);
        Ok(out)
    }
}
