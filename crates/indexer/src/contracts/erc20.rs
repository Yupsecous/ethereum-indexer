use alloy::primitives::B256;
use alloy::sol;

/// Minimal ERC-20 interface with the `Transfer` event for decoding/topics.
sol! {
    #[allow(missing_docs)]
    interface IERC20 {
        event Transfer(address indexed from, address indexed to, uint256 value);
    }
}

/// Topic0 for `Transfer(address,address,uint256)`.
pub fn transfer_signature_topic() -> B256 {
    IERC20::Transfer::SIGNATURE_HASH
}

// Example decode usage:
//
// if let Ok(decoded) = IERC20::Transfer::decode_log(&log) {
//     let from = decoded.from;
//     let to   = decoded.to;
//     let val  = decoded.value;
// }
