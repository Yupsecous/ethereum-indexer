use crate::EthereumIndexer;
use crate::methods::eth::get_balance as get_bal;
use alloy::{
    primitives::{Address, U256},
    rpc::types::eth::BlockNumberOrTag,
};

pub async fn balance_at_timestamp(
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
