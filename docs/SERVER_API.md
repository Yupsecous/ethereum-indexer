# Ethereum Indexer Server API

This document outlines the available API endpoints for the `indexer-server`. All endpoints are accessible via `GET` requests.

---

## General

### Health Check

-   **Endpoint**: `/ping`
-   **Description**: A simple health check endpoint to verify if the server is running.
-   **Returns**: `{"message": "pong!"}`
-   **Example**:
    ```bash
    curl http://localhost:8080/ping
    ```

### RPC Info

-   **Endpoint**: `/api/rpc-info`
-   **Description**: Returns the configuration of the RPC providers being used by the server's indexing engine.
-   **Example**:
    ```bash
    curl http://localhost:8080/api/rpc-info
    ```

---

## Trace API

### Trace Filter

-   **Endpoint**: `/api/trace/filter/{address}` (address is optional)
-   **Description**: Fetches transaction traces within a block range. If an `address` is provided, it returns traces where the address is either the sender (`from`) or receiver (`to`).
-   **Path Parameters**:
    -   `address` (optional): The Ethereum address to filter by.
-   **Query Parameters**:
    -   `startblock` (optional `u64`): The starting block number.
    -   `endblock` (optional `u64`): The ending block number.
-   **Examples**:
    ```bash
    # Traces for a specific address
    curl "http://localhost:8080/api/trace/filter/0xaa7a9ca87d3694b5755f213b5d04094b8d0f0a6f?startblock=18000000&endblock=18000100"

    # All traces in range (no address filter)
    curl "http://localhost:8080/api/trace/filter?startblock=18000000&endblock=18000100"
    ```

---

## Standard Ethereum API (`eth`)

### Get Block By Number

-   **Endpoint**: `/api/eth/getBlockByNumber/{number}`
-   **Description**: Retrieves a block by its number or a standard tag (e.g., `latest`). Can also fetch a range of blocks.
-   **Path Parameters**:
    -   `number`: Block number (decimal or hex `0x...`) or a tag (`latest`, `safe`, `finalized`, `earliest`, `pending`).
-   **Query Parameters**:
    -   `from` / `to` (optional `u64`): If both are provided, fetches all blocks in this inclusive range. The `{number}` path parameter is ignored.
    -   `full` (optional `bool`, default `true`): If `true`, returns full transaction objects; if `false`, returns only transaction hashes.
-   **Examples**:
    ```bash
    # Get the latest block
    curl http://localhost:8080/api/eth/getBlockByNumber/latest

    # Get a range of blocks
    curl "http://localhost:8080/api/eth/getBlockByNumber/range?from=18000000&to=18000005"
    ```

### Get Transaction By Hash

-   **Endpoint**: `/api/eth/getTransactionByHash/{hash}`
-   **Description**: Retrieves a single transaction by its hash.
-   **Path Parameters**:
    -   `hash`: The 32-byte transaction hash.
-   **Example**:
    ```bash
    curl http://localhost:8080/api/eth/getTransactionByHash/0x2c4b...cb9a
    ```

### Get Transaction Receipt

-   **Endpoint**: `/api/eth/getTransactionReceipt/{hash}`
-   **Description**: Retrieves the receipt of a transaction by its hash.
-   **Path Parameters**:
    -   `hash`: The 32-byte transaction hash.
-   **Example**:
    ```bash
    curl http://localhost:8080/api/eth/getTransactionReceipt/0x2c4b...cb9a
    ```

### Get ETH Balance by Date

-   **Endpoint**: `/api/eth/getBalance/{address}/{date}`
-   **Description**: Gets the ETH balance of an address at `00:00:00 UTC` on the specified date.
-   **Path Parameters**:
    -   `address`: The Ethereum address to query.
    -   `date`: The target date in `YYYY-MM-DD` format.
-   **Query Parameters**:
    -   `block_range_lo` / `block_range_hi` (optional `u64`): The block range to search for the target timestamp.
    -   `on_miss` (optional `string`): Policy for when the date is outside the search range. One of `strict`, `clamp`, `auto_widen` (default).
-   **Example**:
    ```bash
    curl http://localhost:8080/api/eth/getBalance/0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045/2024-01-01
    ```

### Get ERC-20 Balance by Date

-   **Endpoint**: `/api/eth/getErc20Balance/{token_address}/{owner_address}/{date}`
-   **Description**: Gets the ERC-20 token balance of an address at `00:00:00 UTC` on the specified date.
-   **Path Parameters**:
    -   `token_address`: The ERC-20 contract address.
    -   `owner_address`: The address to check the balance of.
    -   `date`: The target date in `YYYY-MM-DD` format.
-   **Query Parameters**: Same as `getBalance`.
-   **Example**:
    ```bash
    curl http://localhost:8080/api/eth/getErc20Balance/0x6B175474E89094C44Da98b954EedeAC495271d0F/0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045/2024-01-01
    ```

### Get Logs (General)

-   **Endpoint**: `/api/eth/getLogs`
-   **Description**: A general-purpose log query.
-   **Query Parameters**:
    -   `from` / `to` (required `u64`): The block range to query.
    -   `addresses` (optional `string[]`): A list of contract addresses to filter by.
    -   `topics` (optional `string[]`): A list of topics to filter by.
    -   `chunk_size` (optional `u64`): The internal block range size for each parallel request.
-   **Example**:
    ```bash
    curl "http://localhost:8080/api/eth/getLogs?from=18000000&to=18000100&addresses=0x6B175474E89094C44Da98b954EedeAC495271d0F"
    ```

### Get Logs (ERC-20 Wallet Transfers)

-   **Endpoint**: `/api/eth/getLogs/erc20/wallet/{address}`
-   **Description**: Retrieves all ERC-20 `Transfer` events where the specified `{address}` is either the sender or the receiver.
-   **Path Parameters**:
    -   `address`: The wallet address to track.
-   **Query Parameters**:
    -   `from` / `to` (required `u64`): The block range to query.
    -   `tokens` (optional `string[]`): A list of specific ERC-20 token contracts to include. If omitted, all tokens are tracked.
-   **Example**:
    ```bash
    curl "http://localhost:8080/api/eth/getLogs/erc20/wallet/0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045?from=18000000&to=18000100"
    ```

### Get Logs (ERC-20 Token Transfers)

-   **Endpoint**: `/api/eth/getLogs/erc20/token/{address}`
-   **Description**: Retrieves all `Transfer` events for a specific ERC-20 token contract.
-   **Path Parameters**:
    -   `address`: The ERC-20 token contract address.
-   **Query Parameters**:
    -   `from` / `to` (required `u64`): The block range to query.
-   **Example**:
    ```bash
    curl "http://localhost:8080/api/eth/getLogs/erc20/token/0x6B175474E89094C44Da98b954EedeAC495271d0F?from=18000000&to=18000100"
    ```
