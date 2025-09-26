# Ethereum Indexer

High-performance Ethereum RPC indexing with load balancing and parallel processing.

## Quick Start

Try the example scripts in the `./scripts/` directory:

```bash
# ERC-20 wallet transfers
./scripts/erc20_wallet_transfers.sh

# ERC-20 token transfers
./scripts/erc20_token_transfers.sh

# General contract logs
./scripts/general_logs.sh

# Balance queries
./scripts/balance_query.sh

# Trace filtering
./scripts/quick_test.sh

# Block queries
./scripts/block_bench.sh
```

## Crates

- `indexer` - Core library with stream processing
- `indexer-server` - Axum web server
- `indexer-cli` - Benchmarking and testing CLI

## Recommended RPC Endpoints

For best performance, use these public RPC endpoints (ordered by reliability):

```bash
# Primary recommendations (fastest & most reliable)
https://reth-ethereum.ithaca.xyz/rpc
https://eth.drpc.org
https://eth.meowrpc.com

# Additional options
https://ethereum.publicnode.com
https://eth.llamarpc.com
https://1rpc.io/eth
https://rpc.flashbots.net
https://ethereum-json-rpc.stakely.io
```

## CLI Commands

See working examples in `./scripts/` directory. Basic command patterns:

```bash
# Trace filter
cargo run -p indexer-cli -- --method trace-filter --rpc URL --target-address 0x... --from N --to N

# Block queries
cargo run -p indexer-cli -- --method get-block-by-number --rpc URL --from N --to N --full
cargo run -p indexer-cli -- --method get-block-by-number --rpc URL --tag latest
cargo run -p indexer-cli -- --method get-block-by-number --rpc URL --numbers 18000000 18000005

# Transaction queries
cargo run -p indexer-cli -- --method get-transaction-by-hash --rpc URL --hashes 0x...
cargo run -p indexer-cli -- --method get-transaction-receipt --rpc URL --hashes 0x...

# Balance queries
cargo run -p indexer-cli -- --method get-balance --rpc URL --address 0x... --date 2024-01-01

# Log queries
cargo run -p indexer-cli -- --method get-logs --rpc URL --from N --to N --addresses 0x...
cargo run -p indexer-cli -- --method get-logs --rpc URL --from N --to N --erc20-transfers-for 0x...
cargo run -p indexer-cli -- --method get-logs --rpc URL --from N --to N --erc20-token-transfers 0x...
```

### ERC-20 Transfer Options

The `get-logs` method supports two distinct ERC-20 transfer tracking modes:

- **`--erc20-transfers-for <WALLET>`**: Tracks all ERC-20 transfers **to or from** a specific wallet address across all tokens
  - Shows transfers where the wallet is either the sender (FROM) or receiver (TO)
  - Useful for tracking a wallet's complete ERC-20 activity
  - Dual-lane processing: separate streams for incoming/outgoing transfers

- **`--erc20-token-transfers <TOKEN>`**: Tracks **all transfers** of a specific ERC-20 token contract
  - Shows every transfer of that token between any addresses
  - Useful for analyzing token distribution and movement
  - Single-stream processing for all token activity

Both options are mutually exclusive and automatically decode Transfer events with proper ERC-20 signature validation.

## Example Scripts

The `./scripts/` directory contains ready-to-run examples:

| Script | Description |
|--------|-------------|
| `erc20_wallet_transfers.sh` | Track ERC-20 transfers to/from a specific wallet |
| `erc20_token_transfers.sh` | Track ALL transfers of a specific ERC-20 token |
| `general_logs.sh` | Query logs from specific contract addresses |
| `balance_query.sh` | Get ETH balance at a specific date |
| `logs_test.sh` | Original ERC-20 wallet transfer test |
| `quick_test.sh` | Trace filter benchmark |
| `block_bench.sh` | Block query benchmark |

All scripts use the recommended RPC endpoints and optimal performance settings.

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

