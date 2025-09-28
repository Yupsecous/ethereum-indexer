use serde::{Deserialize, Serialize};

#[derive(Serialize)]
pub struct PingResponse {
    pub message: String,
}

#[derive(Deserialize)]
pub struct TraceFilterQuery {
    pub startblock: Option<u64>,
    pub endblock: Option<u64>,
}

#[derive(Debug, Deserialize)]
pub struct BlockByNumberQuery {
    pub from: Option<u64>,
    pub to: Option<u64>,
    pub full: Option<bool>,
}

#[derive(Debug, Deserialize)]
pub struct BalanceQuery {
    pub block_range_lo: Option<u64>,
    pub block_range_hi: Option<u64>,
    pub on_miss: Option<String>,
}

#[derive(Serialize)]
pub struct BalanceResponse {
    pub address: String,
    pub date: String,
    pub timestamp: u64,
    pub block_number: Option<u64>,
    pub block_timestamp: Option<u64>,
    pub balance_wei: String,
    pub balance_eth: String,
}

#[derive(Serialize)]
pub struct Erc20BalanceResponse {
    pub token_address: String,
    pub owner_address: String,
    pub date: String,
    pub timestamp: u64,
    pub block_number: Option<u64>,
    pub block_timestamp: Option<u64>,
    pub balance: String,
}

#[derive(Debug, Deserialize)]
pub struct GetLogsQuery {
    pub from: Option<u64>,
    pub to: Option<u64>,
    #[serde(default)]
    pub addresses: Vec<String>,
    #[serde(default)]
    pub topics: Vec<String>,
    pub chunk_size: Option<u64>,
}

#[derive(Debug, Deserialize)]
pub struct Erc20WalletQuery {
    pub from: Option<u64>,
    pub to: Option<u64>,
    #[serde(default)]
    pub tokens: Vec<String>,
    pub chunk_size: Option<u64>,
}

#[derive(Debug, Deserialize)]
pub struct Erc20TokenQuery {
    pub from: Option<u64>,
    pub to: Option<u64>,
    pub chunk_size: Option<u64>,
}

#[derive(Serialize)]
pub struct LogsResponse {
    pub logs: Vec<serde_json::Value>,
    pub metadata: serde_json::Value,
}

#[derive(Serialize)]
pub struct RpcInfoResponse {
    pub rpc_urls: Vec<String>,
    pub parallel_per_rpc: usize,
}
