use crate::cli;
use alloy::primitives::{Address, B256};
use alloy::rpc::types::eth::BlockNumberOrTag;
use futures::StreamExt;
use indexer::{
    BlockByNumberBuilder, EthereumIndexer, Range, TraceFilterBuilder, TraceFilterPlan,
    TxByHashPlan, TxReceiptPlan, order_by_range, balance_at_timestamp, OnMiss,
};
use tracing::{error, info};

pub async fn run_trace_filter(
    cfg: cli::Config,
    indexer: &EthereumIndexer,
    start: std::time::Instant,
) -> anyhow::Result<()> {
    let target: Address = cfg.target_address.as_ref().unwrap().parse()?;

    let start_block = cfg.from.unwrap();
    let end_block = cfg.to.unwrap();

    let plan = TraceFilterBuilder::new()
        .target(target)
        .start_block(start_block)
        .end_block(end_block)
        .chunk_size(cfg.chunk_size)
        .limits(1_000_000, 10_000)
        .plan()?;

    let total_blocks = end_block - start_block + 1;
    let work_items = plan.plan()?;

    let (completed_blocks, total_txns) = order_by_range(indexer.run(work_items), plan.range.from)
        .fold(
            (0u64, 0usize),
            |(mut completed_blocks, mut total_txns), res| async move {
                match res {
                    Ok((range, value)) => match TraceFilterPlan::decode(value) {
                        Ok(traces) => {
                            let n = traces
                                .iter()
                                .filter(|t| t.trace.trace_address.is_empty())
                                .inspect(|t| {
                                    if let Some(h) = &t.transaction_hash {
                                        println!("{h}");
                                    }
                                })
                                .count();

                            total_txns += n;
                            completed_blocks += range.to - range.from + 1;
                            print_progress(
                                range,
                                n,
                                completed_blocks,
                                total_blocks,
                                total_txns,
                                start,
                            );
                        }
                        Err(e) => error!("decode error: {}", e),
                    },
                    Err(e) => error!("{}", e),
                }
                (completed_blocks, total_txns)
            },
        )
        .await;

    print_final_results(completed_blocks, total_txns, start);
    Ok(())
}

pub async fn run_get_block_by_number(
    cfg: cli::Config,
    indexer: &EthereumIndexer,
    start: std::time::Instant,
) -> anyhow::Result<()> {
    let mut builder = BlockByNumberBuilder::new().full(cfg.full);

    let total_blocks = if let Some(ref tag) = cfg.tag {
        builder = match tag.as_str() {
            "latest" => builder.latest(),
            "earliest" => builder.earliest(),
            "pending" => builder.pending(),
            "safe" => builder.safe(),
            "finalized" => builder.finalized(),
            _ => return Err(anyhow::anyhow!("Invalid tag: {}", tag)),
        };
        1 // Single block for tags
    } else if !cfg.numbers.is_empty() {
        let count = cfg.numbers.len();
        builder = cfg
            .numbers
            .clone()
            .into_iter()
            .fold(builder, |b, n| b.push_number(n));
        count as u64
    } else {
        let from_block = cfg.from.unwrap();
        let to_block = cfg.to.unwrap();
        builder = builder.range(from_block, to_block);
        to_block - from_block + 1
    };

    let plan = builder.plan()?;
    let work = plan.plan()?;

    // Detect if all items are numeric (ordered) or any tag exists (unordered)
    let all_numeric = plan
        .numbers
        .iter()
        .all(|n| matches!(n, BlockNumberOrTag::Number(_)));

    let (completed_blocks, total_items) = if all_numeric {
        let start_key = plan
            .numbers
            .iter()
            .filter_map(|n| {
                if let BlockNumberOrTag::Number(x) = n {
                    Some(*x)
                } else {
                    None
                }
            })
            .min()
            .unwrap();

        // Ordered, parallel
        order_by_range(indexer.run(work), start_key)
            .fold(
                (0u64, 0usize),
                |(mut completed_blocks, mut total_items), res| async move {
                    match res {
                        Ok((range, value)) => match indexer::BlockByNumberPlan::decode(value) {
                            Ok(Some(block)) => {
                                total_items += 1;
                                completed_blocks += 1;

                                if completed_blocks % 10 == 0 {
                                    let elapsed = start.elapsed().as_secs_f64();
                                    let pct = completed_blocks as f64 / total_blocks as f64 * 100.0;
                                    info!(
                                        "Block {} | Range {}-{} | {}/{} ({:.1}%) | {:.0} blk/s",
                                        block.header.number,
                                        range.from,
                                        range.to,
                                        completed_blocks,
                                        total_blocks,
                                        pct,
                                        completed_blocks as f64 / elapsed
                                    );
                                }
                            }
                            Ok(None) => {
                                completed_blocks += 1;
                            }
                            Err(e) => error!("decode error: {}", e),
                        },
                        Err(e) => error!("{}", e),
                    }
                    (completed_blocks, total_items)
                },
            )
            .await
    } else {
        // Unordered, parallel - process tags/mixed queries
        indexer
            .run(work)
            .fold(
                (0u64, 0usize),
                |(mut completed_blocks, mut total_items), res| async move {
                    match res {
                        Ok((_key, value)) => match indexer::BlockByNumberPlan::decode(value) {
                            Ok(Some(block)) => {
                                total_items += 1;
                                completed_blocks += 1;

                                if completed_blocks % 10 == 0 {
                                    let elapsed = start.elapsed().as_secs_f64();
                                    let pct = completed_blocks as f64 / total_blocks as f64 * 100.0;
                                    info!(
                                        "Block {} | {}/{} ({:.1}%) | {:.0} blk/s",
                                        block.header.number,
                                        completed_blocks,
                                        total_blocks,
                                        pct,
                                        completed_blocks as f64 / elapsed
                                    );
                                }
                            }
                            Ok(None) => {
                                completed_blocks += 1;
                            }
                            Err(e) => error!("decode error: {}", e),
                        },
                        Err(e) => error!("{}", e),
                    }
                    (completed_blocks, total_items)
                },
            )
            .await
    };

    print_final_results(completed_blocks, total_items, start);
    Ok(())
}

