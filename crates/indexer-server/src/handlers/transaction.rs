use axum::{
    extract::{Path, State},
    http::StatusCode,
    response::Json,
};
use futures::StreamExt;
use indexer::{EthereumIndexer, TxByHashBuilder, TxByHashPlan};
use std::sync::Arc;
use tracing::info;
use alloy::primitives::B256;

pub async fn get_transaction_by_hash(
    State(engine): State<Arc<EthereumIndexer>>,
    Path(hash): Path<String>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    info!("getTransactionByHash request: hash={}", hash);

    let tx_hash: B256 = match hash.parse() {
        Ok(h) => h,
        Err(_) => {
            info!("Invalid hash format: {}", hash);
            return Err(StatusCode::BAD_REQUEST);
        }
    };

    let plan = match TxByHashBuilder::new().push(tx_hash).limit(1).plan() {
        Ok(p) => p,
        Err(e) => {
            info!("Plan creation failed: {}", e);
            return Err(StatusCode::BAD_REQUEST);
        }
    };

    let mut stream = engine.run(plan.plan());

    if let Some(result) = stream.next().await {
        match result {
            Ok((_key, data)) => match TxByHashPlan::decode(data) {
                Ok(Some(transaction)) => {
                    info!("Transaction found: {}", hash);
                    Ok(Json(serde_json::to_value(transaction).unwrap()))
                }
                Ok(None) => {
                    info!("Transaction not found: {}", hash);
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
