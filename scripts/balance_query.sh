#!/usr/bin/env bash

set -euo pipefail

# Example: Get ETH balance for an address at a specific date
# This queries the balance at 00:00 UTC on the specified date
#
# https://etherscan.io/block/302086
# The block has the following date (Sep-28-2015 08:24:43 AM +UTC)
# To calucate based of the balanceOf for YYYY-MM-DD 00:00 UTC time 
# For 2015-09-28 should be 0
# For 2015-09-29 should be 0.25 ETH

cargo run --release -p indexer-cli -- \
    --rpc https://reth-ethereum.ithaca.xyz/rpc \
    --method get-balance \
    --address 0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045 \
    --date 2015-09-29 \
    --parallel-requests-per-rpc 5