pub async fn run_get_transaction_by_hash(
    cfg: cli::Config,
    indexer: &EthereumIndexer,
    start: std::time::Instant,
) -> anyhow::Result<()> {
    let hashes: Result<Vec<B256>, _> = cfg.hashes.iter().map(|h| h.parse()).collect();
    let hashes = hashes?;

    let plan = TxByHashPlan { hashes };
    let work_items = plan.plan()?;

    let (completed_items, found_items) = indexer
        .run(work_items)
        .fold(
            (0usize, 0usize),
            |(mut completed_items, mut found_items), res| async move {
                match res {
                    Ok((_key, value)) => match TxByHashPlan::decode(value) {
                        Ok(Some(tx)) => {
                            found_items += 1;
                            completed_items += 1;
                            println!("{}", tx.inner.hash());
                        }
                        Ok(None) => {
                            completed_items += 1;
                        }
                        Err(e) => error!("decode error: {}", e),
                    },
                    Err(e) => error!("{}", e),
                }
                (completed_items, found_items)
            },
        )
        .await;

    print_final_results(completed_items as u64, found_items, start);
    Ok(())
}

pub async fn run_get_transaction_receipt(
    cfg: cli::Config,
    indexer: &EthereumIndexer,
    start: std::time::Instant,
) -> anyhow::Result<()> {
    let hashes: Result<Vec<B256>, _> = cfg.hashes.iter().map(|h| h.parse()).collect();
    let hashes = hashes?;

    let plan = TxReceiptPlan { hashes };
    let work_items = plan.plan()?;

    let (completed_items, found_items) = indexer
        .run(work_items)
        .fold(
            (0usize, 0usize),
            |(mut completed_items, mut found_items), res| async move {
                match res {
                    Ok((_key, value)) => match TxReceiptPlan::decode(value) {
                        Ok(Some(receipt)) => {
                            found_items += 1;
                            completed_items += 1;
                            println!("{}", receipt.transaction_hash);
                        }
                        Ok(None) => {
                            completed_items += 1;
                        }
                        Err(e) => error!("decode error: {}", e),
                    },
                    Err(e) => error!("{}", e),
                }
                (completed_items, found_items)
            },
        )
        .await;

    print_final_results(completed_items as u64, found_items, start);
    Ok(())
}

fn print_progress(
    range: Range,
    items: usize,
    completed_blocks: u64,
    total_blocks: u64,
    total_items: usize,
    start: std::time::Instant,
) {
    let elapsed = start.elapsed().as_secs_f64();
    let pct = completed_blocks as f64 / total_blocks as f64 * 100.0;

    info!(
        "Chunk {}-{} | {} items | {}/{} ({:.1}%) | {:.0} blk/s | {:.0} item/s",
        range.from,
        range.to,
        items,
        completed_blocks,
        total_blocks,
        pct,
        completed_blocks as f64 / elapsed,
        total_items as f64 / elapsed
    );
}

