use alloy::{
    primitives::{Address, B256, Log as PrimLog, LogData},
    sol,
    sol_types::SolEvent,
};

sol! {
    interface IERC20 {
        event Transfer(address indexed from, address indexed to, uint256 value);
        function balanceOf(address owner) external view returns (uint256);
        function decimals() external view returns (uint8);
    }
}

pub const TRANSFER_SIG: B256 = IERC20::Transfer::SIGNATURE_HASH;

/// Encode an indexed address into a topic (right-aligned 20 bytes).
pub fn indexed_address_topic(addr: Address) -> B256 {
    let mut b = [0u8; 32];
    b[12..].copy_from_slice(addr.as_slice());
    b.into()
}

/// Optional: decode an RPC log as ERC-20 Transfer (handy for CLI/demo paths).
pub fn decode_transfer_from_rpc(rpc_log: &alloy::rpc::types::eth::Log) -> Option<IERC20::Transfer> {
    let data = LogData::new(rpc_log.topics().to_vec(), rpc_log.data().data.clone())?;
    let prim = PrimLog {
        address: rpc_log.address(),
        data,
    };
    IERC20::Transfer::decode_log(&prim).ok().map(|log| log.data)
}
