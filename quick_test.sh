#!/usr/bin/env bash

set -euo pipefail

cargo run --release -- \
    --rpc https://eth.drpc.org \
    --target-address 0xaA7a9CA87d3694B5755f213B5D04094b8d0F0A6F \
    --start-block 22426500 \
    --end-block 23426500 \
    --chunk-size 3000 \
    --parallel-requests-per-rpc 10
