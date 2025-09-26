use crate::types::{Erc20TokenQuery, Erc20WalletQuery, GetLogsQuery, LogsResponse};
use alloy::{primitives::Address, sol_types::SolEvent};
use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    response::Json,
};
use futures::StreamExt;
use indexer::{
    EthereumIndexer, GetLogsPlan,
    api::eth::get_logs::{Erc20TokenTransfersBuilder, Erc20WalletTransfersBuilder, GetLogsBuilder},
    order_by_range,
};
use std::sync::Arc;
use tracing::info;

pub async fn get_logs_general(
    State(engine): State<Arc<EthereumIndexer>>,
    Query(params): Query<GetLogsQuery>,
) -> Result<Json<LogsResponse>, StatusCode> {
    let from_block = params.from.ok_or(StatusCode::BAD_REQUEST)?;
    let to_block = params.to.ok_or(StatusCode::BAD_REQUEST)?;

    info!(
        "getLogs general request: from={}, to={}, addresses={:?}",
        from_block, to_block, params.addresses
    );

    validate_block_range(from_block, to_block)?;

    let mut builder =
        GetLogsBuilder::new(from_block, to_block).chunk_size(params.chunk_size.unwrap_or(1000));

    // Add address filters if provided
    if !params.addresses.is_empty() {
        let addresses: Result<Vec<Address>, _> =
            params.addresses.iter().map(|a| a.parse()).collect();
        builder = builder.addresses(addresses.map_err(|_| StatusCode::BAD_REQUEST)?);
    }

    // Add topic filters if provided
    for (i, topic_str) in params.topics.iter().enumerate() {
        if i >= 4 {
            break; // Maximum 4 topics in Ethereum logs
        }
        let topic = topic_str.parse().map_err(|_| StatusCode::BAD_REQUEST)?;
        builder = builder.topic_one(i, topic);
    }

    let plan = builder.plan().map_err(|_| StatusCode::BAD_REQUEST)?;
    let work_items = plan.plan().map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    execute_logs_plan(
        engine,
        work_items,
        plan.range.from,
        from_block,
        to_block,
        params.chunk_size.unwrap_or(1000),
    )
    .await
}

pub async fn get_logs_erc20_wallet(
    State(engine): State<Arc<EthereumIndexer>>,
    Path(wallet_address): Path<String>,
    Query(params): Query<Erc20WalletQuery>,
) -> Result<Json<LogsResponse>, StatusCode> {
    let from_block = params.from.ok_or(StatusCode::BAD_REQUEST)?;
    let to_block = params.to.ok_or(StatusCode::BAD_REQUEST)?;
    let wallet: Address = wallet_address
        .parse()
        .map_err(|_| StatusCode::BAD_REQUEST)?;

    info!(
        "getLogs ERC-20 wallet request: wallet={}, from={}, to={}",
        wallet, from_block, to_block
    );

    validate_block_range(from_block, to_block)?;

    // Get ERC-20 Transfer signature
    let transfer_sig = get_transfer_signature();

    let mut builder = Erc20WalletTransfersBuilder::new(wallet, from_block, to_block, transfer_sig)
        .chunk_size(params.chunk_size.unwrap_or(1000));

    // Add token filter if provided
    if !params.tokens.is_empty() {
        let token_addresses: Result<Vec<Address>, _> =
            params.tokens.iter().map(|a| a.parse()).collect();
        builder = builder.tokens(token_addresses.map_err(|_| StatusCode::BAD_REQUEST)?);
    }

    let (from_items, to_items, range) =
        builder.plan_split().map_err(|_| StatusCode::BAD_REQUEST)?;

    // Process both lanes concurrently
    let engine_clone = engine.clone();
    let from_future = async move {
        let mut results = Vec::new();
        let stream = order_by_range(engine.run(from_items), range.from);
        tokio::pin!(stream);

        while let Some(item) = stream.next().await {
            match item {
                Ok((_range, data)) => {
                    if let Ok(logs) = GetLogsPlan::decode(data) {
                        for log in logs {
                            if let Some(decoded) = decode_transfer_log(&log) {
                                results.push(serde_json::json!({
                                    "type": "Transfer",
                                    "lane": "FROM",
                                    "from": decoded.from,
                                    "to": decoded.to,
                                    "value": decoded.value.to_string(),
                                    "token": log.address(),
                                    "transaction_hash": log.transaction_hash,
                                    "block_number": log.block_number,
                                    "log_index": log.log_index
                                }));
                            }
                        }
                    }
                }
                Err(e) => {
                    info!("Stream error in FROM: {}", e);
                    return Err(StatusCode::INTERNAL_SERVER_ERROR);
                }
            }
        }
        Ok(results)
    };

    let to_future = async move {
        let mut results = Vec::new();
        let stream = order_by_range(engine_clone.run(to_items), range.from);
        tokio::pin!(stream);

        while let Some(item) = stream.next().await {
            match item {
                Ok((_range, data)) => {
                    if let Ok(logs) = GetLogsPlan::decode(data) {
                        for log in logs {
                            if let Some(decoded) = decode_transfer_log(&log) {
                                results.push(serde_json::json!({
                                    "type": "Transfer",
                                    "lane": "TO",
                                    "from": decoded.from,
                                    "to": decoded.to,
                                    "value": decoded.value.to_string(),
                                    "token": log.address(),
                                    "transaction_hash": log.transaction_hash,
                                    "block_number": log.block_number,
                                    "log_index": log.log_index
                                }));
                            }
                        }
                    }
                }
                Err(e) => {
                    info!("Stream error in TO: {}", e);
                    return Err(StatusCode::INTERNAL_SERVER_ERROR);
                }
            }
        }
        Ok(results)
    };

    let (from_results, to_results) = tokio::try_join!(from_future, to_future)?;

    let mut all_logs = from_results;
    all_logs.extend(to_results);
    let total_logs = all_logs.len();

    Ok(Json(LogsResponse {
        logs: all_logs,
        metadata: serde_json::json!({
            "from_block": from_block,
            "to_block": to_block,
            "total_logs": total_logs,
            "chunk_size": params.chunk_size.unwrap_or(1000),
            "transfer_type": "wallet"
        }),
    }))
}

