use crate::{EthereumIndexer, api::eth::call, contracts::erc20::IERC20};
use alloy::{
    primitives::{Address, U256},
    rpc::types::eth::{BlockNumberOrTag, TransactionRequest},
    sol_types::SolCall,
};

pub async fn token_balance_at_block(
    idx: &EthereumIndexer,
    token: Address,
    owner: Address,
    at: BlockNumberOrTag,
) -> anyhow::Result<U256> {
    // Create the balanceOf call data
    let call_data = IERC20::balanceOfCall { owner }.abi_encode();

    let tx_request = TransactionRequest::default()
        .to(token)
        .input(call_data.into());

    let v = idx.run_once(call::work_one(tx_request, at)?).await?;
    let bytes = call::decode_bytes(v)?;
    let bal = IERC20::balanceOfCall::abi_decode_returns(&bytes)?;
    Ok(bal)
}
