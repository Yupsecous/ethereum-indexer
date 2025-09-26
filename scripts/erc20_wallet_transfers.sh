#!/usr/bin/env bash

set -euo pipefail

# Example: Track ERC-20 transfers to/from a wallet address
# This shows all ERC-20 tokens transferred to or from the specified wallet

cargo run --release -p indexer-cli -- \
    --rpc https://reth-ethereum.ithaca.xyz/rpc \
    --method get-logs \
    --erc20-transfers-for 0xaa7a9ca87d3694b5755f213b5d04094b8d0f0a6f \
    --from 4961000 \
    --to 4962000 \
    --chunk-size 1000 \
    --parallel-requests-per-rpc 5
