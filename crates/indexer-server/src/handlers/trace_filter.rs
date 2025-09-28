use crate::types::TraceFilterQuery;
use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    response::Json,
};
use futures::StreamExt;
use indexer::{EthereumIndexer, TraceFilterBuilder, TraceFilterPlan, order_by_range};
use std::sync::Arc;
use tracing::info;

pub async fn trace_filter_no_address(
    State(engine): State<Arc<EthereumIndexer>>,
    Query(params): Query<TraceFilterQuery>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    trace_filter_impl(engine, None, params).await
}

pub async fn trace_filter_with_address(
    State(engine): State<Arc<EthereumIndexer>>,
    Path(address): Path<String>,
    Query(params): Query<TraceFilterQuery>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    trace_filter_impl(engine, Some(address), params).await
}

async fn trace_filter_impl(
    engine: Arc<EthereumIndexer>,
    address: Option<String>,
    params: TraceFilterQuery,
) -> Result<Json<serde_json::Value>, StatusCode> {
    let start_block = params.startblock.unwrap_or(0);
    let end_block = params.endblock.unwrap_or(start_block + 100);

    info!(
        "trace_filter request: address={:?}, start={}, end={}",
        address, start_block, end_block
    );

    if end_block < start_block {
        return Err(StatusCode::BAD_REQUEST);
    }

    let mut builder = TraceFilterBuilder::new()
        .start_block(start_block)
        .end_block(end_block)
        .chunk_size(3_000)
        .limits(100_000, 10_000);

    if let Some(addr_str) = address {
        match addr_str.parse() {
            Ok(addr) => {
                builder = builder.target(addr);
            }
            Err(_) => {
                info!("Invalid address format: {}", addr_str);
                return Err(StatusCode::BAD_REQUEST);
            }
        }
    }

    let plan = match builder.plan() {
        Ok(p) => p,
        Err(e) => {
            info!("Plan creation failed: {}", e);
            return Err(StatusCode::BAD_REQUEST);
        }
    };

    let work_items = match plan.plan() {
        Ok(items) => items,
        Err(e) => {
            info!("Work item creation failed: {}", e);
            return Err(StatusCode::INTERNAL_SERVER_ERROR);
        }
    };

    // Configure response size limits
    let max_results = std::env::var("MAX_TRACE_RESULTS")
        .ok()
        .and_then(|s| s.parse::<usize>().ok())
        .unwrap_or(10_000); // Default limit of 10,000 traces

    let stream = order_by_range(engine.run(work_items), plan.range.from);
    let mut results = Vec::new();
    let mut total_processed = 0;

    tokio::pin!(stream);
    while let Some(item) = stream.next().await {
        match item {
            Ok((range, data)) => {
                match TraceFilterPlan::decode(data) {
                    Ok(traces) => {
                        // Filter for non-internal transactions only
                        let filtered_traces: Vec<_> = traces
                            .into_iter()
                            .filter(|t| t.trace.trace_address.is_empty())
                            .collect();

                        // Check if adding these results would exceed our limit
                        if results.len() + filtered_traces.len() > max_results {
                            let remaining = max_results - results.len();
                            if remaining > 0 {
                                results.extend(filtered_traces.into_iter().take(remaining));
                            }

                            info!(
                                "Result limit reached: {} traces (limit: {}). Truncating response.",
                                results.len(),
                                max_results
                            );
                            break;
                        }

                        results.extend(filtered_traces);
                        total_processed += 1;
                    }
                    Err(e) => {
                        info!(
                            "Decode error for range {}-{}: {}, skipping malformed response",
                            range.from, range.to, e
                        );
                        // Continue processing other ranges instead of silent failure
                    }
                }
            }
            Err(e) => {
                info!("Stream error: {}", e);
                return Err(StatusCode::INTERNAL_SERVER_ERROR);
            }
        }
    }

    info!(
        "Returning {} filtered traces from {} processed ranges",
        results.len(),
        total_processed
    );

    // Safe JSON serialization with better error handling
    match serde_json::to_value(results) {
        Ok(json_value) => Ok(Json(json_value)),
        Err(e) => {
            info!("JSON serialization error: {}", e);
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
}
