// Ethereum Indexer API Client
// Provides TypeScript interfaces and client for blockchain data queries

// Base types
export type Address = string
export type Hash = string
export type BlockNumber = number
export type Wei = string
export type Ether = string
export type Timestamp = number
export type DateString = string
export type HexString = string

// Query parameter interfaces
export interface TraceFilterQuery {
  startblock?: BlockNumber
  endblock?: BlockNumber
}

export interface BlockByNumberQuery {
  from?: BlockNumber
  to?: BlockNumber
  full?: boolean
}

export interface BalanceQuery {
  block_range_lo?: BlockNumber
  block_range_hi?: BlockNumber
  on_miss?: "strict" | "clamp" | "auto_widen"
}

export interface GetLogsQuery {
  from: BlockNumber
  to: BlockNumber
  addresses?: Address[]
  topics?: HexString[]
  chunk_size?: number
}

export interface Erc20WalletQuery {
  from: BlockNumber
  to: BlockNumber
  tokens?: Address[]
  chunk_size?: number
}

export interface Erc20TokenQuery {
  from: BlockNumber
  to: BlockNumber
  chunk_size?: number
}

// Response type interfaces
export interface TraceResult {
  // Updated flat shape (preferred)
  action?: any
  result?: any
  error?: string
  blockHash?: Hash
  blockNumber?: BlockNumber
  transactionHash?: Hash
  transactionPosition?: number
  subtraces?: number
  traceAddress?: number[]
  type?: string

  // Legacy nested shape (kept optional for compatibility)
  trace?: {
    trace_address: number[]
    subtraces: number
    action?: any
    result?: any
    error?: string
  }
  transaction_hash?: Hash
  transaction_position?: number
  block_hash?: Hash
  block_number?: BlockNumber
}

export interface BlockHeader {
  number: BlockNumber
  hash: Hash
  parent_hash: Hash
  timestamp: Timestamp
  gas_limit: string
  gas_used: string
  miner: Address
  difficulty: string
  total_difficulty?: string
  extra_data: HexString
  size?: number
}

export interface Transaction {
  hash: Hash
  nonce: string
  from: Address
  to?: Address
  value: Wei
  gas: string
  gas_price?: string
  max_fee_per_gas?: string
  max_priority_fee_per_gas?: string
  input: HexString
  transaction_type?: number
}

export interface TransactionReceipt {
  blockHash: Hash;
  blockNumber: BlockNumber;
  contractAddress: Address;
  cumulativeGasUsed: string;
  effectiveGasPrice: string;
  gasUsed: string;
  logs: Log[];
  logsBloom: HexString;
  status: string;
  to: Address;
  transactionHash: Hash;
  transactionIndex: string;
  type: string;
}

export interface Block {
  header: BlockHeader
  transactions: Transaction[]
  uncles: Hash[]
  withdrawals?: any[]
}

export interface TransactionResponse {
  hash: Hash
  nonce: string
  blockHash?: Hash
  blockNumber?: BlockNumber
  transactionIndex?: number
  from: Address
  to?: Address
  value: Wei
  gas: string
  gasPrice?: string
  maxFeePerGas?: string
  maxPriorityFeePerGas?: string
  input: HexString
  transactionType?: number
  chainId?: number
  v: string
  r: string
  s: string
}

export interface BalanceResponse {
  token_address?: Address
  owner_address?: Address
  address?: Address  // Keep for backwards compatibility
  date: DateString
  timestamp: Timestamp
  block_number?: BlockNumber
  block_timestamp?: Timestamp
  balance: Wei  // This is the raw balance in smallest units
  balance_wei?: Wei  // Keep for backwards compatibility
  balance_eth?: Ether  // Keep for backwards compatibility
}

export interface Log {
  address: Address
  topics: HexString[]
  data: HexString
  transaction_hash?: Hash
  block_number?: BlockNumber
  block_hash?: Hash
  log_index?: number
  transaction_index?: number
  removed?: boolean
}

export interface Erc20Transfer {
  type: "Transfer"
  from: Address
  to: Address
  value: Wei
  token: Address
  transaction_hash?: Hash
  block_number?: BlockNumber
  log_index?: number
  lane?: "FROM" | "TO"
}

