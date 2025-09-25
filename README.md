# Ethereum Indexer

High-performance Ethereum RPC indexing with load balancing and parallel processing.

## Crates

- `indexer` - Core library with stream processing
- `indexer-server` - Axum web server
- `indexer-cli` - Benchmarking CLI

## CLI Commands

```bash
# Trace filter
cargo run -p indexer-cli -- --method trace-filter --rpc URL --target-address 0x... --start-block N --end-block N

# Block by number
cargo run -p indexer-cli -- --method get-block-by-number --rpc URL --start-block N --end-block N --full

# Transaction by hash
cargo run -p indexer-cli -- --method get-transaction-by-hash --rpc URL --hashes 0x... 0x...

# Transaction receipt
cargo run -p indexer-cli -- --method get-transaction-receipt --rpc URL --hashes 0x... 0x...
```

## Server

```bash
cargo run -p indexer-server
```

### Endpoints

- `GET /api/trace/filter/{address}?startblock=N&endblock=N`
- `GET /api/eth/getBlockByNumber/{number}?from=N&to=N&full=true`
- `GET /api/eth/getTransactionByHash/{hash}`
- `GET /api/eth/getTransactionReceipt/{hash}`
