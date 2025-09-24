mod handlers;
mod types;

use axum::{Router, routing::get};
use indexer::EngineBuilder;
use std::sync::Arc;
use tokio::net::TcpListener;
use tracing::info;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    tracing_subscriber::fmt::init();

    let rpc_urls: Vec<_> = std::env::var("RPC_URLS")
        .unwrap_or_else(|_| "https://eth.drpc.org".to_string())
        .split(',')
        .map(|url| url.trim().parse())
        .collect::<Result<Vec<_>, _>>()?;

    info!("Building engine with {} RPC endpoints", rpc_urls.len());

    let engine = EngineBuilder::new()
        .rpc_urls(rpc_urls)
        .parallel_per_rpc(20)
        .retry(10, 1000, 500)
        .build()?;

    let shared_engine = Arc::new(engine);

    let app = Router::new()
        .route("/ping", get(handlers::ping))
        .route("/api/trace-filter", get(handlers::trace_filter_no_address))
        .route("/api/trace-filter/{address}", get(handlers::trace_filter_with_address))
        .with_state(shared_engine);

    let port = std::env::var("PORT")
        .unwrap_or_else(|_| "3000".to_string())
        .parse::<u16>()
        .unwrap_or(3000);

    let addr = format!("0.0.0.0:{}", port);
    let listener = TcpListener::bind(&addr).await?;

    info!("Server listening on {}", addr);
    axum::serve(listener, app).await?;

    Ok(())
}
