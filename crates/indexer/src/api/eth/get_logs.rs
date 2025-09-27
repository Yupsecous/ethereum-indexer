use crate::{
    exec::Range,
    methods::eth::get_logs::{GetLogsPlan, Topic},
};
use alloy::primitives::{Address, B256};

#[derive(Clone, Debug)]
pub struct GetLogsBuilder {
    from: u64,
    to: u64,
    chunk_size: u64,
    addresses: Vec<Address>,
    topics: Vec<Topic>,
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

/// Wallet-centric: transfers where `watched` is `from` **or** `to`.
#[derive(Clone, Debug)]
pub struct Erc20WalletTransfersBuilder {
    watched: Address,
    from: u64,
    to: u64,
    chunk_size: u64,
    tokens: Vec<Address>, // optional allow-list
    max_blocks: u64,
    max_tokens: usize,
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

        use crate::contracts::erc20::{TRANSFER_SIG, indexed_address_topic};
        let sig = if self.transfer_sig == B256::ZERO {
            TRANSFER_SIG
        } else {
            self.transfer_sig
        };

        // FROM lane
        let from_topics = vec![
            Topic::One(sig),
            Topic::One(indexed_address_topic(self.watched)),
            Topic::Any,
            Topic::Any,
        ];
        // TO lane
        let to_topics = vec![
            Topic::One(sig),
            Topic::Any,
            Topic::One(indexed_address_topic(self.watched)),
            Topic::Any,
        ];

        let base = GetLogsPlan {
            range: Range {
                from: self.from,
                to: self.to,
            },
            chunk_size: self.chunk_size,
            addresses: self.tokens.clone(), // empty => any token
            topics: vec![],
        };

        let mut out = Vec::new();
        out.extend(
            GetLogsPlan {
                topics: from_topics.clone(),
                ..base.clone()
            }
            .plan()?,
        );
        out.extend(
            GetLogsPlan {
                topics: to_topics.clone(),
                ..base
            }
            .plan()?,
        );
        Ok(out)
    }

    /// Ergonomic API: returns separate work items for FROM and TO lanes
    pub fn plan_split(self) -> anyhow::Result<(Vec<crate::exec::WorkItem>, Vec<crate::exec::WorkItem>, Range)> {
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

        use crate::contracts::erc20::{TRANSFER_SIG, indexed_address_topic};
        let sig = if self.transfer_sig == B256::ZERO {
            TRANSFER_SIG
        } else {
            self.transfer_sig
        };

        let range = Range {
            from: self.from,
            to: self.to,
        };

        // FROM lane
        let from_topics = vec![
            Topic::One(sig),
            Topic::One(indexed_address_topic(self.watched)),
            Topic::Any,
            Topic::Any,
        ];
        // TO lane
        let to_topics = vec![
            Topic::One(sig),
            Topic::Any,
            Topic::One(indexed_address_topic(self.watched)),
            Topic::Any,
        ];

        let base = GetLogsPlan {
            range: range.clone(),
            chunk_size: self.chunk_size,
            addresses: self.tokens.clone(), // empty => any token
            topics: vec![],
        };

        let from_items = GetLogsPlan {
            topics: from_topics,
            ..base.clone()
        }
        .plan()?;

        let to_items = GetLogsPlan {
            topics: to_topics,
            ..base
        }
        .plan()?;

        Ok((from_items, to_items, range))
    }
}

/// Token-centric: **all** transfers of a specific token contract.
#[derive(Clone, Debug)]
pub struct Erc20TokenTransfersBuilder {
    token: Address,
    from: u64,
    to: u64,
    chunk_size: u64,
    max_blocks: u64,
    transfer_sig: B256,
}
impl Erc20TokenTransfersBuilder {
    pub fn new(token: Address, from: u64, to: u64, transfer_sig: B256) -> Self {
        Self {
            token,
            from,
            to,
            chunk_size: 10_000,
            max_blocks: 1_000_000,
            transfer_sig,
        }
    }
    pub fn chunk_size(mut self, n: u64) -> Self {
        self.chunk_size = n.max(1);
        self
    }
    pub fn limits(mut self, max_blocks: u64) -> Self {
        self.max_blocks = max_blocks.max(1);
        self
    }

    /// Ergonomic API: returns work items and range directly
    pub fn plan(self) -> anyhow::Result<(Vec<crate::exec::WorkItem>, Range)> {
        if self.to < self.from {
            anyhow::bail!("invalid range: to < from");
        }
        let blocks = self.to - self.from + 1;
        if blocks > self.max_blocks {
            anyhow::bail!("range too large");
        }

        use crate::contracts::erc20::TRANSFER_SIG;
        let sig = if self.transfer_sig == B256::ZERO {
            TRANSFER_SIG
        } else {
            self.transfer_sig
        };

        let range = Range {
            from: self.from,
            to: self.to,
        };

        let plan = GetLogsPlan {
            range: range.clone(),
            chunk_size: self.chunk_size,
            addresses: vec![self.token], // filter by contract
            topics: vec![Topic::One(sig), Topic::Any, Topic::Any, Topic::Any],
        };

        let work_items = plan.plan()?;
        Ok((work_items, range))
    }
}
