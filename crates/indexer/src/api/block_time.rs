use crate::EthereumIndexer;
use crate::methods::eth::get_block_by_number as get_blk;
use alloy::rpc::types::eth::Block;
use alloy::rpc::types::eth::BlockNumberOrTag;

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
