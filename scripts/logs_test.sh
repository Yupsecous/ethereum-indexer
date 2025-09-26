#!/usr/bin/env bash

set -euo pipefail

cargo run --release -p indexer-cli -- \
    --rpc https://reth-ethereum.ithaca.xyz/rpc \
    --method get-logs \
    --erc20-transfers-for 0x8f714C30c44fA949AD89970d3c5D34Dc960efE43 \
    --from 4700000 \
    --to 4720000 \
    --chunk-size 3000 \
    --parallel-requests-per-rpc 3

# #!/usr/bin/env bash
#
# set -euo pipefail
#
# cargo run --release -p indexer-cli -- \
#     --rpc https://reth-ethereum.ithaca.xyz/rpc \
#     --method get-logs \
#     --from 18000000 \
#     --to 18000005 \
#     --chunk-size 300 \
#     --parallel-requests-per-rpc 10 \
#     --addresses 0xA0b86a33E6441b73aE6b5b0e48e95AD1A756b3a5  # Example: popular
#       contract address
#
#       Or for ERC-20 transfers:
#
# #!/usr/bin/env bash
#
# set -euo pipefail
#
# cargo run --release -p indexer-cli -- \
#     --rpc https://reth-ethereum.ithaca.xyz/rpc \
#     --method get-logs \
#     --from 18000000 \
#     --to 18000005 \
#     --chunk-size 300 \
#     --parallel-requests-per-rpc 10 \
#     --erc20-transfers-for 0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045  # Watch
#       transfers for this address
