//! Ergonomic API for eth_getBalance.
//! - Single-call builder for "at block/tag" or "at timestamp".
//! - Uses methods layer for the raw JSON-RPC shape (consistent with the rest).

use alloy::primitives::{Address, U256};
use alloy::rpc::types::eth::BlockNumberOrTag;
use anyhow::{anyhow, bail};

use crate::EthereumIndexer;
use crate::api::block_time::block_at_or_before_ts;
use crate::methods::eth::get_balance as m_balance;

/// Builder for fetching one address balance, either at a block/tag, or at a timestamp.
///
/// `plan()` is only available for the "at block/tag" case (pure planner).
/// `execute()` works for both (does IO via the engine).
#[derive(Clone, Debug)]
pub struct GetBalanceBuilder {
    addr: Address,
    at: At,
}

#[derive(Clone, Debug)]
enum At {
    Block(BlockNumberOrTag),
    Timestamp { ts_sec: u64, lo: u64, hi: u64 },
}

impl GetBalanceBuilder {
    /// Start a builder with default `latest`.
    pub fn new(addr: Address) -> Self {
        Self {
            addr,
            at: At::Block(BlockNumberOrTag::Latest),
        }
    }

    /// Set the query to a specific block number or tag (latest/earliest/pending/safe/finalized).
    pub fn at_block(mut self, n: BlockNumberOrTag) -> Self {
        self.at = At::Block(n);
        self
    }

    /// Set the query to the balance at a wall-clock timestamp (seconds since epoch).
    /// You must provide bounds later via `.bounds(lo, hi)`.
    pub fn at_timestamp(mut self, ts_sec: u64) -> Self {
        self.at = At::Timestamp {
            ts_sec,
            lo: 0,
            hi: 0,
        };
        self
    }

    /// Bounds for the timestamp search (inclusive). Required for `.at_timestamp(...)`.
    pub fn bounds(mut self, lo: u64, hi: u64) -> Self {
        if let At::Timestamp { ts_sec, .. } = self.at {
            self.at = At::Timestamp { ts_sec, lo, hi };
        }
        self
    }

    /// Pure planner (no IO) — only valid for the "block/tag" case.
    /// Returns a plan you can feed into the engine’s `run(...)` for batching.
    pub fn plan(self) -> anyhow::Result<m_balance::GetBalancePlan> {
        match self.at {
            At::Block(n) => Ok(m_balance::GetBalancePlan {
                queries: vec![(self.addr, n)],
            }),
            At::Timestamp { .. } => {
                bail!("plan() is not supported for timestamp; call `execute(&indexer).await`")
            }
        }
    }

    /// Execute the request immediately via the engine.
    /// - For block/tag: one RPC call.
    /// - For timestamp: binary-search the block, then call eth_getBalance at that block.
    pub async fn execute(self, idx: &EthereumIndexer) -> anyhow::Result<U256> {
        match self.at {
            At::Block(n) => {
                let item = m_balance::work_one(self.addr, n)?;
                let v = idx.run_once(item).await?;
                m_balance::GetBalancePlan::decode(v)
            }
            At::Timestamp { ts_sec, lo, hi } => {
                if lo == 0 && hi == 0 {
                    bail!("timestamp query requires bounds: call `.bounds(lo, hi)`");
                }
                let blk = block_at_or_before_ts(idx, ts_sec, lo, hi)
                    .await?
                    .ok_or_else(|| anyhow!("no block at or before {ts_sec} within [{lo}, {hi}]"))?;
                let n = BlockNumberOrTag::Number(blk.header.number);
                let item = m_balance::work_one(self.addr, n)?;
                let v = idx.run_once(item).await?;
                m_balance::GetBalancePlan::decode(v)
            }
        }
    }
}

// Convenience one-shots if you don’t want the builder:
pub async fn get_balance_at_block(
    idx: &EthereumIndexer,
    addr: Address,
    n: BlockNumberOrTag,
) -> anyhow::Result<U256> {
    GetBalanceBuilder::new(addr).at_block(n).execute(idx).await
}

pub async fn get_balance_at_timestamp(
    idx: &EthereumIndexer,
    addr: Address,
    ts_sec: u64,
    lo: u64,
    hi: u64,
) -> anyhow::Result<U256> {
    GetBalanceBuilder::new(addr)
        .at_timestamp(ts_sec)
        .bounds(lo, hi)
        .execute(idx)
        .await
}
