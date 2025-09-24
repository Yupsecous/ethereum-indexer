use clap::Parser;

#[derive(Parser)]
#[command(name = "Transaction Trace Analyzer")]
#[command(about = "Analyzes non-internal transactions using multiple RPC endpoints")]
pub struct Config {
    #[arg(long = "rpc", required = true)]
    pub rpcs: Vec<String>,

    #[arg(long = "target-address")]
    pub target_address: String,

    #[arg(long = "start-block")]
    pub start_block: u64,

    #[arg(long = "end-block")]
    pub end_block: u64,

    #[arg(long = "chunk-size", default_value = "50")]
    pub chunk_size: u64,

    #[arg(long = "parallel-requests-per-rpc", default_value = "5")]
    pub parallel_requests_per_rpc: usize,
}
