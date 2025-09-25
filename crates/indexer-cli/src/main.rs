use alloy::{
    primitives::Address, rpc::types::trace::filter::TraceFilterMode, transports::http::reqwest::Url,
};
use clap::Parser;
use futures::StreamExt;
use indexer::{
    EthereumIndexer, ProviderPool, Range, TraceFilterPlan, build_rpc_clients_with_retry,
    order_by_range,
};

mod cli;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    let cfg = cli::Config::parse();

    let urls: Vec<Url> = cfg
        .rpcs
        .iter()
        .map(|u| u.parse())
        .collect::<Result<_, _>>()?;
    let target: Address = cfg.target_address.parse()?;

    // Build providers (same concrete type for all URLs)
    let providers = build_rpc_clients_with_retry(urls.clone(), 10, 1000, 500);
    let pool = ProviderPool::new(providers, cfg.parallel_requests_per_rpc);
    let indexer = EthereumIndexer::new(pool, cfg.parallel_requests_per_rpc);

    println!("🚀 Starting transaction analysis:");
    println!("   🌐 RPCs: {}", urls.len());
    println!(
        "   🔁 Parallel requests per RPC: {}",
        cfg.parallel_requests_per_rpc
    );
    println!(
        "   🧵 Total parallel requests: {}",
        urls.len() * cfg.parallel_requests_per_rpc
    );
    println!(
        "   📦 Blocks: {} to {} (chunk size: {})",
        cfg.start_block, cfg.end_block, cfg.chunk_size
    );
    println!("   🎯 Target address: {target}");

    // Plan the work
    let plan = TraceFilterPlan {
        range: Range {
            from: cfg.start_block,
            to: cfg.end_block,
        },
        chunk_size: cfg.chunk_size,
        from: vec![target],
        to: vec![target],
        mode: Some(TraceFilterMode::Union),
        after: None,
        count: None,
    };

    let total_blocks = cfg.end_block - cfg.start_block + 1;
    let start = std::time::Instant::now();

    // Execute (raw path) + order by range
    let work_items = plan.plan()?;
    let (completed_blocks, total_txns) = order_by_range(indexer.run(work_items), cfg.start_block)
        .fold((0u64, 0usize), |(mut completed_blocks, mut total_txns), res| async move {
            match res {
                Ok((range, value)) => match TraceFilterPlan::decode(value) {
                    Ok(traces) => {
                        // Non-internal = empty trace_address
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
                        let elapsed = start.elapsed().as_secs_f64();
                        let pct = completed_blocks as f64 / total_blocks as f64 * 100.0;

                        println!(
                            "✅ Chunk {}-{} | {} txns | {}/{} ({:.1}%) | {:.0} blk/s | {:.0} tx/s",
                            range.from,
                            range.to,
                            n,
                            completed_blocks,
                            total_blocks,
                            pct,
                            completed_blocks as f64 / elapsed,
                            total_txns as f64 / elapsed
                        );
                    }
                    Err(e) => eprintln!("❌ decode error: {e}"),
                },
                Err(e) => eprintln!("❌ {e}"),
            }
            (completed_blocks, total_txns)
        })
        .await;

    let elapsed = start.elapsed().as_secs_f64();
    println!("\n🏁 === FINAL RESULTS ===");
    println!(
        "✅ Completed: {} blocks, {} non-internal transactions",
        completed_blocks, total_txns
    );
    println!("⏱️  Time: {:.2}s", elapsed);
    println!(
        "📊 Performance: {:.0} blocks/sec | {:.0} txns/sec",
        completed_blocks as f64 / elapsed,
        total_txns as f64 / elapsed
    );
    println!(
        "📈 Average: {:.2} transactions per block",
        total_txns as f64 / completed_blocks as f64
    );

    println!("\n🧮 === RPC STATISTICS ===");
    for (i, (url, s)) in urls.iter().zip(indexer.stats().iter()).enumerate() {
        let (req, ok, avg) = s.snapshot();
        let success = if req > 0 {
            (ok as f64 / req as f64) * 100.0
        } else {
            0.0
        };
        println!(
            "RPC #{}: {} | {} requests | {:.1}% success | {:.0}ms avg latency",
            i, url, req, success, avg
        );
    }

    Ok(())
}
