use crate::EthereumIndexer;
use crate::api::block_time::{RangeMiss, block_at_or_before_ts_strict};
use crate::methods::eth::get_balance as get_bal;
use alloy::{
    primitives::{Address, U256},
    rpc::types::eth::BlockNumberOrTag,
};

#[derive(Debug, Clone)]
pub enum OnMiss {
    Strict,            // propagate RangeMiss
    ClampToBounds,     // return balance at lo/hi
    AutoWidenToLatest, // widen hi to latest and retry once
}

pub async fn balance_at_timestamp(
    idx: &EthereumIndexer,
    addr: Address,
    t_sec: u64,
    mut lo: u64,
    mut hi: u64,
    on_miss: OnMiss,
) -> anyhow::Result<Option<U256>> {
    use crate::methods::eth::get_block_by_number as get_block;

    match block_at_or_before_ts_strict(idx, t_sec, lo, hi).await? {
        Ok(b) => {
            tracing::info!(
                "Found block {} (timestamp: {}) for target timestamp {}",
                b.header.number,
                b.header.timestamp,
                t_sec
            );
            let v = idx
                .run_once(get_bal::work_one(
                    addr,
                    BlockNumberOrTag::Number(b.header.number),
                )?)
                .await?;
            return Ok(Some(get_bal::GetBalancePlan::decode(v)?));
        }
        Err(RangeMiss::BeforeRange { t, lo, lo_ts }) => {
            tracing::warn!(
                "Timestamp {} is before range: block {} has timestamp {}",
                t,
                lo,
                lo_ts
            );
            match on_miss {
                OnMiss::Strict => return Ok(None),
                OnMiss::ClampToBounds => {
                    tracing::info!("Clamping to block {} (lo bound)", lo);
                    let v = idx
                        .run_once(get_bal::work_one(addr, BlockNumberOrTag::Number(lo))?)
                        .await?;
                    return Ok(Some(get_bal::GetBalancePlan::decode(v)?));
                }
                OnMiss::AutoWidenToLatest => {
                    tracing::info!(
                        "Target timestamp is before range - cannot widen downward, returning None"
                    );
                    return Ok(None);
                }
            }
        }
        Err(RangeMiss::AfterRange {
            t,
            hi: hi_bound,
            hi_ts,
        }) => {
            tracing::warn!(
                "Timestamp {} is after range: block {} has timestamp {}",
                t,
                hi_bound,
                hi_ts
            );
            match on_miss {
                OnMiss::Strict => return Ok(None),
                OnMiss::ClampToBounds => {
                    tracing::info!("Clamping to block {} (hi bound)", hi_bound);
                    let v = idx
                        .run_once(get_bal::work_one(addr, BlockNumberOrTag::Number(hi_bound))?)
                        .await?;
                    return Ok(Some(get_bal::GetBalancePlan::decode(v)?));
                }
                OnMiss::AutoWidenToLatest => {
                    tracing::info!("Auto-widening range to latest block");
                    // widen hi to latest/finalized once
                    let latest_val = idx
                        .run_once(get_block::work_one(BlockNumberOrTag::Finalized, false)?)
                        .await?;
                    let latest: Option<alloy::rpc::types::eth::Block> =
                        get_block::BlockByNumberPlan::decode(latest_val)?;
                    let latest =
                        latest.ok_or_else(|| anyhow::anyhow!("latest/finalized block missing"))?;

                    lo = hi_bound.saturating_add(1);
                    hi = latest.header.number;
                    tracing::info!("Widened range: {} to {}", lo, hi);
                    if lo > hi {
                        tracing::info!("Nothing to widen into; clamping to latest block {}", hi);
                        let v = idx
                            .run_once(get_bal::work_one(addr, BlockNumberOrTag::Number(hi))?)
                            .await?;
                        return Ok(Some(get_bal::GetBalancePlan::decode(v)?));
                    }
                    // Retry once within widened window
                    tracing::info!("Retrying search in widened range {} to {}", lo, hi);
                    if let Ok(b) = block_at_or_before_ts_strict(idx, t_sec, lo, hi).await? {
                        tracing::info!(
                            "Found block {} (timestamp: {}) in widened range",
                            b.header.number,
                            b.header.timestamp
                        );
                        let v = idx
                            .run_once(get_bal::work_one(
                                addr,
                                BlockNumberOrTag::Number(b.header.number),
                            )?)
                            .await?;
                        return Ok(Some(get_bal::GetBalancePlan::decode(v)?));
                    }
                    // If still a miss after widening, clamp to latest
                    tracing::info!(
                        "Still no match after widening, clamping to latest block {}",
                        hi
                    );
                    let v = idx
                        .run_once(get_bal::work_one(addr, BlockNumberOrTag::Number(hi))?)
                        .await?;
                    Ok(Some(get_bal::GetBalancePlan::decode(v)?))
                }
            }
        }
    }
}

// initial function might be removed in future commits
pub async fn balance_at_timestamp_legacy(
    idx: &EthereumIndexer,
    addr: Address,
    t_sec: u64,
    lo: u64,
    hi: u64,
) -> anyhow::Result<Option<U256>> {
    let mb = super::block_time::block_at_or_before_ts(idx, t_sec, lo, hi).await?;
    let Some(b) = mb else {
        return Ok(None);
    };

    let v = idx
        .run_once(get_bal::work_one(
            addr,
            BlockNumberOrTag::Number(b.header.number),
        )?)
        .await?;
    let bal = get_bal::GetBalancePlan::decode(v)?;
    Ok(Some(bal))
}
