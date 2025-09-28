// Centralized UI/API configuration
// Override via environment variables when deploying.

export const API_BASE_URL: string =
  process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8080'

export const ETH_RPC_URL: string =
  process.env.NEXT_PUBLIC_ETH_RPC_URL || 'https://ethereum-rpc.publicnode.com'

// Trace pagination chunk (number of blocks per page)
export const TRACE_CHUNK_SIZE: number = Number(
  process.env.NEXT_PUBLIC_TRACE_CHUNK_SIZE || '50000'
)

// Dashboard refresh interval (ms) for latest block + ping
export const DASHBOARD_REFRESH_MS: number = Number(
  process.env.NEXT_PUBLIC_DASHBOARD_REFRESH_MS || '10000'
)

// Health check path for the API base
export const PING_ROUTE: string = process.env.NEXT_PUBLIC_PING_ROUTE || '/ping'

