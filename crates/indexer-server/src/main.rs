mod handlers;
mod types;

use alloy::transports::http::reqwest::Url;
use axum::{Router, routing::get};
use handlers::{
    get_balance_at_date, get_block_by_number, get_erc20_balance_at_date, get_logs_erc20_token,
    get_logs_erc20_wallet, get_logs_general, get_transaction_by_hash, get_transaction_receipt,
    ping, rpc_info, trace_filter_no_address, trace_filter_with_address,
};
use indexer::EngineBuilder;
use std::sync::Arc;
use tokio::net::TcpListener;
use tower::ServiceBuilder;
use tower_http::cors::{Any, CorsLayer};
use tracing::info;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    tracing_subscriber::fmt::init();

    let rpc_urls: Vec<Url> = std::env::var("RPC_URLS")
        .unwrap_or_else(|_| "https://eth.drpc.org".to_string())
        .split(',')
        .map(|url| url.trim().parse())
        .collect::<Result<Vec<_>, _>>()?;

    info!("Building Engine with {} RPC endpoints", rpc_urls.len(),);
    for url in 0..rpc_urls.len() {
        info!("- {}", rpc_urls[url]);
    }

    let engine = EngineBuilder::new()
        .rpc_urls(rpc_urls)
        .parallel_per_rpc(20)
        .retry(10, 1000, 500)
        .build()?;

    let shared_engine = Arc::new(engine);

    let app = Router::new()
        .route("/ping", get(ping))
        .route("/api/rpc-info", get(rpc_info))
        .route("/api/trace/filter", get(trace_filter_no_address))
        .route(
            "/api/trace/filter/{address}",
            get(trace_filter_with_address),
        )
        .route(
            "/api/eth/getBlockByNumber/{number}",
            get(get_block_by_number),
        )
        .route(
            "/api/eth/getTransactionByHash/{hash}",
            get(get_transaction_by_hash),
        )
        .route(
            "/api/eth/getTransactionReceipt/{hash}",
            get(get_transaction_receipt),
        )
        .route(
            "/api/eth/getBalance/{address}/{date}",
            get(get_balance_at_date),
        )
        .route(
            "/api/eth/getErc20Balance/{token_address}/{owner_address}/{date}",
            get(get_erc20_balance_at_date),
        )
        .route("/api/eth/getLogs", get(get_logs_general))
        .route(
            "/api/eth/getLogs/erc20/wallet/{address}",
            get(get_logs_erc20_wallet),
        )
        .route(
            "/api/eth/getLogs/erc20/token/{address}",
            get(get_logs_erc20_token),
        )
        .layer(
            ServiceBuilder::new().layer(
                CorsLayer::new()
                    .allow_origin(Any)
                    .allow_methods(Any)
                    .allow_headers(Any),
            ),
        )
        .with_state(shared_engine);

    let port = std::env::var("PORT")
        .unwrap_or_else(|_| "8080".to_string())
        .parse::<u16>()
        .unwrap_or(8080);

    let addr = format!("0.0.0.0:{}", port);
    let listener = TcpListener::bind(&addr).await?;

    info!("Server listening on {}", addr);
    axum::serve(listener, app).await?;

    Ok(())
}
