#!/usr/bin/env bash

set -e

# ANSI color codes
RED='\033[31m'
GREEN='\033[32m'
YELLOW='\033[33m'
BLUE='\033[34m'
PURPLE='\033[35m'
CYAN='\033[36m'
BOLD='\033[1m'
RESET='\033[0m'

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
FRONT_DIR="$PROJECT_ROOT/front"

# Header
echo -e "${BOLD}${BLUE}================================${RESET}"
echo -e "${BOLD}${BLUE}  Ethereum Indexer Setup${RESET}"
echo -e "${BOLD}${BLUE}================================${RESET}"
echo

# Check prerequisites
echo -e "${BOLD}Checking prerequisites...${RESET}"
echo

# Check Rust
if ! command -v rustc &> /dev/null; then
    echo -e "${RED}✗ Rust not found${RESET}"
    echo -e "${YELLOW}  Install Rust: https://rustup.rs/${RESET}"
    exit 1
else
    RUST_VERSION=$(rustc --version | cut -d' ' -f2)
    echo -e "${GREEN}✓ Rust ${RUST_VERSION}${RESET}"
fi

# Check Cargo
if ! command -v cargo &> /dev/null; then
    echo -e "${RED}✗ Cargo not found${RESET}"
    echo -e "${YELLOW}  Cargo should be installed with Rust${RESET}"
    exit 1
else
    CARGO_VERSION=$(cargo --version | cut -d' ' -f2)
    echo -e "${GREEN}✓ Cargo ${CARGO_VERSION}${RESET}"
fi

# Check Node.js
if ! command -v node &> /dev/null; then
    echo -e "${RED}✗ Node.js not found${RESET}"
    echo -e "${YELLOW}  Install Node.js >=18: https://nodejs.org/${RESET}"
    exit 1
else
    NODE_VERSION=$(node --version | sed 's/v//')
    NODE_MAJOR=$(echo $NODE_VERSION | cut -d'.' -f1)
    if [ "$NODE_MAJOR" -lt 18 ]; then
        echo -e "${RED}✗ Node.js ${NODE_VERSION} (requires >=18)${RESET}"
        echo -e "${YELLOW}  Update Node.js: https://nodejs.org/${RESET}"
        exit 1
    else
        echo -e "${GREEN}✓ Node.js ${NODE_VERSION}${RESET}"
    fi
fi

# Check npm
if ! command -v npm &> /dev/null; then
    echo -e "${RED}✗ npm not found${RESET}"
    echo -e "${YELLOW}  npm should be installed with Node.js${RESET}"
    exit 1
else
    NPM_VERSION=$(npm --version)
    echo -e "${GREEN}✓ npm ${NPM_VERSION}${RESET}"
fi

echo
echo -e "${BOLD}${GREEN}All prerequisites satisfied!${RESET}"
echo

# RPC Selection
echo -e "${BOLD}Select RPC provider:${RESET}"
echo -e "${BLUE}1.${RESET} DRPC (25k blocks/chunk)"
echo -e "${BLUE}2.${RESET} Ithaca RPC (100 blocks/chunk)"
echo -e "${BLUE}3.${RESET} Custom RPC (advanced)"
echo

read -p "Enter choice (1, 2, or 3): " choice

case $choice in
    1)
        RPC_URL="https://eth.drpc.org"
        CHUNK_SIZE="25000"
        echo -e "${GREEN}Selected: DRPC${RESET}"
        ;;
    2)
        RPC_URL="https://reth-ethereum.ithaca.xyz/rpc"
        CHUNK_SIZE="100"
        echo -e "${GREEN}Selected: Ithaca RPC${RESET}"
        ;;
    3)
        echo
        read -p "Enter your RPC URL: " RPC_URL

        # Basic URL validation
        if [[ ! $RPC_URL =~ ^https?:// ]]; then
            echo -e "${RED}Invalid URL format. Must start with http:// or https://${RESET}"
            exit 1
        fi

        echo -e "${YELLOW}Enter chunk size (0-25000, default: 10000):${RESET}"
        echo -e "${YELLOW}Note: Can be modified later in the frontend dashboard${RESET}"
        read -p "Chunk size: " CUSTOM_CHUNK

        # Validate chunk size
        if [[ -z "$CUSTOM_CHUNK" ]]; then
            CHUNK_SIZE="10000"
        elif [[ ! "$CUSTOM_CHUNK" =~ ^[0-9]+$ ]] || [ "$CUSTOM_CHUNK" -lt 0 ] || [ "$CUSTOM_CHUNK" -gt 25000 ]; then
            echo -e "${RED}Invalid chunk size. Must be a number between 0 and 25000${RESET}"
            exit 1
        else
            CHUNK_SIZE="$CUSTOM_CHUNK"
        fi

        echo -e "${GREEN}Selected: Custom RPC${RESET}"
        echo -e "${GREEN}URL: $RPC_URL${RESET}"
        echo -e "${GREEN}Chunk size: $CHUNK_SIZE${RESET}"
        ;;
    *)
        echo -e "${RED}Invalid choice. Exiting.${RESET}"
        exit 1
        ;;
esac

echo
echo -e "${BOLD}Configuring frontend environment...${RESET}"

# Copy .env.example to .env and remove comment lines
grep -v '^//' "$FRONT_DIR/.env.example" > "$FRONT_DIR/.env"

# Update chunk size in .env
sed -i '' "s/NEXT_PUBLIC_TRACE_CHUNK_SIZE='[^']*'/NEXT_PUBLIC_TRACE_CHUNK_SIZE='$CHUNK_SIZE'/" "$FRONT_DIR/.env"

echo -e "${GREEN}✓ Created $FRONT_DIR/.env with chunk size: $CHUNK_SIZE${RESET}"

echo
echo -e "${BOLD}${GREEN}Environment configured successfully!${RESET}"

# Export RPC_URLS for server
export RPC_URLS="$RPC_URL"

echo -e "${GREEN}✓ Using RPC: $RPC_URL${RESET}"
echo -e "${GREEN}✓ RPC_URLS exported for server${RESET}"
echo

echo -e "${BOLD}Next steps:${RESET}"
echo
echo -e "${YELLOW}1.${RESET} ${BOLD}In this terminal${RESET}, start the server:"
echo -e "   ${PURPLE}RPC_URLS=\"$RPC_URL\" cargo run --release --package indexer-server${RESET}"
echo
echo -e "${YELLOW}2.${RESET} ${BOLD}Open a new terminal${RESET} and navigate to the frontend:"
echo -e "   ${PURPLE}cd $FRONT_DIR${RESET}"
echo
echo -e "${YELLOW}3.${RESET} ${BOLD}In the new terminal${RESET}, start the frontend:"
echo -e "   ${PURPLE}npm run start:all${RESET}"
echo
echo -e "${YELLOW}4.${RESET} Open your browser and visit:"
echo -e "   ${CYAN}http://localhost:3000${RESET}"
echo
echo -e "${BOLD}Note:${RESET} Use ${PURPLE}Ctrl+C${RESET} to stop any running process"