export interface LogsMetadata {
  from_block: BlockNumber
  to_block: BlockNumber
  total_logs: number
  chunk_size: number
  transfer_type?: "wallet" | "token"
}

export interface LogsResponse {
  logs: Log[]
  metadata: LogsMetadata
}

export interface Erc20WalletTransfersResponse {
  logs: Erc20Transfer[]
  metadata: LogsMetadata
}

export interface Erc20TokenTransfersResponse {
  logs: Erc20Transfer[]
  metadata: LogsMetadata
}

// API Error class
export class ApiError extends Error {
  constructor(public details: { status: number; message?: string }) {
    super(details.message || `API Error: ${details.status}`)
    this.name = "ApiError"
  }
}

// Main API Client
export class EthereumIndexerClient {
  constructor(private baseUrl = "http://localhost:3000") {}

  // Trace Filter
  async getTraceFilter(address?: Address, params?: TraceFilterQuery): Promise<TraceResult[]> {
    const url = address ? `/api/trace/filter/${address}` : "/api/trace/filter"
    return this.get(url, params)
  }

  // Block Queries
  async getBlockByNumber(number: string | BlockNumber, params?: BlockByNumberQuery): Promise<Block | Block[]> {
    return this.get(`/api/eth/getBlockByNumber/${number}`, params)
  }

  // Transaction Queries
  async getTransactionByHash(hash: Hash): Promise<TransactionResponse> {
    return this.get(`/api/eth/getTransactionByHash/${hash}`)
  }

  async getTransactionReceipt(hash: Hash): Promise<TransactionReceipt> {
    return this.get(`/api/eth/getTransactionReceipt/${hash}`)
  }

  // Balance Queries
  async getBalance(address: Address, date: DateString, params?: BalanceQuery): Promise<BalanceResponse> {
    return this.get(`/api/eth/getBalance/${address}/${date}`, params)
  }

  // Log Queries
  async getLogs(params: GetLogsQuery): Promise<LogsResponse> {
    return this.get("/api/eth/getLogs", params)
  }

  async getErc20WalletTransfers(address: Address, params: Erc20WalletQuery): Promise<Erc20WalletTransfersResponse> {
    return this.get(`/api/eth/getLogs/erc20/wallet/${address}`, params)
  }

  async getErc20TokenTransfers(address: Address, params: Erc20TokenQuery): Promise<Erc20TokenTransfersResponse> {
    return this.get(`/api/eth/getLogs/erc20/token/${address}`, params)
  }

  // HTTP Helper
  private async get<T>(endpoint: string, params?: Record<string, any>): Promise<T> {
    const url = new URL(endpoint, this.baseUrl)

    if (params) {
      const toCamel = (key: string) => key.replace(/[\-_.\s]+(.)?/g, (_, c) => (c ? c.toUpperCase() : ""))

      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) {
          const normalizedKey = toCamel(key)
          if (Array.isArray(value)) {
            // Use bracket notation for arrays to ensure proper deserialization
            value.forEach((v) => url.searchParams.append(`${normalizedKey}[]`, v.toString()))
          } else {
            url.searchParams.append(normalizedKey, value.toString())
          }
        }
      })
    }

    const response = await fetch(url.toString())

    // Always check response status first
    if (!response.ok) {
      let errorMessage = response.statusText

      // Try to get error details from response body
      try {
        const errorText = await response.text()
        if (errorText) {
          errorMessage = `${response.statusText}: ${errorText.slice(0, 200)}${errorText.length > 200 ? '...' : ''}`
        }
      } catch {
        // Ignore errors reading response body
      }

      throw new ApiError({
        status: response.status,
        message: errorMessage,
      })
    }

    // Parse JSON with proper error handling
    try {
      return await response.json()
    } catch (parseError) {
      // Get response text for better error context
      const responseText = await response.text().catch(() => 'Unable to read response')

      throw new ApiError({
        status: 422, // Unprocessable Entity
        message: `Invalid JSON response from server. Response: ${responseText.slice(0, 300)}${responseText.length > 300 ? '...' : ''}`,
      })
    }
  }
}

// Simple address validation - just check basic format and length
export function isValidAddress(address: string): address is Address {
  if (!address || typeof address !== 'string') return false

  // Just check it starts with 0x and has reasonable length
  return address.startsWith('0x') && address.length >= 42 && address.length <= 50
}

