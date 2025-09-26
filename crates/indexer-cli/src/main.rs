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

    // Custom validation for method-specific required arguments
    match cfg.method {
        cli::Method::TraceFilter => {
            if cfg.target_address.is_none() {
                anyhow::bail!("--target-address is required for trace-filter method");
            }
            if cfg.from.is_none() || cfg.to.is_none() {
                anyhow::bail!("--from and --to are required for trace-filter method");
            }
        }
        cli::Method::GetBlockByNumber => {
            if cfg.tag.is_none()
                && cfg.numbers.is_empty()
                && (cfg.from.is_none() || cfg.to.is_none())
            {
                anyhow::bail!(
                    "--tag, --numbers, or both --from and --to are required for get-block-by-number method"
                );
            }
        }
        cli::Method::GetTransactionByHash | cli::Method::GetTransactionReceipt => {
            if cfg.hashes.is_empty() {
                anyhow::bail!("--hashes is required for transaction methods");
            }
        }
        cli::Method::GetBalance => {
            if cfg.address.is_none() {
                anyhow::bail!("--address is required for get-balance method");
            }
            if cfg.date.is_none() {
                anyhow::bail!("--date is required for get-balance method");
            }
        }
        cli::Method::GetLogs => {
            if cfg.from.is_none() || cfg.to.is_none() {
                anyhow::bail!("--from and --to are required for get-logs method");
            }
            // Require addresses unless using ERC-20 transfers filter
            if cfg.erc20_transfers_for.is_none() && cfg.addresses.is_empty() {
                anyhow::bail!(
                    "--addresses is required for get-logs method (unless using --erc20-transfers-for)"
                );
            }
        }
    }

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
                cfg.from.unwrap(),
                cfg.to.unwrap(),
                cfg.chunk_size
            );
            info!("Target address: {}", target);
        }
        cli::Method::GetBlockByNumber => {
            if let Some(tag) = &cfg.tag {
                info!("Block tag: {}", tag);
            } else if !cfg.numbers.is_empty() {
                info!("Block numbers: {:?}", cfg.numbers);
            } else {
                info!(
                    "Blocks: {} to {} (chunk size: {})",
                    cfg.from.unwrap(),
                    cfg.to.unwrap(),
                    cfg.chunk_size
                );
            }
            if cfg.full {
                info!("Full transactions: enabled");
            }
        }
        cli::Method::GetTransactionByHash | cli::Method::GetTransactionReceipt => {
            info!("Hashes: {} items", cfg.hashes.len());
        }
        cli::Method::GetBalance => {
            let address = cfg.address.as_ref().unwrap();
            let date = cfg.date.as_ref().unwrap();
            info!("Address: {}", address);
            info!("Date: {}", date);
            if let Some(lo) = cfg.block_range_lo {
                info!("Block range lo: {}", lo);
            }
            if let Some(hi) = cfg.block_range_hi {
                info!("Block range hi: {}", hi);
            }
        }
        cli::Method::GetLogs => {
            info!(
                "Blocks: {} to {} (chunk size: {})",
                cfg.from.unwrap(),
                cfg.to.unwrap(),
                cfg.chunk_size
            );
            if !cfg.addresses.is_empty() {
                info!("Contract addresses: {:?}", cfg.addresses);
            }
            if !cfg.topics.is_empty() {
                info!("Topics: {:?}", cfg.topics);
            }
            if let Some(erc20_addr) = &cfg.erc20_transfers_for {
                info!("ERC-20 transfers for: {}", erc20_addr);
            }
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
        cli::Method::GetBalance => {
            methods::run_get_balance(cfg, &indexer, start).await?;
        }
        cli::Method::GetLogs => {
            methods::run_get_logs(cfg, &indexer, start).await?;
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
