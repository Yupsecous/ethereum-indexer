use crate::EthereumIndexer;
use crate::methods::eth::get_block_by_number as get_blk;
use alloy::rpc::types::eth::Block;
use alloy::rpc::types::eth::BlockNumberOrTag;

#[derive(Debug)]
pub enum RangeMiss {
    BeforeRange { t: u64, lo: u64, lo_ts: u64 },
    AfterRange { t: u64, hi: u64, hi_ts: u64 },
}

impl std::fmt::Display for RangeMiss {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            RangeMiss::BeforeRange { t, lo, lo_ts } => {
                write!(f, "timestamp is before range: t={t}, lo={lo} (ts={lo_ts})")
            }
            RangeMiss::AfterRange { t, hi, hi_ts } => {
                write!(f, "timestamp is after range: t={t}, hi={hi} (ts={hi_ts})")
            }
        }
    }
}

impl std::error::Error for RangeMiss {}

pub async fn block_at_or_before_ts_strict(
    idx: &EthereumIndexer,
    t: u64,
    lo: u64,
    hi: u64,
) -> anyhow::Result<Result<Block, RangeMiss>> {
    // Preflight: timestamps at bounds (2 calls)
    let blo_val = idx
        .run_once(get_blk::work_one(BlockNumberOrTag::Number(lo), false)?)
        .await?;
    let bhi_val = idx
        .run_once(get_blk::work_one(BlockNumberOrTag::Number(hi), false)?)
        .await?;

    let blo: Option<Block> = get_blk::BlockByNumberPlan::decode(blo_val)?;
    let bhi: Option<Block> = get_blk::BlockByNumberPlan::decode(bhi_val)?;

    let (blo, bhi) = match (blo, bhi) {
        (Some(blo), Some(bhi)) => (blo, bhi),
        _ => anyhow::bail!("boundary block(s) missing"),
    };

    let lo_ts = blo.header.timestamp;
    let hi_ts = bhi.header.timestamp;

    if t < lo_ts {
        return Ok(Err(RangeMiss::BeforeRange { t, lo, lo_ts }));
    }
    if t > hi_ts {
        return Ok(Err(RangeMiss::AfterRange { t, hi, hi_ts }));
    }

    // Binary search in [lo, hi] to find the greatest block with ts <= t
    let (mut l, mut r) = (lo, hi);
    let mut best = blo; // safe: blo.ts <= t
    while l <= r {
        let mid = l + ((r - l) / 2);
        let bm_val = idx
            .run_once(get_blk::work_one(BlockNumberOrTag::Number(mid), false)?)
            .await?;
        let bm: Option<Block> = get_blk::BlockByNumberPlan::decode(bm_val)?;
        let bm = match bm {
            Some(bm) => bm,
            None => anyhow::bail!("mid block {mid} missing"),
        };
        if bm.header.timestamp <= t {
            best = bm;
            l = mid.saturating_add(1);
        } else {
            r = mid.saturating_sub(1);
        }
    }
    Ok(Ok(best))
}

pub async fn block_at_or_before_ts(
    idx: &EthereumIndexer,
    t_sec: u64,
    mut lo: u64,
    mut hi: u64,
) -> anyhow::Result<Option<Block>> {
    if lo > hi {
        return Ok(None);
    }

    // optional quick bound check with hi/lo
    let hi_blk = idx
        .run_once(get_blk::work_one(BlockNumberOrTag::Number(hi), false)?)
        .await?;
    let hi_blk: Option<Block> = get_blk::BlockByNumberPlan::decode(hi_blk)?;
    let hi_ts = match &hi_blk {
        Some(b) => b.header.timestamp,
        None => return Ok(None),
    };
    if hi_ts < t_sec {
        return Ok(hi_blk);
    }

    let lo_blk = idx
        .run_once(get_blk::work_one(BlockNumberOrTag::Number(lo), false)?)
        .await?;
    let lo_blk: Option<Block> = get_blk::BlockByNumberPlan::decode(lo_blk)?;
    let lo_ts = match &lo_blk {
        Some(b) => b.header.timestamp,
        None => return Ok(None),
    };
    if lo_ts > t_sec {
        return Ok(None);
    }

    while lo + 1 < hi {
        let mid = (lo + hi) / 2;
        let v = idx
            .run_once(get_blk::work_one(BlockNumberOrTag::Number(mid), false)?)
            .await?;
        let mb: Option<Block> = get_blk::BlockByNumberPlan::decode(v)?;
        let ts = mb.as_ref().map(|b| b.header.timestamp).unwrap_or(0);
        if ts <= t_sec {
            lo = mid;
        } else {
            hi = mid;
        }
    }

    // return lo
    let v = idx
        .run_once(get_blk::work_one(BlockNumberOrTag::Number(lo), false)?)
        .await?;
    get_blk::BlockByNumberPlan::decode(v)
}
