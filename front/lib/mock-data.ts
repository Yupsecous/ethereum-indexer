import type {
  Block,
  TransactionResponse,
  TransactionReceipt,
  BalanceResponse,
  LogsResponse,
  Erc20WalletTransfersResponse,
  Erc20TokenTransfersResponse,
  TraceResult,
} from "./ethereum-client"

// Mock Block Data
export const mockSingleBlock: Block = {
  header: {
    number: 18500000,
    hash: "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
    parent_hash: "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890",
    timestamp: 1698768000,
    gas_limit: "30000000",
    gas_used: "15234567",
    miner: "0x1234567890123456789012345678901234567890",
    difficulty: "0",
    total_difficulty: "58750003716598352816469",
    extra_data: "0x",
    size: 85432,
  },
  transactions: [
    {
      hash: "0xabc123def456789abc123def456789abc123def456789abc123def456789abc123",
      nonce: "42",
      from: "0x742d35Cc6634C0532925a3b8D4C9db4C4C4C4C4C",
      to: "0xA0b86a33E6842c4C4C4C4C4C4C4C4C4C4C4C4C4C",
      value: "1000000000000000000",
      gas: "21000",
      gas_price: "20000000000",
      input: "0x",
      transaction_type: 0,
    },
    {
      hash: "0xdef456789abc123def456789abc123def456789abc123def456789abc123def456",
      nonce: "15",
      from: "0x8ba1f109551bD432803012645Hac136c22C4C4C4",
      to: "0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984",
      value: "500000000000000000",
      gas: "65000",
      gas_price: "25000000000",
      input:
        "0xa9059cbb000000000000000000000000742d35cc6634c0532925a3b8d4c9db4c4c4c4c4c0000000000000000000000000000000000000000000000000de0b6b3a7640000",
      transaction_type: 2,
    },
  ],
  uncles: [],
  withdrawals: [],
}

export const mockBlockRange: Block[] = [
  mockSingleBlock,
  {
    ...mockSingleBlock,
    header: {
      ...mockSingleBlock.header,
      number: 18500001,
      hash: "0x2345678901bcdef12345678901bcdef12345678901bcdef12345678901bcdef1",
      parent_hash: mockSingleBlock.header.hash,
      timestamp: 1698768012,
      gas_used: "12876543",
    },
    transactions: [
      {
        hash: "0xbcd234ef567890bcd234ef567890bcd234ef567890bcd234ef567890bcd234ef",
        nonce: "7",
        from: "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC",
        to: "0x90F79bf6EB2c4f870365E785982E1f101E93b906",
        value: "2500000000000000000",
        gas: "21000",
        gas_price: "22000000000",
        input: "0x",
        transaction_type: 0,
      },
    ],
  },
]

// Mock Transaction Data
export const mockTransaction: TransactionResponse = {
  hash: "0xabc123def456789abc123def456789abc123def456789abc123def456789abc123",
  nonce: "42",
  block_hash: "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
  block_number: 18500000,
  transaction_index: 0,
  from: "0x742d35Cc6634C0532925a3b8D4C9db4C4C4C4C4C",
  to: "0xA0b86a33E6842c4C4C4C4C4C4C4C4C4C4C4C4C4C",
  value: "1000000000000000000",
  gas: "21000",
  gas_price: "20000000000",
  input: "0x",
  transaction_type: 0,
  chain_id: 1,
  v: "0x25",
  r: "0x1b5e176d927f8e9ab405058b2d2457392da3e20f328b16ddabcebc33eaac5fea",
  s: "0x4ba69724e8f69de52f0125ad8b3c5c2cef33019bac3249e2c0a2192766d1721c",
}

