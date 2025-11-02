
<p align="center">
  <img alt="Ethereum Indexer" src="./docs/ethereum_indexer.png" width="700">
</p>

# Ethereum Indexer

A high-performance Ethereum blockchain indexer that crawls transaction data for **specific wallet addresses** starting from a **user-defined block**.

---

## 🚀 Quick Start

### Prerequisites

- **Rust** (stable) — [rustup.rs](https://rustup.rs/)
- **Node.js** (>= v18) — [nodejs.org](https://nodejs.org/)
- **npm** (included with Node.js)

### One-Click Setup

Run the guided setup script for automatic configuration:

```bash
./scripts/setup.sh
```

This script will:

- Validate all required tools
- Prompt you to select an RPC provider (**DRPC**, **Ithaca**, or **custom**)
- Optimize frontend chunk sizes based on your provider
- Guide you through launching the full application

---

> [!IMPORTANT]
> Your RPC provider **must support** the `trace_filter` method for transaction tracing to function.

### Performance Tips

| Issue | Recommendation |
|------|----------------|
| Timeouts on large ranges | Reduce **chunk size** in the frontend dashboard |
| Slow indexing | Use a **fast `trace_filter`-enabled RPC** (e.g., `eth.drpc.org`) |
| Rate limiting | Avoid free-tier public endpoints for heavy use |

See `/scripts` for advanced examples and tuning utilities.

---

## 📂 Project Structure

| Component | Description |
|---------|-------------|
| `crates/indexer` | Core blockchain crawling engine |
| `crates/indexer-cli` | CLI tool for direct indexer interaction |
| `crates/indexer-server` | REST API server exposing indexer features |
| `front/` | Web dashboard for visualized transaction data |

---

## 📚 Documentation

All in-depth guides are located in [`/docs`](./docs/):

- [**`ARCHITECTURE.md`**](./docs/ARCHITECTURE.md) — In-depth design of the indexer core
- [**`CLI_GUIDE.md`**](./docs/CLI_GUIDE.md) — Full CLI usage reference
- [**`SERVER_API.md`**](./docs/SERVER_API.md) — Complete REST API endpoint documentation

---

## ⚡ Performance

Powered by the efficient `trace_filter` RPC method, the indexer processes **large block ranges in parallel**.

### Best Practices

- Use a **single high-quality RPC** (round-robin pooling favors consistency)
- Recommended: `eth.drpc.org` or paid Ithaca nodes
- Avoid mixing slow/free endpoints with fast ones

---

## ▶️ Running the Application

### 1. Start the Backend Server

```bash
RPC_URLS="https://your-fast-rpc-provider.com/token" \
PARALLEL_PER_RPC=5 \
cargo run --release --package indexer-server
```

### 2. Launch the Frontend

```bash
cd front
npm run start:all
```

The dashboard will be available at `http://localhost:3000`.

---

*Fast. Reliable. Developer-friendly.*

