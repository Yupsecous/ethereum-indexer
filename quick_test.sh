#!/usr/bin/env bash

set -euo pipefail

cargo run --release -p indexer-cli -- \
    --rpc https://eth.drpc.org \
    --method trace-filter \
    --target-address 0xaA7a9CA87d3694B5755f213B5D04094b8d0F0A6F \
    --start-block 21400002 \
    --end-block 22400000 \
    --chunk-size 3000 \
    --parallel-requests-per-rpc 10
