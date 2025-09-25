use alloy::transports::http::reqwest::Url;
use clap::Parser;
use indexer::{EthereumIndexer, ProviderPool, build_rpc_clients_with_retry};
use tracing::info;

mod cli;
mod methods;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    tracing_subscriber::fmt::init();

    let cfg = cli::Config::parse();

    let urls: Vec<Url> = cfg
        .rpcs
        .iter()
        .map(|u| u.parse())
        .collect::<Result<_, _>>()?;

    // Build providers (same concrete type for all URLs)
    let providers = build_rpc_clients_with_retry(urls.clone(), 10, 1000, 500);
    let pool = ProviderPool::new(providers, cfg.parallel_requests_per_rpc);
    let indexer = EthereumIndexer::new(pool, cfg.parallel_requests_per_rpc);

    info!("Starting {:?} benchmark", cfg.method);
    info!("RPCs: {}", urls.len());
    info!(
        "Parallel requests per RPC: {}",
        cfg.parallel_requests_per_rpc
    );
    info!(
        "Total parallel requests: {}",
        urls.len() * cfg.parallel_requests_per_rpc
    );

    match cfg.method {
        cli::Method::TraceFilter => {
            let target = cfg.target_address.as_ref().unwrap();
            info!(
                "Blocks: {} to {} (chunk size: {})",
                cfg.start_block, cfg.end_block, cfg.chunk_size
            );
            info!("Target address: {}", target);
        }
        cli::Method::GetBlockByNumber => {
            info!(
                "Blocks: {} to {} (chunk size: {})",
                cfg.start_block, cfg.end_block, cfg.chunk_size
            );
            if cfg.full {
                info!("Full transactions: enabled");
            }
        }
        cli::Method::GetTransactionByHash | cli::Method::GetTransactionReceipt => {
            info!("Hashes: {} items", cfg.hashes.len());
        }
    }

    let start = std::time::Instant::now();

    // Dispatch based on method
    match cfg.method {
        cli::Method::TraceFilter => {
            methods::run_trace_filter(cfg, &indexer, start).await?;
        }
        cli::Method::GetBlockByNumber => {
            methods::run_get_block_by_number(cfg, &indexer, start).await?;
        }
        cli::Method::GetTransactionByHash => {
            methods::run_get_transaction_by_hash(cfg, &indexer, start).await?;
        }
        cli::Method::GetTransactionReceipt => {
            methods::run_get_transaction_receipt(cfg, &indexer, start).await?;
        }
    }

    print_rpc_stats(&urls, &indexer);

    Ok(())
}

fn print_rpc_stats(urls: &[Url], indexer: &EthereumIndexer) {
    info!("=== RPC STATISTICS ===");
    for (i, (url, s)) in urls.iter().zip(indexer.stats().iter()).enumerate() {
        let (req, ok, avg) = s.snapshot();
        let success = if req > 0 {
            (ok as f64 / req as f64) * 100.0
        } else {
            0.0
        };
        info!(
            "RPC #{}: {} | {} requests | {:.1}% success | {:.0}ms avg latency",
            i, url, req, success, avg
        );
    }
}
