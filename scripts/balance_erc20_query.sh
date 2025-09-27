#!/usr/bin/env bash

set -euo pipefail

# PayPal USD \
# https://etherscan.io/block/22823610
# The block has the following date (Jul-01-2025 09:51:23 AM +UTC)
# To calucate based of the balanceOf for YYYY-MM-DD 00:00 UTC time 
# For 2025-07-01 should be 0
# For 2025-07-02 should be 1009 raw units

cargo run --release -p indexer-cli -- \
    --rpc https://reth-ethereum.ithaca.xyz/rpc \
    --method get-erc20-balance \
    --token-address 0x6c3ea9036406852006290770bedfcaba0e23a0e8 \
    --address 0x870585E3AF9dA7ff5dcd8f897EA0756f60F69cc1 \
    --date 2025-07-02 \
    --parallel-requests-per-rpc 3
