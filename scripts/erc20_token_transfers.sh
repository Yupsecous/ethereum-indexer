#!/usr/bin/env bash

set -euo pipefail

# Example: Track ALL transfers of a specific ERC-20 token
# This shows every transfer of USDC token between any addresses

cargo run --release -p indexer-cli -- \
    --rpc https://reth-ethereum.ithaca.xyz/rpc \
    --method get-logs \
    --erc20-token-transfers 0xaa7a9ca87d3694b5755f213b5d04094b8d0f0a6f \
    --from 4961000 \
    --to 4962000 \
    --chunk-size 1000 \
    --parallel-requests-per-rpc 5
