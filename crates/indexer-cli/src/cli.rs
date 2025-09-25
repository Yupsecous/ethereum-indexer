use clap::{Parser, ValueEnum};

#[derive(Debug, Clone, ValueEnum)]
pub enum Method {
    #[value(name = "trace-filter")]
    TraceFilter,
    #[value(name = "get-block-by-number")]
    GetBlockByNumber,
    #[value(name = "get-transaction-by-hash")]
    GetTransactionByHash,
    #[value(name = "get-transaction-receipt")]
    GetTransactionReceipt,
}

#[derive(Parser)]
#[command(name = "Ethereum Indexer CLI")]
#[command(about = "Benchmarks Ethereum RPC methods using multiple endpoints")]
pub struct Config {
    #[arg(long = "method", value_enum)]
    pub method: Method,

    #[arg(long = "rpc", required = true)]
    pub rpcs: Vec<String>,

    #[arg(long = "target-address", required_if_eq("method", "trace-filter"))]
    pub target_address: Option<String>,

    #[arg(long = "hashes", required_if_eq_any([("method", "get-transaction-by-hash"), ("method", "get-transaction-receipt")]))]
    pub hashes: Vec<String>,

    #[arg(long = "start-block")]
    pub start_block: u64,

    #[arg(long = "end-block")]
    pub end_block: u64,

    #[arg(long = "chunk-size", default_value = "50")]
    pub chunk_size: u64,

    #[arg(long = "full")]
    pub full: bool,

    #[arg(long = "parallel-requests-per-rpc", default_value = "5")]
    pub parallel_requests_per_rpc: usize,
}