pub async fn run_get_balance(
    cfg: cli::Config,
    indexer: &EthereumIndexer,
    start: std::time::Instant,
) -> anyhow::Result<()> {
    let address: Address = cfg.address.as_ref().unwrap().parse()?;
    let date_str = cfg.date.as_ref().unwrap();

    // Parse date to Unix timestamp (YYYY-MM-DD 00:00 UTC)
    let timestamp = parse_date_to_timestamp(date_str)?;

    // Determine block range bounds
    let (lo, hi) = determine_block_bounds(&cfg, timestamp, indexer).await?;

    info!("Querying balance for address {} at date {} (timestamp: {})", address, date_str, timestamp);
    info!("Block search range: {} to {}", lo, hi);

    // Use AutoWidenToLatest policy for CLI user-friendliness
    match balance_at_timestamp(indexer, address, timestamp, lo, hi, OnMiss::AutoWidenToLatest).await {
        Ok(Some(balance)) => {
            let eth_balance = format_wei_to_eth(balance);
            info!("=== BALANCE RESULT ===");
            info!("Address: {}", address);
            info!("Date: {} (00:00 UTC)", date_str);
            info!("Balance: {} ETH", eth_balance);
            println!("{}", eth_balance); // Also print to stdout for easy parsing
        }
        Ok(None) => {
            error!("Could not determine balance at the specified date (returned None)");
        }
        Err(e) => {
            error!("Error querying balance: {}", e);
        }
    }

    print_final_results(1, 1, start);
    Ok(())
}

fn parse_date_to_timestamp(date_str: &str) -> anyhow::Result<u64> {
    // Parse YYYY-MM-DD format
    let parts: Vec<&str> = date_str.split('-').collect();
    if parts.len() != 3 {
        anyhow::bail!("Invalid date format. Use YYYY-MM-DD");
    }

    let year: u32 = parts[0].parse().map_err(|_| anyhow::anyhow!("Invalid year"))?;
    let month: u32 = parts[1].parse().map_err(|_| anyhow::anyhow!("Invalid month"))?;
    let day: u32 = parts[2].parse().map_err(|_| anyhow::anyhow!("Invalid day"))?;

    if month == 0 || month > 12 {
        anyhow::bail!("Month must be between 1 and 12");
    }
    if day == 0 || day > 31 {
        anyhow::bail!("Day must be between 1 and 31");
    }

    // Convert to Unix timestamp (00:00 UTC)
    // Simple calculation: days since Unix epoch * 86400
    let days_since_epoch = days_since_unix_epoch(year, month, day)?;
    Ok(days_since_epoch * 86400)
}

fn days_since_unix_epoch(year: u32, month: u32, day: u32) -> anyhow::Result<u64> {
    // Unix epoch started 1970-01-01
    if year < 1970 {
        anyhow::bail!("Year must be 1970 or later");
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

async fn determine_block_bounds(
    cfg: &cli::Config,
    timestamp: u64,
    indexer: &EthereumIndexer
) -> anyhow::Result<(u64, u64)> {
    let lo = if let Some(lo) = cfg.block_range_lo {
        lo
    } else {
        // Estimate based on timestamp - rough estimate of 12 seconds per block
        // Genesis block was around timestamp 1438269973 (July 30, 2015)
        let genesis_timestamp = 1438269973u64;
        if timestamp <= genesis_timestamp {
            1 // Start from block 1 if before genesis
        } else {
            let blocks_since_genesis = (timestamp - genesis_timestamp) / 12;
            blocks_since_genesis.max(1) // Ensure at least block 1
        }
    };

    let hi = if let Some(hi) = cfg.block_range_hi {
        hi
    } else {
        // Default to latest block
        use indexer::BlockByNumberBuilder;
        let plan = BlockByNumberBuilder::new().latest().plan()?;
        let work_items = plan.plan()?;

        // Get latest block number
        let mut latest_block_number = 0u64;
        let mut stream = indexer.run(work_items);
        if let Some(result) = stream.next().await {
            match result {
                Ok((_key, value)) => {
                    if let Ok(Some(block)) = indexer::BlockByNumberPlan::decode(value) {
                        latest_block_number = block.header.number;
                    }
                }
                Err(e) => {
                    anyhow::bail!("Failed to get latest block: {}", e);
                }
            }
        }

        if latest_block_number == 0 {
            anyhow::bail!("Could not determine latest block number");
        }

        latest_block_number
    };

    Ok((lo, hi))
}

fn format_wei_to_eth(wei: alloy::primitives::U256) -> String {
    // Convert Wei to ETH (divide by 10^18)
    let eth_divisor = alloy::primitives::U256::from(10u64).pow(alloy::primitives::U256::from(18u64));
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

fn print_final_results(completed_blocks: u64, total_items: usize, start: std::time::Instant) {
    let elapsed = start.elapsed().as_secs_f64();
    info!("=== FINAL RESULTS ===");
    info!(
        "Completed: {} blocks/items, {} found",
        completed_blocks, total_items
    );
    info!("Time: {:.2}s", elapsed);
    info!(
        "Performance: {:.0} items/sec",
        completed_blocks as f64 / elapsed
    );
}
