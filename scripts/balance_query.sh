#!/usr/bin/env bash

set -euo pipefail

# Example: Get ETH balance for an address at a specific date
# This queries the balance at 00:00 UTC on the specified date

cargo run --release -p indexer-cli -- \
    --rpc https://reth-ethereum.ithaca.xyz/rpc \
    --method get-balance \
    --address 0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045 \
    --date 2024-01-01 \
    --parallel-requests-per-rpc 5