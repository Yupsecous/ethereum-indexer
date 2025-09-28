# Ethereum Indexer CLI Documentation

This document provides a guide to using the `indexer-cli`, a command-line tool for interacting directly with the `indexer` engine. It's primarily used for benchmarking, testing, and running direct queries against Ethereum RPC endpoints.

## General Usage

The basic command structure is as follows:

```bash
cargo run --release -p indexer-cli -- --method <METHOD> --rpc <URL> [OPTIONS...]
```

### Global Options

These options are applicable to all methods:

-   `--rpc <URL>`: (Required) The RPC endpoint URL. You can provide this flag multiple times to use multiple RPCs for load balancing.
-   `--parallel-requests-per-rpc <NUMBER>`: The number of parallel requests to send to each RPC endpoint. Defaults to `5`.

---

## Methods

### `trace-filter`

Fetches transaction traces for a specific address within a block range.

**Options**:
-   `--target-address <ADDRESS>`: (Required) The wallet address to get traces for.
-   `--from <BLOCK>`: (Required) The starting block number.
-   `--to <BLOCK>`: (Required) The ending block number.
-   `--chunk-size <NUMBER>`: The size of block ranges for each parallel request. Defaults to `50`.

**Example** (from `scripts/quick_test.sh`):
```bash
cargo run --release -p indexer-cli -- \
    --rpc https://eth.drpc.org \
    --method trace-filter \
    --target-address 0xaA7a9CA87d3694B5755f213B5D04094b8d0F0A6F \
    --from 21400002 \
    --to 22400000 \
    --chunk-size 3000 \
    --parallel-requests-per-rpc 10
```

### `get-block-by-number`

Retrieves block data. Can be used for a single block, a list of blocks, or a range.

**Options**:
-   `--from <BLOCK>` / `--to <BLOCK>`: Get all blocks within this inclusive range.
-   `--numbers <NUMBERS...>`: A space-separated list of specific block numbers to get.
-   `--tag <TAG>`: Get a single block by a tag (e.g., `latest`, `safe`, `finalized`).
-   `--full`: A flag to fetch full transaction objects within the blocks. If omitted, only transaction hashes are returned.

**Example** (from `scripts/block_bench.sh`):
```bash
cargo run --release -p indexer-cli -- \
    --rpc https://reth-ethereum.ithaca.xyz/rpc \
    --method get-block-by-number \
    --from 21400000 \
    --to 21401000 \
    --chunk-size 1000 \
    --parallel-requests-per-rpc 20 \
    --full
```

### `get-transaction-by-hash`

Retrieves one or more full transaction objects by their hashes.

**Options**:
-   `--hashes <HASHES...>`: (Required) A space-separated list of transaction hashes.

**Example**:
```bash
cargo run --release -p indexer-cli -- \
    --rpc https://reth-ethereum.ithaca.xyz/rpc \
    --method get-transaction-by-hash \
    --hashes 0x...hash1 0x...hash2
```

### `get-transaction-receipt`

Retrieves one or more transaction receipts by their hashes.

**Options**:
-   `--hashes <HASHES...>`: (Required) A space-separated list of transaction hashes.

**Example**:
```bash
cargo run --release -p indexer-cli -- \
    --rpc https://reth-ethereum.ithaca.xyz/rpc \
    --method get-transaction-receipt \
    --hashes 0x...hash1 0x...hash2
```

### `get-balance`

Gets the ETH balance of an address at `00:00:00 UTC` on a specific date.

**Options**:
-   `--address <ADDRESS>`: (Required) The address to query.
-   `--date <YYYY-MM-DD>`: (Required) The target date.
-   `--block-range-lo <BLOCK>` / `--block-range-hi <BLOCK>`: (Optional) The block range to search for the target timestamp.

**Example** (from `scripts/balance_query.sh`):
```bash
cargo run --release -p indexer-cli -- \
    --rpc https://reth-ethereum.ithaca.xyz/rpc \
    --method get-balance \
    --address 0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045 \
    --date 2015-09-29
```

### `get-erc20-balance`

Gets the ERC-20 token balance of an address at `00:00:00 UTC` on a specific date.

**Options**:
-   `--token-address <ADDRESS>`: (Required) The ERC-20 token contract address.
-   `--address <ADDRESS>`: (Required) The owner address to query.
-   `--date <YYYY-MM-DD>`: (Required) The target date.

**Example** (from `scripts/balance_erc20_query.sh`):
```bash
cargo run --release -p indexer-cli -- \
    --rpc https://reth-ethereum.ithaca.xyz/rpc \
    --method get-erc20-balance \
    --token-address 0x6c3ea9036406852006290770bedfcaba0e23a0e8 \
    --address 0x870585E3AF9dA7ff5dcd8f897EA0756f60F69cc1 \
    --date 2025-07-02
```

### `get-logs`

Fetches event logs and supports three distinct modes.

**1. General Logs**

Fetches logs based on contract addresses and topics.

-   **Options**:
    -   `--from <BLOCK>` / `--to <BLOCK>`: (Required) The block range.
    -   `--addresses <ADDRESSES...>`: (Required) A list of contract addresses.
    -   `--topics <TOPICS...>`: (Optional) A list of event topics to filter by.
-   **Example** (from `scripts/general_logs.sh`):
    ```bash
cargo run --release -p indexer-cli -- \
        --rpc https://reth-ethereum.ithaca.xyz/rpc \
        --method get-logs \
        --addresses 0xA0b86a33E6441b73aE6b5b0e48e95AD1A756b3a5 \
        --from 18000000 \
        --to 18000050
    ```

**2. ERC-20 Wallet Transfers**

Tracks all ERC-20 `Transfer` events to or from a specific wallet.

-   **Options**:
    -   `--erc20-transfers-for <ADDRESS>`: (Required) The wallet address to track.
    -   `--from <BLOCK>` / `--to <BLOCK>`: (Required) The block range.
-   **Example** (from `scripts/erc20_wallet_transfers.sh`):
    ```bash
cargo run --release -p indexer-cli -- \
        --rpc https://reth-ethereum.ithaca.xyz/rpc \
        --method get-logs \
        --erc20-transfers-for 0xaa7a9ca87d3694b5755f213b5d04094b8d0f0a6f \
        --from 4961000 \
        --to 4962000
    ```

**3. ERC-20 Token Transfers**

Tracks all `Transfer` events for a specific ERC-20 token contract.

-   **Options**:
    -   `--erc20-token-transfers <ADDRESS>`: (Required) The token contract address.
    -   `--from <BLOCK>` / `--to <BLOCK>`: (Required) The block range.
-   **Example** (from `scripts/erc20_token_transfers.sh`):
    ```bash
cargo run --release -p indexer-cli -- \
        --rpc https://reth-ethereum.ithaca.xyz/rpc \
        --method get-logs \
        --erc20-token-transfers 0xaa7a9ca87d3694b5755f213b5d04094b8d0f0a6f \
        --from 4961000 \
        --to 4962000
    ```
