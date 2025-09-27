use crate::{
    EthereumIndexer,
    contracts::erc20::{self, IERC20},
    methods::eth::call as eth_call,
};
use alloy::primitives::{Address, U256};
use alloy::rpc::types::eth::BlockNumberOrTag;

pub async fn token_balance_at_block(
    idx: &EthereumIndexer,
    token: Address,
    owner: Address,
    at: BlockNumberOrTag,
) -> anyhow::Result<U256> {
    let call = erc20::balance_of_call(token, owner);
    let v = idx.run_once(eth_call::work_one(call, at)?).await?;
    let bytes = eth_call::decode_bytes(v)?;
    let (bal,): (U256,) = IERC20::balanceOfCall::abi_decode_returns(&bytes, true)?;
    Ok(bal)
}
