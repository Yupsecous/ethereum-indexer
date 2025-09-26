use crate::cli;
use alloy::primitives::{Address, B256};
use alloy::rpc::types::eth::BlockNumberOrTag;
use futures::StreamExt;
use indexer::{
    BlockByNumberBuilder, EthereumIndexer, GetLogsPlan, OnMiss, Range, TraceFilterBuilder,
    TraceFilterPlan, TxByHashPlan, TxReceiptPlan,
    api::eth::get_logs::{Erc20TokenTransfersBuilder, Erc20WalletTransfersBuilder, GetLogsBuilder},
    balance_at_timestamp, order_by_range,
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
    print_progress_with_prefix(
        "",
        range,
        items,
        completed_blocks,
        total_blocks,
        total_items,
        start,
    );
}

fn print_progress_with_prefix(
    prefix: &str,
    range: Range,
    items: usize,
    completed_blocks: u64,
    total_blocks: u64,
    total_items: usize,
    start: std::time::Instant,
) {
    let elapsed = start.elapsed().as_secs_f64();
    let pct = completed_blocks as f64 / total_blocks as f64 * 100.0;

    let prefix_str = if prefix.is_empty() {
        String::new()
    } else {
        format!("[{}] ", prefix)
    };

    info!(
        "{}Chunk {}-{} | {} items | {}/{} ({:.1}%) | {:.0} blk/s | {:.0} item/s",
        prefix_str,
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

    info!(
        "Querying balance for address {} at date {} (timestamp: {})",
        address, date_str, timestamp
    );
    info!("Block search range: {} to {}", lo, hi);

    // Use AutoWidenToLatest policy for CLI user-friendliness
    match balance_at_timestamp(
        indexer,
        address,
        timestamp,
        lo,
        hi,
        OnMiss::AutoWidenToLatest,
    )
    .await
    {
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

pub async fn run_get_logs(
    cfg: cli::Config,
    indexer: &EthereumIndexer,
    start: std::time::Instant,
) -> anyhow::Result<()> {
    // Check which mode to use based on CLI parameters
    if let Some(wallet_address) = cfg.erc20_transfers_for.clone() {
        run_erc20_wallet_transfers(cfg, indexer, start, wallet_address).await
    } else if let Some(token_address) = cfg.erc20_token_transfers.clone() {
        run_erc20_token_transfers(cfg, indexer, start, token_address).await
    } else {
        run_general_logs(cfg, indexer, start).await
    }
}

async fn run_general_logs(
    cfg: cli::Config,
    indexer: &EthereumIndexer,
    start: std::time::Instant,
) -> anyhow::Result<()> {
    let start_block = cfg.from.unwrap();
    let end_block = cfg.to.unwrap();

    let mut builder = GetLogsBuilder::new(start_block, end_block).chunk_size(cfg.chunk_size);

    // Add address filters if provided
    if !cfg.addresses.is_empty() {
        let addresses: Result<Vec<Address>, _> = cfg.addresses.iter().map(|a| a.parse()).collect();
        builder = builder.addresses(addresses?);
    }

    // Add topic filters if provided
    for (i, topic_str) in cfg.topics.iter().enumerate() {
        if i >= 4 {
            break; // Maximum 4 topics in Ethereum logs
        }
        let topic: B256 = topic_str.parse()?;
        builder = builder.topic_one(i, topic);
    }

    let plan = builder.plan()?;
    let total_blocks = end_block - start_block + 1;
    let work_items = plan.plan()?;

    let (completed_blocks, total_logs) = order_by_range(indexer.run(work_items), plan.range.from)
        .fold(
            (0u64, 0usize),
            |(mut completed_blocks, mut total_logs), res| async move {
                match res {
                    Ok((range, value)) => match GetLogsPlan::decode(value) {
                        Ok(logs) => {
                            let log_count = logs.len();
                            total_logs += log_count;
                            completed_blocks += range.to - range.from + 1;

                            // Print some logs for demonstration
                            for log in logs.iter().take(5) {
                                if let Some(tx_hash) = &log.transaction_hash {
                                    println!(
                                        "Log: tx={}, address={}, topics={}",
                                        tx_hash,
                                        log.address(),
                                        log.topics().len()
                                    );
                                }
                            }

                            print_progress(
                                range,
                                log_count,
                                completed_blocks,
                                total_blocks,
                                total_logs,
                                start,
                            );
                        }
                        Err(e) => error!("decode error: {}", e),
                    },
                    Err(e) => error!("{}", e),
                }
                (completed_blocks, total_logs)
            },
        )
        .await;

    print_final_results(completed_blocks, total_logs, start);
    Ok(())
}

async fn run_erc20_wallet_transfers(
    cfg: cli::Config,
    indexer: &EthereumIndexer,
    start: std::time::Instant,
    wallet_address: String,
) -> anyhow::Result<()> {
    let start_block = cfg.from.unwrap();
    let end_block = cfg.to.unwrap();
    let wallet: Address = wallet_address.parse()?;

    // Use the library's ERC-20 contract support
    use alloy::sol_types::SolEvent;

    // Get the transfer signature from our contracts module
    let transfer_sig = {
        use alloy::sol;
        sol! {
            interface IERC20 {
                event Transfer(address indexed from, address indexed to, uint256 value);
            }
        }
        IERC20::Transfer::SIGNATURE_HASH
    };

    let mut builder =
        Erc20WalletTransfersBuilder::new(wallet, start_block, end_block, transfer_sig)
            .chunk_size(cfg.chunk_size);

    // Add token filter if addresses provided
    if !cfg.addresses.is_empty() {
        let token_addresses: Result<Vec<Address>, _> =
            cfg.addresses.iter().map(|a| a.parse()).collect();
        builder = builder.tokens(token_addresses?);
    }

    let (from_items, to_items, range) = builder.plan_split()?;
    let total_blocks = end_block - start_block + 1;

    // Process each lane separately to avoid duplicate OrderingKey issues
    let process_lane = |items: Vec<indexer::WorkItem>, lane_name: String| async move {
        let (lane_blocks, lane_transfers) = order_by_range(indexer.run(items), range.from)
            .fold(
                (0u64, 0usize),
                |(mut lane_blocks, mut lane_transfers), res| {
                    let lane_name = lane_name.clone();
                    async move {
                    match res {
                        Ok((range, value)) => match GetLogsPlan::decode(value) {
                            Ok(logs) => {
                                let mut transfer_count = 0;
                                for log in logs {
                                    // Try to decode as ERC-20 Transfer event
                                    use alloy::sol;
                                    sol! {
                                        interface IERC20 {
                                            event Transfer(address indexed from, address indexed to, uint256 value);
                                        }
                                    }

                                    // Convert RPC Log to primitive Log for decoding
                                    let primitive_log = alloy::primitives::Log {
                                        address: log.address(),
                                        data: alloy::primitives::LogData::new(
                                            log.topics().to_vec(),
                                            log.data().data.clone(),
                                        ).unwrap(),
                                    };
                                    if let Ok(decoded) = IERC20::Transfer::decode_log(&primitive_log) {
                                        transfer_count += 1;
                                        if let Some(tx_hash) = &log.transaction_hash {
                                            println!(
                                                "[{}] Transfer: {} -> {} ({}), token={}, tx={}",
                                                lane_name,
                                                decoded.from,
                                                decoded.to,
                                                decoded.value,
                                                log.address(),
                                                tx_hash
                                            );
                                        }
                                    }
                                }

                                lane_transfers += transfer_count;
                                lane_blocks += range.to - range.from + 1;

                                // Show progress for this lane using standard format
                                print_progress_with_prefix(
                                    &lane_name,
                                    range,
                                    transfer_count,
                                    lane_blocks,
                                    total_blocks,
                                    lane_transfers,
                                    start,
                                );
                            }
                            Err(e) => error!("[{}] decode error: {}", lane_name, e),
                        },
                        Err(e) => error!("[{}] {}", lane_name, e),
                    }
                    (lane_blocks, lane_transfers)
                    }
                },
            )
            .await;

        Ok::<(u64, usize), anyhow::Error>((lane_blocks, lane_transfers))
    };

    // Run both lanes concurrently
    let ((from_blocks, from_transfers), (to_blocks, to_transfers)) = tokio::try_join!(
        process_lane(from_items, "FROM".to_string()),
        process_lane(to_items, "TO".to_string())
    )?;

    let completed_blocks = from_blocks.max(to_blocks); // Both should be the same
    let total_transfers = from_transfers + to_transfers;

    print_final_results(completed_blocks, total_transfers, start);
    Ok(())
}

async fn run_erc20_token_transfers(
    cfg: cli::Config,
    indexer: &EthereumIndexer,
    start: std::time::Instant,
    token_address: String,
) -> anyhow::Result<()> {
    let start_block = cfg.from.unwrap();
    let end_block = cfg.to.unwrap();
    let token: Address = token_address.parse()?;

    // Use the library's ERC-20 contract support
    use alloy::sol_types::SolEvent;

    // Get the transfer signature from our contracts module
    let transfer_sig = {
        use alloy::sol;
        sol! {
            interface IERC20 {
                event Transfer(address indexed from, address indexed to, uint256 value);
            }
        }
        IERC20::Transfer::SIGNATURE_HASH
    };

    let builder = Erc20TokenTransfersBuilder::new(token, start_block, end_block, transfer_sig)
        .chunk_size(cfg.chunk_size);

    let (work_items, range) = builder.plan()?;
    let total_blocks = end_block - start_block + 1;

    // Process as a single stream since it's all transfers of one token
    let (completed_blocks, total_transfers) = order_by_range(indexer.run(work_items), range.from)
        .fold(
            (0u64, 0usize),
            |(mut completed_blocks, mut total_transfers), res| async move {
                match res {
                    Ok((range, value)) => match GetLogsPlan::decode(value) {
                        Ok(logs) => {
                            let mut transfer_count = 0;
                            for log in logs {
                                // Try to decode as ERC-20 Transfer event
                                use alloy::sol;
                                sol! {
                                    interface IERC20 {
                                        event Transfer(address indexed from, address indexed to, uint256 value);
                                    }
                                }

                                // Convert RPC Log to primitive Log for decoding
                                let primitive_log = alloy::primitives::Log {
                                    address: log.address(),
                                    data: alloy::primitives::LogData::new(
                                        log.topics().to_vec(),
                                        log.data().data.clone(),
                                    ).unwrap(),
                                };
                                if let Ok(decoded) = IERC20::Transfer::decode_log(&primitive_log) {
                                    transfer_count += 1;
                                    if let Some(tx_hash) = &log.transaction_hash {
                                        println!(
                                            "Transfer: {} -> {} ({}), token={}, tx={}",
                                            decoded.from,
                                            decoded.to,
                                            decoded.value,
                                            log.address(),
                                            tx_hash
                                        );
                                    }
                                }
                            }

                            total_transfers += transfer_count;
                            completed_blocks += range.to - range.from + 1;

                            print_progress(
                                range,
                                transfer_count,
                                completed_blocks,
                                total_blocks,
                                total_transfers,
                                start,
                            );
                        }
                        Err(e) => error!("decode error: {}", e),
                    },
                    Err(e) => error!("{}", e),
                }
                (completed_blocks, total_transfers)
            },
        )
        .await;

    print_final_results(completed_blocks, total_transfers, start);
    Ok(())
}

fn parse_date_to_timestamp(date_str: &str) -> anyhow::Result<u64> {
    // Parse YYYY-MM-DD format
    let parts: Vec<&str> = date_str.split('-').collect();
    if parts.len() != 3 {
        anyhow::bail!("Invalid date format. Use YYYY-MM-DD");
    }

    let year: u32 = parts[0]
        .parse()
        .map_err(|_| anyhow::anyhow!("Invalid year"))?;
    let month: u32 = parts[1]
        .parse()
        .map_err(|_| anyhow::anyhow!("Invalid month"))?;
    let day: u32 = parts[2]
        .parse()
        .map_err(|_| anyhow::anyhow!("Invalid day"))?;

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
    indexer: &EthereumIndexer,
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

fn print_final_results(completed_blocks: u64, total_items: usize, start: std::time::Instant) {
    let elapsed = start.elapsed().as_secs_f64();
    info!("=== FINAL RESULTS ===");
    info!(
        "Completed: {} blocks/items, {} found",
        completed_blocks, total_items
    );
    info!("Time: {:.2}s", elapsed);
    info!(
        "Performance: {:.0} blocks/sec",
        completed_blocks as f64 / elapsed
    );
}
