use crate::types::{PingResponse, TraceFilterQuery};
use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    response::Json,
};
use futures::StreamExt;
use indexer::{EthereumIndexer, TraceFilterBuilder, TraceFilterPlan, order_by_range};
use std::sync::Arc;
use tracing::info;

pub async fn ping() -> Json<PingResponse> {
    Json(PingResponse {
        message: "pong!".to_string(),
    })
}

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

    info!("trace_filter request: address={:?}, start={}, end={}", address, start_block, end_block);

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

    let stream = order_by_range(engine.run(plan.plan()), plan.range.from);
    let mut results = Vec::new();

    tokio::pin!(stream);
    while let Some(item) = stream.next().await {
        match item {
            Ok((_range, data)) => {
                if let Ok(traces) = TraceFilterPlan::decode(data) {
                    // Filter for non-internal transactions only (like CLI)
                    let filtered_traces: Vec<_> = traces
                        .into_iter()
                        .filter(|t| t.trace.trace_address.is_empty())
                        .collect();

                    results.extend(filtered_traces);
                }
            }
            Err(e) => {
                info!("Stream error: {}", e);
                return Err(StatusCode::INTERNAL_SERVER_ERROR);
            }
        }
    }

    info!("Returning {} filtered traces", results.len());
    Ok(Json(serde_json::to_value(results).unwrap()))
}
