#!/usr/bin/env bash

set -euo pipefail

cargo run --release -p indexer-cli -- \
    --rpc https://reth-ethereum.ithaca.xyz/rpc \
    --method get-block-by-number \
    --from 21400000 \
    --to 21401000 \
    --chunk-size 1000 \
    --parallel-requests-per-rpc 20 \
    --full
