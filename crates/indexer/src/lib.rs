pub mod api;
pub mod contracts;
pub mod exec;
pub mod methods;
pub mod order;
pub mod pool;
pub mod providers;

// API (builders)
pub use api::{
    BlockByNumberBuilder,
    EngineBuilder,
    TraceFilterBuilder,
    TxByHashBuilder,
    TxReceiptBuilder,
    balance::{OnMiss, balance_at_timestamp},
    // ergonomic helpers
    eth::get_balance::{GetBalanceBuilder, get_balance_at_block, get_balance_at_timestamp},
};

// Core types
pub use exec::{EthereumIndexer, OrderingKey, Range, WorkItem};
pub use pool::{ProviderPool, RpcStats};

// Utilities
pub use order::{chunk_range, order_by_range};
pub use providers::{build_rpc_clients, build_rpc_clients_with_retry};

// Method planners
pub use methods::eth::get_block_by_number::BlockByNumberPlan;
pub use methods::eth::get_logs::GetLogsPlan;
pub use methods::eth::get_transaction_by_hash::TxByHashPlan;
pub use methods::eth::get_transaction_receipt::TxReceiptPlan;
pub use methods::trace::filter::TraceFilterPlan;
