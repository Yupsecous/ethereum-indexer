pub mod api;
pub mod exec;
pub mod methods;
pub mod order;
pub mod pool;
pub mod providers;

// API (builders)
pub use api::{EngineBuilder, TraceFilterBuilder, TxByHashBuilder, TxReceiptBuilder};

// Core types
pub use exec::{EthereumIndexer, OrderingKey, Range, WorkItem};
pub use pool::{ProviderPool, RpcStats};

// Utilities
pub use order::{chunk_range, order_by_range};
pub use providers::{build_rpc_clients, build_rpc_clients_with_retry};

// Method planners
pub use methods::trace_filter::TraceFilterPlan;
pub use methods::tx_by_hash::TxByHashPlan;
pub use methods::tx_receipt::TxReceiptPlan;
