use crate::cli;
use alloy::{
    primitives::{Address, B256},
    rpc::types::eth::BlockNumberOrTag,
};
use futures::StreamExt;
use indexer::{
    BlockByNumberPlan, EthereumIndexer, Range, TraceFilterBuilder, TraceFilterPlan, TxByHashPlan,
    TxReceiptPlan, order_by_range,
};
use tracing::{error, info};

pub async fn run_trace_filter(
    cfg: cli::Config,
    indexer: &EthereumIndexer,
    start: std::time::Instant,
) -> anyhow::Result<()> {
    let target: Address = cfg.target_address.as_ref().unwrap().parse()?;

    let plan = TraceFilterBuilder::new()
        .target(target)
        .start_block(cfg.start_block)
        .end_block(cfg.end_block)
        .chunk_size(cfg.chunk_size)
        .limits(1_000_000, 10_000)
        .plan()?;

    let total_blocks = cfg.end_block - cfg.start_block + 1;
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
    let plan = BlockByNumberPlan {
        numbers: (cfg.start_block..=cfg.end_block)
            .map(|n| BlockNumberOrTag::Number(n))
            .collect(),
        full: cfg.full,
    };

    let total_blocks = cfg.end_block - cfg.start_block + 1;
    let work_items = plan.plan()?;

    let (completed_blocks, total_items) = indexer
        .run(work_items)
        .fold(
            (0u64, 0usize),
            |(mut completed_blocks, mut total_items), res| async move {
                match res {
                    Ok((_key, value)) => match BlockByNumberPlan::decode(value) {
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
        .await;

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
