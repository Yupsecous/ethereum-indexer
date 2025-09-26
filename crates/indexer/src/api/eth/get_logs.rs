use crate::{
    exec::{Range, WorkItem},
    methods::eth::get_logs::{GetLogsPlan, Topic, helpers},
};
use alloy::primitives::{Address, B256};

/// General `eth_getLogs` builder.
#[derive(Clone, Debug)]
pub struct GetLogsBuilder {
    from: u64,
    to: u64,
    chunk_size: u64,
    addresses: Vec<Address>,
    topics: Vec<Topic>, // up to 4
    // guards
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
    pub fn topic_or(mut self, slot: usize, mut ts: Vec<B256>) -> Self {
        if slot < 4 {
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

/// ERC-20 transfers *to/from* a wallet, split lanes (FROM & TO).
#[derive(Clone, Debug)]
pub struct Erc20WalletTransfersBuilder {
    watched: Address,
    from: u64,
    to: u64,
    chunk_size: u64,
    tokens: Vec<Address>, // optional allow-list; empty = any token
    // guards
    max_blocks: u64,
    max_tokens: usize,
    // topic0 for Transfer
    transfer_sig: B256,
}

impl Erc20WalletTransfersBuilder {
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

    // Build two batches (FROM lane, TO lane) plus base range.
    pub fn plan_split(self) -> anyhow::Result<(Vec<WorkItem>, Vec<WorkItem>, Range)> {
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

        let base_range = Range {
            from: self.from,
            to: self.to,
        };

        // Build topics for each lane
        let topics_from = helpers::erc20_transfer_from(self.transfer_sig, self.watched);
        let topics_to = helpers::erc20_transfer_to(self.transfer_sig, self.watched);

        // Materialize each lane into WorkItems
        let build = |topics: [Topic; 4]| -> anyhow::Result<Vec<WorkItem>> {
            GetLogsPlan {
                range: base_range,
                chunk_size: self.chunk_size,
                addresses: self.tokens.clone(), // empty => any token
                topics: topics.to_vec(),
            }
            .plan()
        };

        let from_items = build(topics_from)?;
        let to_items = build(topics_to)?;
        Ok((from_items, to_items, base_range))
    }
    // Convenience: merged (FROM ∪ TO) in one vector.
    pub fn plan(self) -> anyhow::Result<(Vec<WorkItem>, Range)> {
        let (mut from_items, to_items, range) = self.plan_split()?;
        from_items.extend(to_items);
        Ok((from_items, range))
    }
}

/// ALL transfers of a *token contract* over [from..to].
#[derive(Clone, Debug)]
pub struct Erc20TokenTransfersBuilder {
    token: Address, // token contract (goes into `address` filter)
    from: u64,
    to: u64,
    chunk_size: u64,
    transfer_sig: B256, // topic0
    max_blocks: u64,
}

impl Erc20TokenTransfersBuilder {
    pub fn new(token: Address, from: u64, to: u64, transfer_sig: B256) -> Self {
        Self {
            token,
            from,
            to,
            chunk_size: 10_000,
            transfer_sig,
            max_blocks: 1_000_000,
        }
    }
    pub fn chunk_size(mut self, n: u64) -> Self {
        self.chunk_size = n.max(1);
        self
    }
    pub fn limit_blocks(mut self, n: u64) -> Self {
        self.max_blocks = n.max(1);
        self
    }

    pub fn plan(self) -> anyhow::Result<(Vec<WorkItem>, Range)> {
        if self.to < self.from {
            anyhow::bail!("invalid range: to < from");
        }
        let blocks = self.to - self.from + 1;
        if blocks > self.max_blocks {
            anyhow::bail!("range too large");
        }

        let range = Range {
            from: self.from,
            to: self.to,
        };
        let plan = GetLogsPlan {
            range,
            chunk_size: self.chunk_size,
            addresses: vec![self.token], // filter by token contract
            topics: vec![Topic::One(self.transfer_sig)], // topic0 = Transfer; topic1/2 Any
        };
        Ok((plan.plan()?, range))
    }
}
