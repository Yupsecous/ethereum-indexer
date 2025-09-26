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
    #[value(name = "get-balance")]
    GetBalance,
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

    #[arg(long = "address", required_if_eq("method", "get-balance"))]
    pub address: Option<String>,

    #[arg(
        long = "date",
        required_if_eq("method", "get-balance"),
        help = "Date in YYYY-MM-DD format"
    )]
    pub date: Option<String>,

    #[arg(
        long = "block-range-lo",
        help = "Lower bound for block search (optional, will be estimated if not provided)"
    )]
    pub block_range_lo: Option<u64>,

    #[arg(
        long = "block-range-hi",
        help = "Upper bound for block search (optional, defaults to latest)"
    )]
    pub block_range_hi: Option<u64>,

    #[arg(long = "tag", conflicts_with_all = ["from", "to", "numbers"])]
    pub tag: Option<String>,

    #[arg(long = "numbers", conflicts_with_all = ["from", "to", "tag"])]
    pub numbers: Vec<u64>,

    #[arg(long = "from")]
    pub from: Option<u64>,

    #[arg(long = "to")]
    pub to: Option<u64>,

    #[arg(long = "chunk-size", default_value = "50")]
    pub chunk_size: u64,

    #[arg(long = "full")]
    pub full: bool,

    #[arg(long = "parallel-requests-per-rpc", default_value = "5")]
    pub parallel_requests_per_rpc: usize,
}
