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

# ERC-20 balance queries
./scripts/erc20_balance_query.sh

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
cargo run -p indexer-cli -- --method get-erc20-balance --rpc URL --token-address 0x... --address 0x... --date 2024-01-01

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
| `erc20_balance_query.sh` | Get ERC-20 token balance at a specific date |
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
- `GET /api/eth/getBalance/{address}/{date}` - ETH balance at date (YYYY-MM-DD format, 00:00 UTC)
- `GET /api/eth/getBalance/{address}/{date}?block_range_lo=N&block_range_hi=N` - With explicit block ranges
- `GET /api/eth/getBalance/{address}/{date}?on_miss=strict` - With custom miss handling policy
- `GET /api/eth/getErc20Balance/{token_address}/{owner_address}/{date}` - ERC-20 token balance at date
- `GET /api/eth/getErc20Balance/{token_address}/{owner_address}/{date}?block_range_lo=N&block_range_hi=N` - With explicit block ranges

**Log Queries:**
- `GET /api/eth/getLogs?from=N&to=N&addresses=0x...&topics=0x...` - General contract logs
- `GET /api/eth/getLogs/erc20/wallet/{address}?from=N&to=N&tokens=0x...` - ERC-20 transfers to/from wallet
- `GET /api/eth/getLogs/erc20/token/{address}?from=N&to=N` - All transfers of specific ERC-20 token

### Balance Query Examples

**ETH Balance:**
```bash
curl "http://localhost:8080/api/eth/getBalance/0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045/2024-01-01"
```

**ERC-20 Balance:**
```bash
curl "http://localhost:8080/api/eth/getErc20Balance/0x6c3ea9036406852006290770bedfcaba0e23a0e8/0x870585E3AF9dA7ff5dcd8f897EA0756f60F69cc1/2025-07-02"
```

### Log Query Examples

**General Logs:**
```bash
curl "http://localhost:8080/api/eth/getLogs?from=4961600&to=4961700&addresses=0xA0b86a33E6441b73aE6b5b0e48e95AD1A756b3a5"
```

**ERC-20 Wallet Transfers:**
```bash
curl "http://localhost:8080/api/eth/getLogs/erc20/wallet/0xaa7a9ca87d3694b5755f213b5d04094b8d0f0a6f?from=4961600&to=4961700"
```

**ERC-20 Token Transfers:**
```bash
curl "http://localhost:8080/api/eth/getLogs/erc20/token/0xaa7a9ca87d3694b5755f213b5d04094b8d0f0a6f?from=4961600&to=4961700"
```
