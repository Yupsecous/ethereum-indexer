#!/usr/bin/env bash

set -euo pipefail

# Example: Get logs from specific contract addresses
# This shows general log filtering for contract events

cargo run --release -p indexer-cli -- \
    --rpc https://reth-ethereum.ithaca.xyz/rpc \
    --method get-logs \
    --addresses 0xA0b86a33E6441b73aE6b5b0e48e95AD1A756b3a5 \
    --from 18000000 \
    --to 18000050 \
    --chunk-size 500 \
    --parallel-requests-per-rpc 5