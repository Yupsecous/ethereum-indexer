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
        PARALLEL_PER_RPC="5"
        MAX_TRACE_RESULTS="5000"
        echo -e "${GREEN}Selected: DRPC (optimized for high-speed)${RESET}"
        ;;
    2)
        RPC_URL="https://reth-ethereum.ithaca.xyz/rpc"
        CHUNK_SIZE="100"
        PARALLEL_PER_RPC="8"
        MAX_TRACE_RESULTS="10000"
        echo -e "${GREEN}Selected: Ithaca RPC (balanced settings)${RESET}"
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

        echo -e "${YELLOW}Enter parallel requests per RPC (1-20, default: 8):${RESET}"
        read -p "Parallel per RPC: " CUSTOM_PARALLEL

        # Validate parallel per RPC
        if [[ -z "$CUSTOM_PARALLEL" ]]; then
            PARALLEL_PER_RPC="8"
        elif [[ ! "$CUSTOM_PARALLEL" =~ ^[0-9]+$ ]] || [ "$CUSTOM_PARALLEL" -lt 1 ] || [ "$CUSTOM_PARALLEL" -gt 20 ]; then
            echo -e "${RED}Invalid parallel value. Must be a number between 1 and 20${RESET}"
            exit 1
        else
            PARALLEL_PER_RPC="$CUSTOM_PARALLEL"
        fi

        echo -e "${YELLOW}Enter max trace results (1000-50000, default: 10000):${RESET}"
        read -p "Max trace results: " CUSTOM_MAX_RESULTS

        # Validate max results
        if [[ -z "$CUSTOM_MAX_RESULTS" ]]; then
            MAX_TRACE_RESULTS="10000"
        elif [[ ! "$CUSTOM_MAX_RESULTS" =~ ^[0-9]+$ ]] || [ "$CUSTOM_MAX_RESULTS" -lt 1000 ] || [ "$CUSTOM_MAX_RESULTS" -gt 50000 ]; then
            echo -e "${RED}Invalid max results. Must be a number between 1000 and 50000${RESET}"
            exit 1
        else
            MAX_TRACE_RESULTS="$CUSTOM_MAX_RESULTS"
        fi

        echo -e "${GREEN}Selected: Custom RPC${RESET}"
        echo -e "${GREEN}URL: $RPC_URL${RESET}"
        echo -e "${GREEN}Chunk size: $CHUNK_SIZE${RESET}"
        echo -e "${GREEN}Parallel per RPC: $PARALLEL_PER_RPC${RESET}"
        echo -e "${GREEN}Max trace results: $MAX_TRACE_RESULTS${RESET}"
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

# Export environment variables for server
export RPC_URLS="$RPC_URL"
export PARALLEL_PER_RPC="$PARALLEL_PER_RPC"
export MAX_TRACE_RESULTS="$MAX_TRACE_RESULTS"

echo -e "${GREEN}✓ Using RPC: $RPC_URL${RESET}"
echo -e "${GREEN}✓ Parallel per RPC: $PARALLEL_PER_RPC${RESET}"
echo -e "${GREEN}✓ Max trace results: $MAX_TRACE_RESULTS${RESET}"
echo -e "${GREEN}✓ Environment variables exported for server${RESET}"
echo

echo -e "${BOLD}${GREEN}Setup complete!${RESET}"
echo
echo -e "${BOLD}In this terminal, we will start the server.${RESET}"
echo

# Server startup prompt
read -p "Would you like to start the server now? (y/N): " start_server

case $(echo "$start_server" | tr '[:upper:]' '[:lower:]') in
    y|yes)
        echo
        echo -e "${BOLD}Starting server...${RESET}"
        echo -e "${GREEN}Server will run with: RPC_URLS=\"$RPC_URL\"${RESET}"
        echo -e "${YELLOW}Use ${PURPLE}Ctrl+C${RESET}${YELLOW} to stop the server${RESET}"
        echo
        echo -e "${BOLD}Next steps after server starts:${RESET}"
        echo -e "${YELLOW}1.${RESET} Open a new terminal and navigate to: ${PURPLE}cd $FRONT_DIR${RESET}"
        echo -e "${YELLOW}2.${RESET} Start the frontend: ${PURPLE}npm run start:all${RESET}"
        echo -e "${YELLOW}3.${RESET} Visit: ${CYAN}http://localhost:3000${RESET}"
        echo
        echo -e "${BOLD}${BLUE}================================${RESET}"
        echo -e "${BOLD}${BLUE}  Starting Ethereum Indexer     ${RESET}"
        echo -e "${BOLD}${BLUE}================================${RESET}"
        echo

        # Execute server with all environment variables
        RPC_URLS="$RPC_URL" PARALLEL_PER_RPC="$PARALLEL_PER_RPC" MAX_TRACE_RESULTS="$MAX_TRACE_RESULTS" cargo run --release --package indexer-server
        ;;
    *)
        echo
        echo -e "${BOLD}Manual startup instructions:${RESET}"
        echo
        echo -e "${YELLOW}1.${RESET} ${BOLD}In this terminal${RESET}, start the server:"
        echo -e "   ${PURPLE}RPC_URLS=\"$RPC_URL\" PARALLEL_PER_RPC=\"$PARALLEL_PER_RPC\" MAX_TRACE_RESULTS=\"$MAX_TRACE_RESULTS\" cargo run --release --package indexer-server${RESET}"
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
        ;;
esac
