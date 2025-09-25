use crate::types::BlockByNumberQuery;
use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    response::Json,
};
use futures::StreamExt;
use indexer::{BlockByNumberBuilder, BlockByNumberPlan, EthereumIndexer};
use std::sync::Arc;
use tracing::info;

pub async fn get_block_by_number(
    State(engine): State<Arc<EthereumIndexer>>,
    Path(number): Path<String>,
    Query(params): Query<BlockByNumberQuery>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    info!(
        "getBlockByNumber request: number={}, params={:?}",
        number, params
    );

    let mut builder = BlockByNumberBuilder::new();

    // Check if this is a range query or single block query
    if let (Some(from), Some(to)) = (params.from, params.to) {
        // Range query: use from/to parameters, ignore path parameter for range
        info!("Range query: from={}, to={}", from, to);

        if to < from {
            info!("Invalid range: to < from ({} < {})", to, from);
            return Err(StatusCode::BAD_REQUEST);
        }

        // Safety check for large ranges
        let range_size = to - from + 1;
        if range_size > 1000 {
            info!("Range too large: {} blocks (max 1000)", range_size);
            return Err(StatusCode::BAD_REQUEST);
        }

        builder = builder.range(from, to);
    } else {
        // Single block query - use specific builder methods for tags
        builder = match number.as_str() {
            "latest" => builder.latest(),
            "earliest" => builder.earliest(),
            "pending" => builder.pending(),
            "safe" => builder.safe(),
            "finalized" => builder.finalized(),
            _ => {
                // Parse numeric or hex block number
                let block_number = parse_numeric_block(&number)?;
                builder.push_number(block_number)
            }
        };
    }

    // Set full transactions mode (default true, can be overridden by query param)
    if let Some(full) = params.full {
        builder = builder.full(full);
    }

    // Build the plan
    let plan = match builder.limit(1000).plan() {
        Ok(p) => p,
        Err(e) => {
            info!("Plan creation failed: {}", e);
            return Err(StatusCode::BAD_REQUEST);
        }
    };

    // Execute the plan
    let work_items = match plan.plan() {
        Ok(items) => items,
        Err(e) => {
            info!("Work item creation failed: {}", e);
            return Err(StatusCode::INTERNAL_SERVER_ERROR);
        }
    };

    let mut stream = engine.run(work_items);
    let mut results = Vec::new();

    // Collect all results
    while let Some(result) = stream.next().await {
        match result {
            Ok((_key, data)) => {
                match BlockByNumberPlan::decode(data) {
                    Ok(Some(block)) => {
                        results.push(serde_json::to_value(block).unwrap());
                    }
                    Ok(None) => {
                        // Block not found, continue (some blocks in range might not exist)
                    }
                    Err(e) => {
                        info!("Decode error: {}", e);
                        return Err(StatusCode::INTERNAL_SERVER_ERROR);
                    }
                }
            }
            Err(e) => {
                info!("Stream error: {}", e);
                return Err(StatusCode::INTERNAL_SERVER_ERROR);
            }
        }
    }

    info!("Returning {} blocks", results.len());

    // Return single object for single block, array for range
    if params.from.is_some() && params.to.is_some() {
        // Range query: return array
        Ok(Json(serde_json::Value::Array(results)))
    } else {
        // Single block query: return single object or null
        match results.into_iter().next() {
            Some(block) => Ok(Json(block)),
            None => {
                info!("Block not found: {}", number);
                Err(StatusCode::NOT_FOUND)
            }
        }
    }
}

/// Parse numeric or hex block number from string
fn parse_numeric_block(s: &str) -> Result<u64, StatusCode> {
    // Try to parse as numeric first
    if let Ok(num) = s.parse::<u64>() {
        return Ok(num);
    }

    // Try hex format (0x...)
    if s.starts_with("0x") || s.starts_with("0X") {
        match u64::from_str_radix(&s[2..], 16) {
            Ok(num) => Ok(num),
            Err(_) => Err(StatusCode::BAD_REQUEST),
        }
    } else {
        Err(StatusCode::BAD_REQUEST)
    }
}
