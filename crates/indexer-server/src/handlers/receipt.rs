use alloy::primitives::B256;
use axum::{
    extract::{Path, State},
    http::StatusCode,
    response::Json,
};
use futures::StreamExt;
use indexer::{EthereumIndexer, TxReceiptBuilder, TxReceiptPlan};
use std::sync::Arc;
use tracing::info;

pub async fn get_transaction_receipt(
    State(engine): State<Arc<EthereumIndexer>>,
    Path(hash): Path<String>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    info!("getTransactionReceipt request: hash={}", hash);

    let tx_hash: B256 = match hash.parse() {
        Ok(h) => h,
        Err(_) => {
            info!("Invalid hash format: {}", hash);
            return Err(StatusCode::BAD_REQUEST);
        }
    };

    let plan = match TxReceiptBuilder::new().push(tx_hash).limit(1).plan() {
        Ok(p) => p,
        Err(e) => {
            info!("Plan creation failed: {}", e);
            return Err(StatusCode::BAD_REQUEST);
        }
    };

    let mut stream = engine.run(plan.plan());

    if let Some(result) = stream.next().await {
        match result {
            Ok((_key, data)) => match TxReceiptPlan::decode(data) {
                Ok(Some(receipt)) => {
                    info!("Receipt found: {}", hash);
                    Ok(Json(serde_json::to_value(receipt).unwrap()))
                }
                Ok(None) => {
                    info!("Receipt not found: {}", hash);
                    Err(StatusCode::NOT_FOUND)
                }
                Err(e) => {
                    info!("Decode error: {}", e);
                    Err(StatusCode::INTERNAL_SERVER_ERROR)
                }
            },
            Err(e) => {
                info!("Stream error: {}", e);
                Err(StatusCode::INTERNAL_SERVER_ERROR)
            }
        }
    } else {
        info!("No result from stream: {}", hash);
        Err(StatusCode::NOT_FOUND)
    }
}