export const mockTransactionReceipt: TransactionReceipt = {
  transaction_hash: "0xabc123def456789abc123def456789abc123def456789abc123def456789abc123",
  transaction_index: 0,
  block_hash: "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
  block_number: 18500000,
  cumulative_gas_used: "21000",
  gas_used: "21000",
  logs: [
    {
      address: "0xA0b86a33E6842c4C4C4C4C4C4C4C4C4C4C4C4C4C",
      topics: [
        "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef",
        "0x000000000000000000000000742d35cc6634c0532925a3b8d4c9db4c4c4c4c4c",
        "0x000000000000000000000000a0b86a33e6842c4c4c4c4c4c4c4c4c4c4c4c4c4c",
      ],
      data: "0x0000000000000000000000000000000000000000000000000de0b6b3a7640000",
      transaction_hash: "0xabc123def456789abc123def456789abc123def456789abc123def456789abc123",
      block_number: 18500000,
      block_hash: "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
      log_index: 0,
      transaction_index: 0,
      removed: false,
    },
  ],
  logs_bloom:
    "0x00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000",
  status: 1,
  effective_gas_price: "20000000000",
  transaction_type: 0,
}

// Mock Balance Data
export const mockBalance: BalanceResponse = {
  address: "0x742d35Cc6634C0532925a3b8D4C9db4C4C4C4C4C",
  date: "2023-11-01",
  timestamp: 1698768000,
  block_number: 18500000,
  block_timestamp: 1698768000,
  balance_wei: "5000000000000000000",
  balance_eth: "5.000000",
}

// Mock Logs Data
export const mockLogs: LogsResponse = {
  logs: [
    {
      address: "0xA0b86a33E6842c4C4C4C4C4C4C4C4C4C4C4C4C4C",
      topics: [
        "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef",
        "0x000000000000000000000000742d35cc6634c0532925a3b8d4c9db4c4c4c4c4c",
        "0x000000000000000000000000a0b86a33e6842c4c4c4c4c4c4c4c4c4c4c4c4c4c",
      ],
      data: "0x0000000000000000000000000000000000000000000000000de0b6b3a7640000",
      transaction_hash: "0xabc123def456789abc123def456789abc123def456789abc123def456789abc123",
      block_number: 18500000,
      block_hash: "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
      log_index: 0,
      transaction_index: 0,
      removed: false,
    },
    {
      address: "0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984",
      topics: [
        "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef",
        "0x0000000000000000000000008ba1f109551bd432803012645hac136c22c4c4c4",
        "0x000000000000000000000000742d35cc6634c0532925a3b8d4c9db4c4c4c4c4c",
      ],
      data: "0x0000000000000000000000000000000000000000000000001bc16d674ec80000",
      transaction_hash: "0xdef456789abc123def456789abc123def456789abc123def456789abc123def456",
      block_number: 18500000,
      block_hash: "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
      log_index: 1,
      transaction_index: 1,
      removed: false,
    },
  ],
  metadata: {
    from_block: 18500000,
    to_block: 18500010,
    total_logs: 2,
    chunk_size: 1000,
  },
}

// Mock ERC-20 Transfer Data
export const mockErc20WalletTransfers: Erc20WalletTransfersResponse = {
  logs: [
    {
      type: "Transfer",
      from: "0x742d35Cc6634C0532925a3b8D4C9db4C4C4C4C4C",
      to: "0xA0b86a33E6842c4C4C4C4C4C4C4C4C4C4C4C4C4C",
      value: "1000000000000000000",
      token: "0xA0b86a33E6842c4C4C4C4C4C4C4C4C4C4C4C4C4C",
      transaction_hash: "0xabc123def456789abc123def456789abc123def456789abc123def456789abc123",
      block_number: 18500000,
      log_index: 0,
      lane: "FROM",
    },
    {
      type: "Transfer",
      from: "0x8ba1f109551bD432803012645Hac136c22C4C4C4",
      to: "0x742d35Cc6634C0532925a3b8D4C9db4C4C4C4C4C",
      value: "2000000000000000000",
      token: "0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984",
      transaction_hash: "0xdef456789abc123def456789abc123def456789abc123def456789abc123def456",
      block_number: 18500001,
      log_index: 0,
      lane: "TO",
    },
  ],
  metadata: {
    from_block: 18500000,
    to_block: 18500010,
    total_logs: 2,
    chunk_size: 1000,
    transfer_type: "wallet",
  },
}