pub async fn get_logs_erc20_token(
    State(engine): State<Arc<EthereumIndexer>>,
    Path(token_address): Path<String>,
    Query(params): Query<Erc20TokenQuery>,
) -> Result<Json<LogsResponse>, StatusCode> {
    let from_block = params.from.ok_or(StatusCode::BAD_REQUEST)?;
    let to_block = params.to.ok_or(StatusCode::BAD_REQUEST)?;
    let token: Address = token_address.parse().map_err(|_| StatusCode::BAD_REQUEST)?;

    info!(
        "getLogs ERC-20 token request: token={}, from={}, to={}",
        token, from_block, to_block
    );

    validate_block_range(from_block, to_block)?;

    // Get ERC-20 Transfer signature
    let transfer_sig = get_transfer_signature();

    let builder = Erc20TokenTransfersBuilder::new(token, from_block, to_block, transfer_sig)
        .chunk_size(params.chunk_size.unwrap_or(1000));

    let (work_items, range) = builder.plan().map_err(|_| StatusCode::BAD_REQUEST)?;

    let stream = order_by_range(engine.run(work_items), range.from);
    let mut results = Vec::new();

    tokio::pin!(stream);
    while let Some(item) = stream.next().await {
        match item {
            Ok((_range, data)) => {
                if let Ok(logs) = GetLogsPlan::decode(data) {
                    for log in logs {
                        if let Some(decoded) = decode_transfer_log(&log) {
                            results.push(serde_json::json!({
                                "type": "Transfer",
                                "from": decoded.from,
                                "to": decoded.to,
                                "value": decoded.value.to_string(),
                                "token": log.address(),
                                "transaction_hash": log.transaction_hash,
                                "block_number": log.block_number,
                                "log_index": log.log_index
                            }));
                        }
                    }
                }
            }
            Err(e) => {
                info!("Stream error: {}", e);
                return Err(StatusCode::INTERNAL_SERVER_ERROR);
            }
        }
    }

    let total_logs = results.len();
    Ok(Json(LogsResponse {
        logs: results,
        metadata: serde_json::json!({
            "from_block": from_block,
            "to_block": to_block,
            "total_logs": total_logs,
            "chunk_size": params.chunk_size.unwrap_or(1000),
            "transfer_type": "token"
        }),
    }))
}

// Helper functions

async fn execute_logs_plan(
    engine: Arc<EthereumIndexer>,
    work_items: Vec<indexer::WorkItem>,
    start_key: u64,
    from_block: u64,
    to_block: u64,
    chunk_size: u64,
) -> Result<Json<LogsResponse>, StatusCode> {
    let stream = order_by_range(engine.run(work_items), start_key);
    let mut results = Vec::new();

    tokio::pin!(stream);
    while let Some(item) = stream.next().await {
        match item {
            Ok((_range, data)) => {
                if let Ok(logs) = GetLogsPlan::decode(data) {
                    for log in logs {
                        results.push(serde_json::json!({
                            "address": log.address(),
                            "topics": log.topics(),
                            "data": log.data().data,
                            "transaction_hash": log.transaction_hash,
                            "block_number": log.block_number,
                            "block_hash": log.block_hash,
                            "log_index": log.log_index,
                            "transaction_index": log.transaction_index,
                            "removed": log.removed
                        }));
                    }
                }
            }
            Err(e) => {
                info!("Stream error: {}", e);
                return Err(StatusCode::INTERNAL_SERVER_ERROR);
            }
        }
    }

    let total_logs = results.len();
    Ok(Json(LogsResponse {
        logs: results,
        metadata: serde_json::json!({
            "from_block": from_block,
            "to_block": to_block,
            "total_logs": total_logs,
            "chunk_size": chunk_size
        }),
    }))
}

fn validate_block_range(from_block: u64, to_block: u64) -> Result<(), StatusCode> {
    if to_block < from_block {
        info!("Invalid range: to < from ({} < {})", to_block, from_block);
        return Err(StatusCode::BAD_REQUEST);
    }

    let range_size = to_block - from_block + 1;
    if range_size > 10_000 {
        info!("Range too large: {} blocks (max 10,000)", range_size);
        return Err(StatusCode::BAD_REQUEST);
    }

    Ok(())
}

fn get_transfer_signature() -> alloy::primitives::B256 {
    use alloy::sol;
    sol! {
        interface IERC20 {
            event Transfer(address indexed from, address indexed to, uint256 value);
        }
    }
    IERC20::Transfer::SIGNATURE_HASH
}

fn decode_transfer_log(log: &alloy::rpc::types::eth::Log) -> Option<TransferEvent> {
    use alloy::sol;
    sol! {
        interface IERC20 {
            event Transfer(address indexed from, address indexed to, uint256 value);
        }
    }

    let primitive_log = alloy::primitives::Log {
        address: log.address(),
        data: alloy::primitives::LogData::new(log.topics().to_vec(), log.data().data.clone())
            .unwrap(),
    };

    IERC20::Transfer::decode_log(&primitive_log)
        .ok()
        .map(|decoded| TransferEvent {
            from: decoded.from,
            to: decoded.to,
            value: decoded.value,
        })
}

struct TransferEvent {
    from: Address,
    to: Address,
    value: alloy::primitives::U256,
}