// Pass raw address string - no transformation
export function normalizeAddress(address: string): string {
  return address
}

export function isValidHash(hash: string): hash is Hash {
  return /^0x[a-fA-F0-9]{64}$/.test(hash)
}

export function isValidDate(date: string): date is DateString {
  return /^\d{4}-\d{2}-\d{2}$/.test(date) && !isNaN(Date.parse(date))
}

export function isValidBlockNumber(block: number): block is BlockNumber {
  return Number.isInteger(block) && block >= 0
}

// Utility functions
export function truncateHash(hash: string, length = 4): string {
  if (hash.length <= length + 2) return hash
  return `${hash.slice(0, 8)}...${hash.slice(-6)}`
  //return `${hash.slice(0, length + 2)}...`
}

export function formatWei(wei: string): string {
  try {
    const value = BigInt(wei)
    const eth = Number(value) / 1e18
    return formatEth(eth)
  } catch {
    return "0"
  }
}

export function formatEth(eth: number | string): string {
  try {
    const value = typeof eth === "string" ? parseFloat(eth) : eth

    // Smart rounding: more decimals for smaller amounts
    if (value === 0) return "0"
    if (value >= 1000) return value.toFixed(2)
    if (value >= 1) return value.toFixed(4)
    if (value >= 0.001) return value.toFixed(6)
    return value.toFixed(8)
  } catch {
    return "0"
  }
}

export function formatTimestamp(timestamp: number): string {
  return new Date(timestamp * 1000).toLocaleString()
}

// Hex helpers
export function hexToBigInt(hex: string): bigint {
  if (typeof hex !== "string") throw new Error("hexToBigInt expects a string")
  const clean = hex.startsWith("0x") ? hex.slice(2) : hex
  if (clean.length === 0) return BigInt(0)
  return BigInt("0x" + clean)
}

export function hexToDecimalString(hex: string): string {
  try {
    return hexToBigInt(hex).toString(10)
  } catch {
    return hex
  }
}

export function formatHexWei(hex: string): string {
  try {
    const wei = hexToBigInt(hex).toString(10)
    return formatWei(wei)
  } catch {
    return "0"
  }
}

export function formatHexGwei(hex: string, fractionDigits = 2): string {
  try {
    const gwei = Number(hexToBigInt(hex)) / 1e9
    return gwei.toFixed(fractionDigits)
  } catch {
    return "0"
  }
}

export function hexToValueBlock(hex: string | any): string {
  const cleanHex = hex.startsWith('0x') ? hex.slice(2) : hex;
  const value = Number(BigInt(`0x${cleanHex || '0'}`));
  return value.toLocaleString('en-US');
}

// Converts a hex string to different value types (number, BigInt, or decimal string)
export function hexToValue(hex: string | any, type: 'number' | 'bigint' | 'string' = 'number'): number | bigint | string {
  if (typeof hex !== 'string') {
    throw new Error('hexToValue expects a string input');
  }

  // Clean hex: remove '0x' prefix if present
  const cleanHex = hex.startsWith('0x') ? hex.slice(2) : hex;

  // Handle empty or invalid hex
  if (cleanHex.length === 0) {
    return type === 'number' ? 0 : type === 'bigint' ? BigInt(0) : '0';
  }

  // Validate hex string (only 0-9, a-f, A-F)
  if (!/^[0-9a-fA-F]+$/.test(cleanHex)) {
    throw new Error(`Invalid hex string: ${hex}`);
  }

  try {
    const bigIntValue = BigInt('0x' + cleanHex);

    switch (type) {
      case 'number':
        // Check if within JavaScript's safe integer range
        const num = Number(bigIntValue);
        if (num > Number.MAX_SAFE_INTEGER || num < Number.MIN_SAFE_INTEGER) {
          throw new Error(`Hex value ${hex} exceeds safe integer range for number conversion`);
        }
        return num;
      case 'bigint':
        return bigIntValue;
      case 'string':
        return bigIntValue.toString(10);
      default:
        throw new Error(`Invalid type: ${type}. Use 'number', 'bigint', or 'string'`);
    }
  } catch (error: any) {
    throw new Error(`Failed to convert hex ${hex}: ${error.message}`);
  }
}