export const mockErc20TokenTransfers: Erc20TokenTransfersResponse = {
  logs: [
    {
      type: "Transfer",
      from: "0x742d35Cc6634C0532925a3b8D4C9db4C4C4C4C4C",
      to: "0xA0b86a33E6842c4C4C4C4C4C4C4C4C4C4C4C4C4C",
      value: "1000000000000000000",
      token: "0xA0b86a33E6842c4C4C4C4C4C4C4C4C4C4C4C4C4C",
      transaction_hash: "0xabc123def456789abc123def456789abc123def456789abc123def456789abc123",
      block_number: 18500000,
      log_index: 0,
    },
    {
      type: "Transfer",
      from: "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC",
      to: "0x90F79bf6EB2c4f870365E785982E1f101E93b906",
      value: "500000000000000000",
      token: "0xA0b86a33E6842c4C4C4C4C4C4C4C4C4C4C4C4C4C",
      transaction_hash: "0xbcd234ef567890bcd234ef567890bcd234ef567890bcd234ef567890bcd234ef",
      block_number: 18500001,
      log_index: 1,
    },
  ],
  metadata: {
    from_block: 18500000,
    to_block: 18500010,
    total_logs: 2,
    chunk_size: 1000,
    transfer_type: "token",
  },
}

// Mock Trace Data
export const mockTraceResults: TraceResult[] = [
  {
    trace: {
      trace_address: [],
      subtraces: 1,
      action: {
        call_type: "call",
        from: "0x742d35Cc6634C0532925a3b8D4C9db4C4C4C4C4C",
        to: "0xA0b86a33E6842c4C4C4C4C4C4C4C4C4C4C4C4C4C",
        value: "0x0de0b6b3a7640000",
        gas: "0x5208",
        input: "0x",
      },
      result: {
        gas_used: "0x5208",
        output: "0x",
      },
    },
    transaction_hash: "0xabc123def456789abc123def456789abc123def456789abc123def456789abc123",
    transaction_position: 0,
    block_hash: "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
    block_number: 18500000,
  },
  {
    trace: {
      trace_address: [0],
      subtraces: 0,
      action: {
        call_type: "call",
        from: "0xA0b86a33E6842c4C4C4C4C4C4C4C4C4C4C4C4C4C",
        to: "0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984",
        value: "0x0",
        gas: "0xfde8",
        input:
          "0xa9059cbb000000000000000000000000742d35cc6634c0532925a3b8d4c9db4c4c4c4c4c0000000000000000000000000000000000000000000000000de0b6b3a7640000",
      },
      result: {
        gas_used: "0x5208",
        output: "0x0000000000000000000000000000000000000000000000000000000000000001",
      },
    },
    transaction_hash: "0xabc123def456789abc123def456789abc123def456789abc123def456789abc123",
    transaction_position: 0,
    block_hash: "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
    block_number: 18500000,
  },
]

// Mock Data Provider Functions
export const mockDataProvider = {
  getBlockByNumber: (number: string | number, isRange?: boolean) => {
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve(isRange ? mockBlockRange : mockSingleBlock)
      }, 800)
    })
  },

  getTransactionByHash: (hash: string) => {
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve(mockTransaction)
      }, 600)
    })
  },

  getTransactionReceipt: (hash: string) => {
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve(mockTransactionReceipt)
      }, 600)
    })
  },

  getBalance: (address: string, date: string) => {
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve(mockBalance)
      }, 700)
    })
  },

  getLogs: () => {
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve(mockLogs)
      }, 900)
    })
  },

  getErc20WalletTransfers: (address: string) => {
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve(mockErc20WalletTransfers)
      }, 800)
    })
  },

  getErc20TokenTransfers: (address: string) => {
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve(mockErc20TokenTransfers)
      }, 800)
    })
  },

  getTraceFilter: (address?: string) => {
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve(mockTraceResults)
      }, 1000)
    })
  },
}

// Example data constants for forms
export const EXAMPLE_DATA = {
  addresses: {
    vitalik: "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045",
    uniswap: "0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984",
    usdc: "0xA0b86a33E6842c4C4C4C4C4C4C4C4C4C4C4C4C4C",
    contract: "0x742d35Cc6634C0532925a3b8D4C9db4C4C4C4C4C",
  },
  hashes: {
    transaction: "0xabc123def456789abc123def456789abc123def456789abc123def456789abc123",
    block: "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
  },
  blocks: {
    recent: 18500000,
    range: { from: 18500000, to: 18500010 },
  },
  dates: {
    recent: "2023-11-01",
    older: "2023-10-15",
  },
}
