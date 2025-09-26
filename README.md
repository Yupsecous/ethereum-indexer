# Ethereum Indexer

High-performance Ethereum RPC indexing with load balancing and parallel processing.

## Crates

- `indexer` - Core library with stream processing
- `indexer-server` - Axum web server
- `indexer-cli` - Benchmarking and testing CLI

## CLI Commands

```bash
# Trace filter
cargo run -p indexer-cli -- --method trace-filter --rpc URL --target-address 0x... --from N --to N

# Block by range
cargo run -p indexer-cli -- --method get-block-by-number --rpc URL --from N --to N --full

# Block by tag
cargo run -p indexer-cli -- --method get-block-by-number --rpc URL --tag latest --full
cargo run -p indexer-cli -- --method get-block-by-number --rpc URL --tag safe

# Block by specific numbers
cargo run -p indexer-cli -- --method get-block-by-number --rpc URL --numbers 18000000 18000005 18000010

# Transaction by hash
cargo run -p indexer-cli -- --method get-transaction-by-hash --rpc URL --hashes 0x... 0x...

# Transaction receipt
cargo run -p indexer-cli -- --method get-transaction-receipt --rpc URL --hashes 0x... 0x...

# Balance at date
cargo run -p indexer-cli -- --method get-balance --rpc URL --address 0x... --date 2024-01-01

# Balance at date with explicit block ranges (for better performance)
cargo run -p indexer-cli -- --method get-balance --rpc URL --address 0x... --date 2024-01-01 --block-range-lo 18900000 --block-range-hi 19100000

# Get logs from contracts
cargo run -p indexer-cli -- --method get-logs --rpc URL --from N --to N --addresses 0x...

# ERC-20 transfers for address
cargo run -p indexer-cli -- --method get-logs --rpc URL --from N --to N --erc20-transfers-for 0x...

## Server

```bash
cargo run -p indexer-server
```

### Endpoints

**Trace Filter:**
- `GET /api/trace/filter/{address}?startblock=N&endblock=N`

**Block Queries:**
- `GET /api/eth/getBlockByNumber/latest` - Latest block
- `GET /api/eth/getBlockByNumber/safe` - Safe block
- `GET /api/eth/getBlockByNumber/finalized` - Finalized block
- `GET /api/eth/getBlockByNumber/18000000` - Specific block number
- `GET /api/eth/getBlockByNumber/0x112a880` - Hex block number
- `GET /api/eth/getBlockByNumber/18000000?from=N&to=N&full=true` - Range query

**Transaction Queries:**
- `GET /api/eth/getTransactionByHash/{hash}`
- `GET /api/eth/getTransactionReceipt/{hash}`

**Balance Queries:**
- `GET /api/eth/getBalance/{address}/{date}` - Balance at date (YYYY-MM-DD format, 00:00 UTC)
- `GET /api/eth/getBalance/{address}/{date}?block_range_lo=N&block_range_hi=N` - With explicit block ranges
- `GET /api/eth/getBalance/{address}/{date}?on_miss=strict` - With custom miss handling policy

