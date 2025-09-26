use crate::types::{BalanceQuery, BalanceResponse};
use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    response::Json,
};
use indexer::{EthereumIndexer, OnMiss, balance_at_timestamp};
use std::sync::Arc;
use tracing::{info, warn};

pub async fn get_balance_at_date(
    State(engine): State<Arc<EthereumIndexer>>,
    Path((address, date)): Path<(String, String)>,
    Query(params): Query<BalanceQuery>,
) -> Result<Json<BalanceResponse>, StatusCode> {
    info!(
        "getBalance request: address={}, date={}, params={:?}",
        address, date, params
    );

    // Validate Ethereum address format
    let addr = validate_ethereum_address(&address)?;

    // Validate and parse date format
    let timestamp = parse_date_to_timestamp(&date)?;

    // Determine block range bounds
    let (lo, hi) = determine_block_bounds(&params, timestamp, &engine).await?;

    info!("Block search range: {} to {}", lo, hi);

    // Determine miss handling policy
    let on_miss = match params.on_miss.as_deref() {
        Some("strict") => OnMiss::Strict,
        Some("clamp") => OnMiss::ClampToBounds,
        Some("auto_widen") | None => OnMiss::AutoWidenToLatest, // Default
        Some(other) => {
            warn!("Invalid on_miss policy: {}", other);
            return Err(StatusCode::BAD_REQUEST);
        }
    };

    // Query balance at timestamp
    match balance_at_timestamp(&engine, addr, timestamp, lo, hi, on_miss).await {
        Ok(Some(balance_wei)) => {
            // Format response - find the actual block that was used
            // For now, we'll use the provided timestamp, but in a real implementation
            // we'd want to return the actual block info used
            let balance_eth = format_wei_to_eth(balance_wei);

            info!(
                "Balance found: {} wei ({} ETH) for address {} at date {} (timestamp {})",
                balance_wei, balance_eth, address, date, timestamp
            );

            Ok(Json(BalanceResponse {
                address: address.to_lowercase(),
                date: date.clone(),
                timestamp,
                block_number: None,    // TODO: Return actual block number used
                block_timestamp: None, // TODO: Return actual block timestamp used
                balance_wei: balance_wei.to_string(),
                balance_eth,
            }))
        }
        Ok(None) => {
            info!(
                "No balance found for address {} at date {} (timestamp {})",
                address, date, timestamp
            );
            Err(StatusCode::NOT_FOUND)
        }
        Err(e) => {
            warn!("Balance query error: {}", e);
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
}

/// Validate Ethereum address format (0x + 40 hex characters)
fn validate_ethereum_address(address: &str) -> Result<alloy::primitives::Address, StatusCode> {
    if !address.starts_with("0x") && !address.starts_with("0X") {
        info!("Invalid address format (missing 0x prefix): {}", address);
        return Err(StatusCode::BAD_REQUEST);
    }

    if address.len() != 42 {
        info!(
            "Invalid address length: {} (expected 42 chars)",
            address.len()
        );
        return Err(StatusCode::BAD_REQUEST);
    }

    match address.parse() {
        Ok(addr) => Ok(addr),
        Err(_) => {
            info!("Invalid address format: {}", address);
            Err(StatusCode::BAD_REQUEST)
        }
    }
}

/// Parse date (YYYY-MM-DD) to Unix timestamp (00:00 UTC)
fn parse_date_to_timestamp(date_str: &str) -> Result<u64, StatusCode> {
    // Parse YYYY-MM-DD format
    let parts: Vec<&str> = date_str.split('-').collect();
    if parts.len() != 3 {
        info!("Invalid date format: {} (expected YYYY-MM-DD)", date_str);
        return Err(StatusCode::BAD_REQUEST);
    }

    let year: u32 = parts[0].parse().map_err(|_| {
        info!("Invalid year: {}", parts[0]);
        StatusCode::BAD_REQUEST
    })?;
    let month: u32 = parts[1].parse().map_err(|_| {
        info!("Invalid month: {}", parts[1]);
        StatusCode::BAD_REQUEST
    })?;
    let day: u32 = parts[2].parse().map_err(|_| {
        info!("Invalid day: {}", parts[2]);
        StatusCode::BAD_REQUEST
    })?;

    if month == 0 || month > 12 {
        info!("Month must be between 1 and 12, got: {}", month);
        return Err(StatusCode::BAD_REQUEST);
    }
    if day == 0 || day > 31 {
        info!("Day must be between 1 and 31, got: {}", day);
        return Err(StatusCode::BAD_REQUEST);
    }

    // Convert to Unix timestamp (00:00 UTC)
    let days_since_epoch = days_since_unix_epoch(year, month, day).map_err(|_| {
        info!(
            "Failed to calculate days since epoch for date: {}",
            date_str
        );
        StatusCode::BAD_REQUEST
    })?;

    Ok(days_since_epoch * 86400)
}

fn days_since_unix_epoch(year: u32, month: u32, day: u32) -> Result<u64, StatusCode> {
    // Unix epoch started 1970-01-01
    if year < 1970 {
        info!("Year must be 1970 or later, got: {}", year);
        return Err(StatusCode::BAD_REQUEST);
    }

    let mut days = 0u64;

    // Add days for complete years
    for y in 1970..year {
        days += if is_leap_year(y) { 366 } else { 365 };
    }

    // Add days for complete months in the current year
    let days_in_months = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    for m in 1..month {
        days += days_in_months[m as usize - 1] as u64;
        if m == 2 && is_leap_year(year) {
            days += 1; // February has 29 days in leap years
        }
    }

    // Add the day of the month (subtract 1 since we want 00:00 of that day)
    days += (day - 1) as u64;

    Ok(days)
}

fn is_leap_year(year: u32) -> bool {
    (year % 4 == 0) && (year % 100 != 0 || year % 400 == 0)
}

/// Validate Unix timestamp is reasonable (now unused but kept for reference)
fn _validate_unix_timestamp(timestamp: u64) -> Result<(), StatusCode> {
    // Ethereum genesis block timestamp: July 30, 2015
    const ETHEREUM_GENESIS_TIMESTAMP: u64 = 1438269973;

    // Current time + 1 year buffer for future dates
    let current_time = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_secs();
    let future_buffer = current_time + (365 * 24 * 60 * 60); // 1 year

    if timestamp < ETHEREUM_GENESIS_TIMESTAMP {
        info!(
            "Timestamp {} is before Ethereum genesis ({})",
            timestamp, ETHEREUM_GENESIS_TIMESTAMP
        );
        return Err(StatusCode::BAD_REQUEST);
    }

    if timestamp > future_buffer {
        info!(
            "Timestamp {} is too far in the future (max: {})",
            timestamp, future_buffer
        );
        return Err(StatusCode::BAD_REQUEST);
    }

    Ok(())
}

/// Determine block range bounds with smart defaults
async fn determine_block_bounds(
    params: &BalanceQuery,
    _timestamp: u64,
    engine: &EthereumIndexer,
) -> Result<(u64, u64), StatusCode> {
    let lo = params.block_range_lo.unwrap_or(0);

    let hi = if let Some(hi) = params.block_range_hi {
        hi
    } else {
        // Default to latest block
        use indexer::BlockByNumberBuilder;
        let plan = BlockByNumberBuilder::new().latest().plan().map_err(|e| {
            warn!("Failed to create latest block plan: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;
        let work_items = plan.plan().map_err(|e| {
            warn!("Failed to create latest block work items: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;

        // Get latest block number
        let mut latest_block_number = 0u64;
        let mut stream = engine.run(work_items);

        use futures::StreamExt;
        if let Some(result) = stream.next().await {
            match result {
                Ok((_key, value)) => {
                    if let Ok(Some(block)) = indexer::BlockByNumberPlan::decode(value) {
                        latest_block_number = block.header.number;
                    }
                }
                Err(e) => {
                    warn!("Failed to get latest block: {}", e);
                    return Err(StatusCode::INTERNAL_SERVER_ERROR);
                }
            }
        }

        if latest_block_number == 0 {
            warn!("Could not determine latest block number");
            return Err(StatusCode::INTERNAL_SERVER_ERROR);
        }

        latest_block_number
    };

    Ok((lo, hi))
}

/// Convert Wei to ETH string with full precision
fn format_wei_to_eth(wei: alloy::primitives::U256) -> String {
    // Convert Wei to ETH (divide by 10^18)
    let eth_divisor =
        alloy::primitives::U256::from(10u64).pow(alloy::primitives::U256::from(18u64));
    let eth_whole = wei / eth_divisor;
    let wei_remainder = wei % eth_divisor;

    // Format with appropriate precision
    if wei_remainder.is_zero() {
        format!("{}", eth_whole)
    } else {
        // Show up to 18 decimal places, removing trailing zeros
        let remainder_str = format!("{:0>18}", wei_remainder);
        let trimmed = remainder_str.trim_end_matches('0');
        if trimmed.is_empty() {
            format!("{}", eth_whole)
        } else {
            format!("{}.{}", eth_whole, trimmed)
        }
    }
}
