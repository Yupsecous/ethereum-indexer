"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import {
    Menu,
    Coins,
    BarChart3,
    Database,
    Search,
    FileText,
    GitBranch,
    Play,
    Plus,
    AlertTriangle,
    Copy,
    ArrowUpRight,
    ArrowDownLeft,
    Wallet,
    ChevronLeft,
    ChevronRight,
    ChevronDown,
    ExternalLink,
    Calendar,
} from "lucide-react"
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet"
import MobileNavigation from "@/components/mobile-navigation"
import JsonViewer from "@/components/json-viewer"
import DebugDrawer from "@/components/debug-drawer"
import FilterChip from "@/components/filter-chip"
import {
    EthereumIndexerClient,
    type Erc20WalletTransfersResponse,
    type Erc20TokenTransfersResponse,
    type BalanceResponse,
    isValidBlockNumber,
    isValidAddress,
    isValidDate,
    normalizeAddress,
    truncateHash,
    formatWei,
    formatTimestamp,
    formatEth,
} from "@/lib/ethereum-client"
import { useToast } from "@/hooks/use-toast"
import { API_BASE_URL } from "@/lib/config"

const formatLargeNumber = (num: number | bigint): string => {
    const value = Number(num)
    if (value >= 1e18) return (value / 1e18).toFixed(2) + 'Q'
    if (value >= 1e15) return (value / 1e15).toFixed(2) + 'P'
    if (value >= 1e12) return (value / 1e12).toFixed(2) + 'T'
    if (value >= 1e9) return (value / 1e9).toFixed(2) + 'B'
    if (value >= 1e6) return (value / 1e6).toFixed(2) + 'M'
    if (value >= 1e3) return (value / 1e3).toFixed(2) + 'K'
    return value.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',')
}

export default function Erc20Page() {
    const [activeTab, setActiveTab] = useState("wallet")

    // Wallet tab state
    const [walletAddress, setWalletAddress] = useState("")
    const [walletFromBlock, setWalletFromBlock] = useState("")
    const [walletTokens, setWalletTokens] = useState<string[]>([])
    const [walletChunkSize, setWalletChunkSize] = useState("30000")
    const [newWalletToken, setNewWalletToken] = useState("")
    const [walletCurrentPage, setWalletCurrentPage] = useState(0)
    const [walletShowAdvanced, setWalletShowAdvanced] = useState(false)

    // Token tab state
    const [tokenAddress, setTokenAddress] = useState("")
    const [tokenFromBlock, setTokenFromBlock] = useState("")
    const [tokenChunkSize, setTokenChunkSize] = useState("30000")
    const [tokenCurrentPage, setTokenCurrentPage] = useState(0)

    // Token Balance tab state
    const [balanceTokenAddress, setBalanceTokenAddress] = useState("")
    const [balanceOwnerAddress, setBalanceOwnerAddress] = useState("")
    const [balanceDate, setBalanceDate] = useState("")
    const [balanceShowAdvanced, setBalanceShowAdvanced] = useState(false)
    const [balanceBlockRangeLo, setBalanceBlockRangeLo] = useState("")
    const [balanceBlockRangeHi, setBalanceBlockRangeHi] = useState("")
    const [balanceOnMiss, setBalanceOnMiss] = useState<"strict" | "clamp" | "auto_widen">("strict")
    const [balanceResult, setBalanceResult] = useState<BalanceResponse | null>(null)
    const [balanceApiError, setBalanceApiError] = useState<{ status?: number; message?: string } | null>(null)

    // Shared state
    const [loading, setLoading] = useState(false)
    const [walletResult, setWalletResult] = useState<Erc20WalletTransfersResponse | null>(null)
    const [tokenResult, setTokenResult] = useState<Erc20TokenTransfersResponse | null>(null)
    const [debugInfo, setDebugInfo] = useState<{ url?: string; params?: any; responseSize?: number }>({})
    const [errors, setErrors] = useState<{
        walletAddress?: string
        walletFromBlock?: string
        walletToken?: string
        tokenAddress?: string
        tokenFromBlock?: string
        balanceTokenAddress?: string
        balanceOwnerAddress?: string
        balanceDate?: string
        balanceBlockRange?: string
    }>({})

    // Pagination state
    const [itemsPerPage, setItemsPerPage] = useState(25)
    const [walletTablePage, setWalletTablePage] = useState(0)
    const [tokenTablePage, setTokenTablePage] = useState(0)

    const { toast } = useToast()
    const client = new EthereumIndexerClient(API_BASE_URL)

    // Prefill from query string for reruns
    // /erc20?tab=wallet&walletAddress=...&walletFromBlock=...&walletTokens=0xabc,0xdef&walletChunkSize=1000
    // /erc20?tab=token&tokenAddress=...&tokenFromBlock=...&tokenChunkSize=1000
    // /erc20?tab=balance&balanceTokenAddress=...&balanceOwnerAddress=...&balanceDate=...
    useEffect(() => {
        if (typeof window === "undefined") return
        const params = new URLSearchParams(window.location.search)
        const tab = params.get("tab")
        if (tab === "wallet" || tab === "token" || tab === "balance") setActiveTab(tab)
        // Wallet
        const wAddr = params.get("walletAddress")
        const wFrom = params.get("walletFromBlock")
        const wTokens = params.get("walletTokens")
        const wChunk = params.get("walletChunkSize")
        if (wAddr) setWalletAddress(wAddr)
        if (wFrom) setWalletFromBlock(wFrom)
        if (wTokens) {
            setWalletTokens(wTokens.split(",").filter(Boolean))
            setWalletShowAdvanced(true)
        }
        if (wChunk) setWalletChunkSize(wChunk)
        // Token
        const tAddr = params.get("tokenAddress")
        const tFrom = params.get("tokenFromBlock")
        const tChunk = params.get("tokenChunkSize")
        if (tAddr) setTokenAddress(tAddr)
        if (tFrom) setTokenFromBlock(tFrom)
        if (tChunk) setTokenChunkSize(tChunk)
        // Token Balance
        const btAddr = params.get("balanceTokenAddress")
        const boAddr = params.get("balanceOwnerAddress")
        const bDate = params.get("balanceDate")
        const bLo = params.get("balanceBlockRangeLo")
        const bHi = params.get("balanceBlockRangeHi")
        const bMiss = params.get("balanceOnMiss") as "strict" | "clamp" | "auto_widen" | null
        if (btAddr) setBalanceTokenAddress(btAddr)
        if (boAddr) setBalanceOwnerAddress(boAddr)
        if (bDate) setBalanceDate(bDate)
        if (bLo) setBalanceBlockRangeLo(bLo)
        if (bHi) setBalanceBlockRangeHi(bHi)
        if (bMiss === "strict" || bMiss === "clamp" || bMiss === "auto_widen") setBalanceOnMiss(bMiss)
        if (bLo || bHi) setBalanceShowAdvanced(true)
    }, [])

    const validateWalletInputs = () => {
        const newErrors: any = {}

        if (!walletAddress) {
            newErrors.walletAddress = "Wallet address is required"
        } else if (!isValidAddress(walletAddress)) {
            newErrors.walletAddress = "Invalid Ethereum address format"
        }

        if (!walletFromBlock) {
            newErrors.walletFromBlock = "From block is required"
        } else {
            const from = Number.parseInt(walletFromBlock)
            if (isNaN(from) || !isValidBlockNumber(from)) {
                newErrors.walletFromBlock = "Invalid from block number"
            }
        }

        return newErrors
    }

    const validateTokenInputs = () => {
        const newErrors: any = {}

        if (!tokenAddress) {
            newErrors.tokenAddress = "Token address is required"
        } else if (!isValidAddress(tokenAddress)) {
            newErrors.tokenAddress = "Invalid Ethereum address format"
        }

        if (!tokenFromBlock) {
            newErrors.tokenFromBlock = "From block is required"
        } else {
            const from = Number.parseInt(tokenFromBlock)
            if (isNaN(from) || !isValidBlockNumber(from)) {
                newErrors.tokenFromBlock = "Invalid from block number"
            }
        }

        return newErrors
    }

    const validateBalanceInputs = () => {
        const newErrors: any = {}

        if (!balanceTokenAddress) {
            newErrors.balanceTokenAddress = "Token address is required"
        } else if (!isValidAddress(balanceTokenAddress)) {
            newErrors.balanceTokenAddress = "Invalid Ethereum address format"
        }

        if (!balanceOwnerAddress) {
            newErrors.balanceOwnerAddress = "Owner address is required"
        } else if (!isValidAddress(balanceOwnerAddress)) {
            newErrors.balanceOwnerAddress = "Invalid Ethereum address format"
        }

        if (!balanceDate) {
            newErrors.balanceDate = "Date is required"
        } else if (!isValidDate(balanceDate)) {
            newErrors.balanceDate = "Invalid date format (use YYYY-MM-DD)"
        } else {
            const dateObj = new Date(balanceDate)
            const now = new Date()
            if (dateObj > now) {
                newErrors.balanceDate = "Date cannot be in the future"
            }
        }

        if (balanceBlockRangeLo || balanceBlockRangeHi) {
            const lo = Number.parseInt(balanceBlockRangeLo)
            const hi = Number.parseInt(balanceBlockRangeHi)

            if (balanceBlockRangeLo && (isNaN(lo) || !isValidBlockNumber(lo))) {
                newErrors.balanceBlockRange = "Invalid low block number"
            } else if (balanceBlockRangeHi && (isNaN(hi) || !isValidBlockNumber(hi))) {
                newErrors.balanceBlockRange = "Invalid high block number"
            } else if (balanceBlockRangeLo && balanceBlockRangeHi && lo >= hi) {
                newErrors.balanceBlockRange = "Low block must be less than high block"
            }
        }

        return newErrors
    }

    const addWalletToken = () => {
        if (!newWalletToken) return

        if (!isValidAddress(newWalletToken)) {
            setErrors({ ...errors, walletToken: "Invalid token address format" })
            return
        }

        if (walletTokens.includes(newWalletToken)) {
            setErrors({ ...errors, walletToken: "Token already added" })
            return
        }

        setWalletTokens([...walletTokens, normalizeAddress(newWalletToken)])
        setNewWalletToken("")
        setErrors({ ...errors, walletToken: undefined })
    }

    const removeWalletToken = (token: string) => {
        setWalletTokens(walletTokens.filter((t) => t !== token))
    }

    const handleWalletAdvancedToggle = (open: boolean) => {
        setWalletShowAdvanced(open)
        if (!open) {
            // Clear advanced options when collapsed
            setWalletTokens([])
            setNewWalletToken("")
            setErrors({ ...errors, walletToken: undefined })
        }
    }

    const handleWalletQuery = async (pageIndex = walletCurrentPage) => {
        const validationErrors = validateWalletInputs()
        if (Object.keys(validationErrors).length > 0) {
            setErrors({ ...errors, ...validationErrors })
            return
        }

        setErrors({})
        setLoading(true)
        setWalletResult(null)

        try {
            const baseFrom = Number.parseInt(walletFromBlock)
            const chunkSize = Number.parseInt(walletChunkSize)
            const rangeStart = baseFrom + pageIndex * chunkSize
            const rangeEnd = rangeStart + chunkSize

            const params: any = {
                from: rangeStart,
                to: rangeEnd,
            }

            if (walletTokens.length > 0) params.tokens = walletTokens
            //if (walletChunkSize) params.chunk_size = chunkSize

            const normalizedWalletAddress = normalizeAddress(walletAddress)
            const result = await client.getErc20WalletTransfers(normalizedWalletAddress, params)
            setWalletResult(result)
            setWalletCurrentPage(pageIndex)

            setDebugInfo({
                url: `${API_BASE_URL}/api/eth/getLogs/erc20/wallet/${normalizedWalletAddress}`,
                params,
                responseSize: JSON.stringify(result).length,
            })

            toast({
                title: "Wallet transfers fetched successfully",
                description: `Retrieved ${result.logs.length} transfers from ${result.metadata.total_logs} total`,
            })

            // Store in recent queries
            const query = {
                id: Date.now().toString(),
                type: "ERC-20 Wallet",
                query: `${truncateHash(walletAddress)} (${result.logs.length} transfers)`,
                timestamp: new Date(),
                status: "success" as const,
                href: `/erc20?tab=wallet&walletAddress=${encodeURIComponent(
                    normalizedWalletAddress
                )}&walletFromBlock=${encodeURIComponent(walletFromBlock)}${walletTokens.length > 0 ? `&walletTokens=${encodeURIComponent(walletTokens.join(","))}` : ""}${walletChunkSize ? `&walletChunkSize=${encodeURIComponent(walletChunkSize)}` : ""
                    }`,
            }
            const stored = localStorage.getItem("ethereum-indexer-queries") || "[]"
            const queries = JSON.parse(stored)
            queries.unshift(query)
            localStorage.setItem("ethereum-indexer-queries", JSON.stringify(queries.slice(0, 10)))
        } catch (error: any) {
            toast({
                title: "Error fetching wallet transfers",
                description: error.message || "Failed to fetch wallet transfer data",
                variant: "destructive",
            })
        } finally {
            setLoading(false)
        }
    }

    const handleTokenQuery = async (pageIndex = tokenCurrentPage) => {
        const validationErrors = validateTokenInputs()
        if (Object.keys(validationErrors).length > 0) {
            setErrors({ ...errors, ...validationErrors })
            return
        }

        setErrors({})
        setLoading(true)
        setTokenResult(null)

        try {
            const baseFrom = Number.parseInt(tokenFromBlock)
            const chunkSize = Number.parseInt(tokenChunkSize)
            const rangeStart = baseFrom + pageIndex * chunkSize
            const rangeEnd = rangeStart + chunkSize

            const params: any = {
                from: rangeStart,
                to: rangeEnd,
            }

            if (tokenChunkSize) params.chunk_size = chunkSize

            const normalizedTokenAddress = normalizeAddress(tokenAddress)
            const result = await client.getErc20TokenTransfers(normalizedTokenAddress, params)
            setTokenResult(result)
            setTokenCurrentPage(pageIndex)

            setDebugInfo({
                url: `${API_BASE_URL}/api/eth/getLogs/erc20/token/${normalizedTokenAddress}`,
                params,
                responseSize: JSON.stringify(result).length,
            })

            toast({
                title: "Token transfers fetched successfully",
                description: `Retrieved ${result.logs.length} transfers from ${result.metadata.total_logs} total`,
            })

            // Store in recent queries
            const query = {
                id: Date.now().toString(),
                type: "ERC-20 Token",
                query: `${truncateHash(tokenAddress)} (${result.logs.length} transfers)`,
                timestamp: new Date(),
                status: "success" as const,
                href: `/erc20?tab=token&tokenAddress=${encodeURIComponent(
                    normalizedTokenAddress
                )}&tokenFromBlock=${encodeURIComponent(tokenFromBlock)}${tokenChunkSize ? `&tokenChunkSize=${encodeURIComponent(tokenChunkSize)}` : ""}`,
            }
            const stored = localStorage.getItem("ethereum-indexer-queries") || "[]"
            const queries = JSON.parse(stored)
            queries.unshift(query)
            localStorage.setItem("ethereum-indexer-queries", JSON.stringify(queries.slice(0, 10)))
        } catch (error: any) {
            toast({
                title: "Error fetching token transfers",
                description: error.message || "Failed to fetch token transfer data",
                variant: "destructive",
            })
        } finally {
            setLoading(false)
        }
    }

    const handleBalanceQuery = async () => {
        const validationErrors = validateBalanceInputs()
        if (Object.keys(validationErrors).length > 0) {
            setErrors({ ...errors, ...validationErrors })
            return
        }

        setErrors({})
        setLoading(true)
        setBalanceResult(null)
        setBalanceApiError(null)

        try {
            const params: Record<string, any> = { on_miss: balanceOnMiss }
            if (balanceBlockRangeLo) params.block_range_lo = Number.parseInt(balanceBlockRangeLo)
            if (balanceBlockRangeHi) params.block_range_hi = Number.parseInt(balanceBlockRangeHi)

            const normalizedTokenAddress = normalizeAddress(balanceTokenAddress)
            const normalizedOwnerAddress = normalizeAddress(balanceOwnerAddress)
            const url = new URL(`/api/eth/getErc20Balance/${normalizedTokenAddress}/${normalizedOwnerAddress}/${balanceDate}`, API_BASE_URL)
            Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, String(v)))

            const res = await fetch(url.toString())
            if (!res.ok) {
                const errorText = await res.text()
                setBalanceApiError({
                    status: res.status,
                    message: errorText || `Request failed with status ${res.status}`
                })
                return
            }
            const balanceResult: BalanceResponse = await res.json()
            setBalanceResult(balanceResult)

            setDebugInfo({
                url: url.toString(),
                params,
                responseSize: JSON.stringify(balanceResult).length,
            })

            toast({
                title: "Token balance fetched successfully",
                description: `Retrieved balance for ${balanceOwnerAddress ? truncateHash(balanceOwnerAddress) : 'address'} on ${balanceDate}`,
            })

            // Store in recent queries
            const query = {
                id: Date.now().toString(),
                type: "ERC-20 Balance",
                query: `${balanceTokenAddress ? truncateHash(balanceTokenAddress) : 'token'} for ${balanceOwnerAddress ? truncateHash(balanceOwnerAddress) : 'address'} on ${balanceDate}`,
                timestamp: new Date(),
                status: "success" as const,
                href: `/erc20?tab=balance&balanceTokenAddress=${encodeURIComponent(normalizedTokenAddress)}&balanceOwnerAddress=${encodeURIComponent(normalizedOwnerAddress)}&balanceDate=${encodeURIComponent(balanceDate)}${balanceBlockRangeLo ? `&balanceBlockRangeLo=${encodeURIComponent(balanceBlockRangeLo)}` : ""}${balanceBlockRangeHi ? `&balanceBlockRangeHi=${encodeURIComponent(balanceBlockRangeHi)}` : ""}&balanceOnMiss=${encodeURIComponent(balanceOnMiss)}`,
            }
            const stored = localStorage.getItem("ethereum-indexer-queries") || "[]"
            const queries = JSON.parse(stored)
            queries.unshift(query)
            localStorage.setItem("ethereum-indexer-queries", JSON.stringify(queries.slice(0, 10)))
        } catch (error: any) {
            toast({
                title: "Error fetching token balance",
                description: error.message || "Failed to fetch token balance data",
                variant: "destructive",
            })
        } finally {
            setLoading(false)
        }
    }

    const setBalanceToday = () => {
        const today = new Date().toISOString().split("T")[0]
        setBalanceDate(today)
    }

    const handleBalanceAdvancedToggle = (open: boolean) => {
        setBalanceShowAdvanced(open)
        if (!open) {
            // Clear advanced options when collapsed
            setBalanceBlockRangeLo("")
            setBalanceBlockRangeHi("")
        }
    }

    const copyToClipboard = (text: string, label: string) => {
        navigator.clipboard.writeText(text)
        toast({
            title: "Copied to clipboard",
            description: `${label} has been copied to your clipboard.`,
        })
    }

    const handleItemsPerPageChange = (value: string) => {
        setItemsPerPage(Number(value))
        setWalletTablePage(0)
        setTokenTablePage(0)
    }

    const renderPaginationControls = (
        currentPage: number,
        setCurrentPage: (page: number) => void,
        totalItems: number,
        label: string
    ) => {
        const totalPages = Math.ceil(totalItems / itemsPerPage)
        const startItem = currentPage * itemsPerPage + 1
        const endItem = Math.min((currentPage + 1) * itemsPerPage, totalItems)

        const handlePageInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
            const value = e.target.value
            if (value === '') return
            const pageNumber = parseInt(value) - 1
            if (pageNumber >= 0 && pageNumber < totalPages) {
                setCurrentPage(pageNumber)
            }
        }

        const handlePageInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
            if (e.key === 'Enter') {
                e.currentTarget.blur()
            }
        }

        return (
            <div className="flex items-center justify-between gap-4 p-4 border-t-2 border-black">
                <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">Show:</span>
                    <Select value={itemsPerPage.toString()} onValueChange={handleItemsPerPageChange}>
                        <SelectTrigger className="w-20 border-2 border-black rounded-lg">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="25">25</SelectItem>
                            <SelectItem value="50">50</SelectItem>
                            <SelectItem value="100">100</SelectItem>
                        </SelectContent>
                    </Select>
                    <span className="text-sm text-muted-foreground">
                        {startItem}-{endItem} of {totalItems.toLocaleString()} {label}
                    </span>
                </div>
                <div className="flex items-center gap-2">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(0)}
                        disabled={currentPage === 0}
                        className="border-2 border-black rounded-lg"
                    >
                        First
                    </Button>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(currentPage - 1)}
                        disabled={currentPage === 0}
                        className="border-2 border-black rounded-lg"
                    >
                        <ChevronLeft className="h-4 w-4" />
                        Previous
                    </Button>
                    <div className="flex items-center gap-1">
                        <span className="text-sm font-medium">Page</span>
                        <Input
                            type="number"
                            min={1}
                            max={totalPages}
                            value={currentPage + 1}
                            onChange={handlePageInputChange}
                            onKeyDown={handlePageInputKeyDown}
                            className="w-16 h-8 text-center border-2 border-black rounded-lg font-mono text-sm"
                        />
                        <span className="text-sm font-medium">of {totalPages}</span>
                    </div>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(currentPage + 1)}
                        disabled={currentPage >= totalPages - 1}
                        className="border-2 border-black rounded-lg"
                    >
                        Next
                        <ChevronRight className="h-4 w-4" />
                    </Button>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(totalPages - 1)}
                        disabled={currentPage >= totalPages - 1}
                        className="border-2 border-black rounded-lg"
                    >
                        Last
                    </Button>
                </div>
            </div>
        )
    }


    return (
        <div className="min-h-screen p-2 sm:p-4 md:p-8"
             style={{
                 backgroundColor: '#ffffff',
                 opacity: 1,
                 backgroundImage: 'linear-gradient(135deg, #f78552 25%, transparent 25%), linear-gradient(225deg, #f78552 25%, transparent 25%), linear-gradient(45deg, #f78552 25%, transparent 25%), linear-gradient(315deg, #f78552 25%, #ffffff 25%)',
                 backgroundPosition: '4px 0, 4px 0, 0 0, 0 0',
                 backgroundSize: '4px 4px',
             }}>
            <div className="w-full max-w-7xl mx-auto bg-white border-4 border-black rounded-3xl shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] overflow-hidden">
                {/* Header */}
                <header className="border-b-4 border-black p-4 sm:p-6 bg-white/40 backdrop-blur-md">
                    <div className="flex justify-between items-center gap-4">
                        <div className="flex items-center gap-x-3">
                            <Image
                                src="/logo.png"
                                alt="Ethereum Indexer Logo"
                                width={60}
                                height={40}
                                className=""
                                priority
                            />
                            <h1 className="text-2xl sm:text-3xl md:text-4xl font-black tracking-tight">ETHEREUM INDEXER</h1>
                        </div>

                        <div className="flex md:hidden">
                            <Sheet>
                                <SheetTrigger asChild>
                                    <Button variant="outline" size="icon" className="rounded-xl border-2 border-black bg-transparent">
                                        <Menu className="h-5 w-5" />
                                    </Button>
                                </SheetTrigger>
                                <SheetContent side="left" className="border-r-4 border-black p-0">
                                    <MobileNavigation />
                                </SheetContent>
                            </Sheet>
                        </div>

                        <div className="hidden sm:flex items-center gap-3">
                            <Button className="bg-black hover:bg-black/80 text-white rounded-xl border-2 border-black font-bold shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                                API Docs
                            </Button>
                            <Button
                                variant="outline"
                                className="rounded-xl border-2 border-black font-bold shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] bg-transparent"
                            >
                                Settings
                            </Button>
                        </div>
                    </div>
                </header>

                <div className="grid md:grid-cols-[280px_1fr] h-[calc(100vh-6rem)]">
                    {/* Sidebar */}
                    <div className="hidden md:block border-r-4 border-black bg-white/40 p-4">
                        <nav className="space-y-2">
                            <Link href="/" className="flex items-center gap-2 text-lg font-bold p-3 hover:bg-black/10 rounded-xl">
                                <BarChart3 className="h-5 w-5" />
                                Dashboard
                            </Link>
                            <Link
                                href="/trace"
                                className="flex items-center gap-2 text-lg font-bold p-3 hover:bg-black/10 rounded-xl"
                            >
                                <GitBranch className="h-5 w-5" />
                                Trace
                            </Link>
                            <Link
                                href="/transactions"
                                className="flex items-center gap-2 text-lg font-bold p-3 hover:bg-black/10 rounded-xl"
                            >
                                <Search className="h-5 w-5" />
                                Transactions
                            </Link>
                            <Link
                                href="/balances"
                                className="flex items-center gap-2 text-lg font-bold p-3 hover:bg-black/10 rounded-xl"
                            >
                                <Coins className="h-5 w-5" />
                                Balances
                            </Link>
                            <Link
                                href="/erc20"
                                className="flex items-center gap-2 text-lg font-bold p-3 bg-black text-white rounded-xl"
                            >
                                <Coins className="h-5 w-5" />
                                ERC-20
                            </Link>
                        </nav>
                    </div>

                    {/* Main content */}
                    <div className="overflow-auto bg-[#F1F1F1] p-4 sm:p-6">
                        <div className="mb-6">
                            <h2 className="text-2xl font-black mb-2">ERC-20 TRANSFERS TRACKER</h2>
                            <p className="text-muted-foreground">Track ERC-20 token transfers by wallet or token contract</p>
                        </div>

                        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                            <TabsList className="w-full bg-white/50 border-2 border-black rounded-xl p-1 mb-6">
                                <TabsTrigger
                                    value="wallet"
                                    className="rounded-lg data-[state=active]:bg-black data-[state=active]:text-white font-bold"
                                >
                                    <Wallet className="h-4 w-4 mr-2" />
                                    Wallet Transfers
                                </TabsTrigger>
                                <TabsTrigger
                                    value="token"
                                    className="rounded-lg data-[state=active]:bg-black data-[state=active]:text-white font-bold"
                                >
                                    <Coins className="h-4 w-4 mr-2" />
                                    Token Transfers
                                </TabsTrigger>
                                <TabsTrigger
                                    value="balance"
                                    className="rounded-lg data-[state=active]:bg-black data-[state=active]:text-white font-bold"
                                >
                                    <Coins className="h-4 w-4 mr-2" />
                                    Token Balance
                                </TabsTrigger>
                            </TabsList>

                            <TabsContent value="wallet" className="space-y-6">
                                <Card className="border-2 border-black rounded-xl">
                                    <CardHeader>
                                        <CardTitle className="flex items-center gap-2">
                                            <Wallet className="h-5 w-5" />
                                            Wallet Transfer Query
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent className="space-y-4">
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <div className="space-y-2">
                                                <Label htmlFor="wallet-address">Wallet Address</Label>
                                                <Input
                                                    id="wallet-address"
                                                    placeholder="0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045"
                                                    value={walletAddress}
                                                    onChange={(e) => setWalletAddress(e.target.value)}
                                                    className="border-2 border-black rounded-lg font-mono"
                                                />
                                                {errors.walletAddress && (
                                                    <p className="text-sm text-red-600 font-medium">{errors.walletAddress}</p>
                                                )}
                                            </div>
                                            <div className="space-y-2">
                                                <Label htmlFor="wallet-chunk-size">Chunk Size</Label>
                                                <Select value={walletChunkSize} onValueChange={setWalletChunkSize}>
                                                    <SelectTrigger className="border-2 border-black rounded-lg">
                                                        <SelectValue />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="30000">30K</SelectItem>
                                                        <SelectItem value="50000">50K</SelectItem>
                                                        <SelectItem value="100000">100K</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                        </div>

                                        <div className="space-y-2">
                                            <Label htmlFor="wallet-from-block">Start Block</Label>
                                            <Input
                                                id="wallet-from-block"
                                                placeholder="18000000"
                                                value={walletFromBlock}
                                                onChange={(e) => setWalletFromBlock(e.target.value)}
                                                className="border-2 border-black rounded-lg"
                                            />
                                            {errors.walletFromBlock && (
                                                <p className="text-sm text-red-600 font-medium">{errors.walletFromBlock}</p>
                                            )}
                                        </div>

                                        {/* Advanced Options */}
                                        <Collapsible open={walletShowAdvanced} onOpenChange={handleWalletAdvancedToggle}>
                                            <CollapsibleTrigger asChild>
                                                <Button
                                                    variant="outline"
                                                    className="w-full justify-between border-2 border-black rounded-lg bg-transparent"
                                                >
                                                    Advanced Options
                                                    {walletShowAdvanced ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                                                </Button>
                                            </CollapsibleTrigger>
                                            <CollapsibleContent className="space-y-4 mt-4">
                                                <div className="space-y-2">
                                                    <Label>Token Addresses (optional)</Label>
                                                    <div className="flex gap-2">
                                                        <Input
                                                            placeholder="0xA0b86a33E6441b73aE6b5b0e48e95AD1A756b3a5"
                                                            value={newWalletToken}
                                                            onChange={(e) => setNewWalletToken(e.target.value)}
                                                            className="border-2 border-black rounded-lg font-mono"
                                                        />
                                                        <Button
                                                            onClick={addWalletToken}
                                                            variant="outline"
                                                            className="border-2 border-black rounded-lg bg-transparent"
                                                        >
                                                            <Plus className="h-4 w-4" />
                                                        </Button>
                                                    </div>
                                                    {errors.walletToken && <p className="text-sm text-red-600 font-medium">{errors.walletToken}</p>}
                                                    {walletTokens.length > 0 && (
                                                        <div className="flex flex-wrap gap-2">
                                                            {walletTokens.map((token) => (
                                                                <FilterChip
                                                                    key={token}
                                                                    label={truncateHash(token, 12)}
                                                                    onRemove={() => removeWalletToken(token)}
                                                                />
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            </CollapsibleContent>
                                        </Collapsible>

                                        {/* Block range controls */}
                                        <div className="flex items-center justify-between gap-2">
                                            <div className="flex items-center gap-2">
                                                <Button
                                                    variant="outline"
                                                    size="icon"
                                                    onClick={() => walletCurrentPage > 0 && handleWalletQuery(walletCurrentPage - 1)}
                                                    disabled={walletCurrentPage === 0 || loading || !walletFromBlock || !walletAddress}
                                                    className="border-2 border-black rounded-lg bg-white"
                                                    title="Previous range"
                                                >
                                                    <ChevronLeft className="h-4 w-4" />
                                                </Button>
                                                <div className="px-3 py-2 text-center font-bold border-2 border-black rounded-lg bg-white/60 min-w-[260px]">
                                                    {(() => {
                                                        const fb = Number.parseInt(walletFromBlock || "0")
                                                        const chunkSize = Number.parseInt(walletChunkSize)
                                                        if (isNaN(fb) || isNaN(chunkSize)) return "-"
                                                        const rs = fb + walletCurrentPage * chunkSize
                                                        const re = rs + chunkSize
                                                        return `#${rs.toLocaleString()} - #${re.toLocaleString()}`
                                                    })()}
                                                </div>
                                                <Button
                                                    variant="outline"
                                                    size="icon"
                                                    onClick={() => handleWalletQuery(walletCurrentPage + 1)}
                                                    disabled={loading || !walletFromBlock || !walletAddress}
                                                    className="border-2 border-black rounded-lg bg-white"
                                                    title="Next range"
                                                >
                                                    <ChevronRight className="h-4 w-4" />
                                                </Button>
                                                {walletCurrentPage > 0 && walletResult && (
                                                    <Button
                                                        variant="outline"
                                                        onClick={() => handleWalletQuery(0)}
                                                        disabled={loading}
                                                        className="border-2 border-black rounded-lg bg-white font-bold ml-2"
                                                        title="Return to initial block range"
                                                    >
                                                        Return to Initial Range
                                                    </Button>
                                                )}
                                            </div>
                                            {walletResult && (
                                                <div className="text-sm font-bold">
                                                    Total Transfers: {walletResult?.logs?.length?.toLocaleString() || '0'}
                                                </div>
                                            )}
                                        </div>

                                        <div className="flex gap-2">
                                            <Button
                                                onClick={() => handleWalletQuery(0)}
                                                disabled={loading}
                                                className="bg-[#F86753] hover:bg-[#fb8c7d] text-white rounded-xl border-2 border-black font-bold shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]"
                                            >
                                                <Play className="h-4 w-4" />
                                                {loading ? "Running..." : "Run Query"}
                                            </Button>
                                        </div>
                                    </CardContent>
                                </Card>

                                {loading && activeTab === "wallet" && (
                                    <Card className="border-2 border-black rounded-xl">
                                        <CardContent className="p-6">
                                            <div className="space-y-4">
                                                <Skeleton className="h-4 w-3/4" />
                                                <Skeleton className="h-4 w-1/2" />
                                                <Skeleton className="h-32 w-full" />
                                            </div>
                                        </CardContent>
                                    </Card>
                                )}

                                {walletResult && (
                                    <div className="space-y-4">
                                        {/* Metadata */}
                                        {/* 
                                        <Card className="border-2 border-black rounded-xl">
                                            <CardHeader>
                                                <CardTitle>Wallet Transfer Results</CardTitle>
                                            </CardHeader>
                                            <CardContent>
                                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                                    <div>
                                                        <p className="text-sm text-muted-foreground">From Block</p>
                                                        <p className="font-bold">#{walletResult.metadata.from_block}</p>
                                                    </div>
                                                    <div>
                                                        <p className="text-sm text-muted-foreground">To Block</p>
                                                        <p className="font-bold">#{walletResult.metadata.to_block}</p>
                                                    </div>
                                                    <div>
                                                        <p className="text-sm text-muted-foreground">Total Transfers</p>
                                                        <p className="font-bold">{walletResult.metadata.total_logs}</p>
                                                    </div>
                                                    <div>
                                                        <p className="text-sm text-muted-foreground">Total Value</p>
                                                        <p className="font-bold">{(() => {
                                                            const totalWei = walletResult.logs.reduce((sum, transfer) => {
                                                                try {
                                                                    return sum + BigInt(transfer.value)
                                                                } catch {
                                                                    return sum
                                                                }
                                                            }, BigInt(0))
                                                            return formatLargeNumber(totalWei)
                                                        })()}</p>
                                                    </div>
                                                </div>
                                            </CardContent>
                                        </Card>
                                        */}

                                        {/* Results Table */}
                                        <Card className="border-2 border-black rounded-xl">
                                            <CardHeader>
                                                <CardTitle>ERC-20 Transfers</CardTitle>
                                            </CardHeader>
                                            <CardContent>
                                                <div className="overflow-x-auto">
                                                    <Table>
                                                        <TableHeader>
                                                            <TableRow>
                                                                <TableHead>Type</TableHead>
                                                                <TableHead>From</TableHead>
                                                                <TableHead>To</TableHead>
                                                                <TableHead>Value</TableHead>
                                                                <TableHead>Token</TableHead>
                                                                <TableHead>Tx Hash</TableHead>
                                                                <TableHead>Block</TableHead>
                                                                <TableHead>Lane</TableHead>
                                                                <TableHead>Actions</TableHead>
                                                            </TableRow>
                                                        </TableHeader>
                                                        <TableBody>
                                                            {(walletResult?.logs || [])
                                                                .slice(walletTablePage * itemsPerPage, (walletTablePage + 1) * itemsPerPage)
                                                                .map((transfer, index) => (
                                                                    <TableRow key={index}>
                                                                        <TableCell>
                                                                            <Badge variant="outline" className="border-[#F86753] text-[#F86753]">
                                                                                {transfer.type}
                                                                            </Badge>
                                                                        </TableCell>
                                                                        <TableCell>
                                                                            <TooltipProvider>
                                                                                <Tooltip>
                                                                                    <TooltipTrigger>
                                                                                        <span className="font-mono text-sm">{truncateHash(transfer.from, 8)}</span>
                                                                                    </TooltipTrigger>
                                                                                    <TooltipContent>
                                                                                        <p>{transfer.from}</p>
                                                                                    </TooltipContent>
                                                                                </Tooltip>
                                                                            </TooltipProvider>
                                                                        </TableCell>
                                                                        <TableCell>
                                                                            <TooltipProvider>
                                                                                <Tooltip>
                                                                                    <TooltipTrigger>
                                                                                        <span className="font-mono text-sm">{truncateHash(transfer.to, 8)}</span>
                                                                                    </TooltipTrigger>
                                                                                    <TooltipContent>
                                                                                        <p>{transfer.to}</p>
                                                                                    </TooltipContent>
                                                                                </Tooltip>
                                                                            </TooltipProvider>
                                                                        </TableCell>
                                                                        <TableCell>
                                                                            <span className="font-bold">{formatWei(transfer.value)}</span>
                                                                        </TableCell>
                                                                        <TableCell>
                                                                            <span className="font-mono text-sm">{truncateHash(transfer.token, 8)}</span>
                                                                        </TableCell>
                                                                        <TableCell>
                                                                            {transfer.transaction_hash && (
                                                                                <span className="font-mono text-sm">
                                                                                    {truncateHash(transfer.transaction_hash, 8)}
                                                                                </span>
                                                                            )}
                                                                        </TableCell>
                                                                        <TableCell>
                                                                            {transfer.block_number && (
                                                                                <span className="font-bold">#{transfer.block_number}</span>
                                                                            )}
                                                                        </TableCell>
                                                                        <TableCell>
                                                                            {transfer.lane && (
                                                                                <Badge
                                                                                    variant="outline"
                                                                                    className={`border-black ${transfer.lane === "FROM" ? "text-red-600" : "text-green-600"
                                                                                        }`}
                                                                                >
                                                                                    {transfer.lane === "FROM" ? (
                                                                                        <ArrowUpRight className="h-3 w-3 mr-1" />
                                                                                    ) : (
                                                                                        <ArrowDownLeft className="h-3 w-3 mr-1" />
                                                                                    )}
                                                                                    {transfer.lane}
                                                                                </Badge>
                                                                            )}
                                                                        </TableCell>
                                                                        <TableCell>
                                                                            <div className="flex gap-1">
                                                                                {transfer.transaction_hash && (
                                                                                    <>
                                                                                        <Button
                                                                                            variant="outline"
                                                                                            size="sm"
                                                                                            onClick={() => copyToClipboard(transfer.transaction_hash!, "Transaction hash")}
                                                                                            className="border border-black rounded-lg h-6 px-2"
                                                                                        >
                                                                                            <Copy className="h-3 w-3" />
                                                                                        </Button>
                                                                                        <Link href={`/transactions?txHash=${transfer.transaction_hash}`}>
                                                                                            <Button
                                                                                                variant="outline"
                                                                                                size="sm"
                                                                                                className="border border-black rounded-lg h-6 px-2"
                                                                                                title="View transaction details"
                                                                                            >
                                                                                                <ExternalLink className="h-3 w-3" />
                                                                                            </Button>
                                                                                        </Link>
                                                                                    </>
                                                                                )}
                                                                            </div>
                                                                        </TableCell>
                                                                    </TableRow>
                                                                ))}
                                                        </TableBody>
                                                    </Table>
                                                </div>
                                                {renderPaginationControls(
                                                    walletTablePage,
                                                    setWalletTablePage,
                                                    walletResult?.logs?.length || 0,
                                                    "transfers"
                                                )}
                                            </CardContent>
                                        </Card>

                                        <JsonViewer data={walletResult} title="Raw Wallet Transfer Data" />
                                    </div>
                                )}
                            </TabsContent>

                            <TabsContent value="token" className="space-y-6">
                                <Card className="border-2 border-black rounded-xl">
                                    <CardHeader>
                                        <CardTitle className="flex items-center gap-2">
                                            <Coins className="h-5 w-5" />
                                            Token Transfer Query
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent className="space-y-4">
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <div className="space-y-2">
                                                <Label htmlFor="token-address">Token Address</Label>
                                                <Input
                                                    id="token-address"
                                                    placeholder="0xA0b86a33E6441b73aE6b5b0e48e95AD1A756b3a5"
                                                    value={tokenAddress}
                                                    onChange={(e) => setTokenAddress(e.target.value)}
                                                    className="border-2 border-black rounded-lg font-mono"
                                                />
                                                {errors.tokenAddress && (
                                                    <p className="text-sm text-red-600 font-medium">{errors.tokenAddress}</p>
                                                )}
                                            </div>
                                            <div className="space-y-2">
                                                <Label htmlFor="token-chunk-size">Chunk Size</Label>
                                                <Select value={tokenChunkSize} onValueChange={setTokenChunkSize}>
                                                    <SelectTrigger className="border-2 border-black rounded-lg">
                                                        <SelectValue />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="30000">30K</SelectItem>
                                                        <SelectItem value="50000">50K</SelectItem>
                                                        <SelectItem value="100000">100K</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                        </div>

                                        <div className="space-y-2">
                                            <Label htmlFor="token-from-block">Start Block</Label>
                                            <Input
                                                id="token-from-block"
                                                placeholder="18000000"
                                                value={tokenFromBlock}
                                                onChange={(e) => setTokenFromBlock(e.target.value)}
                                                className="border-2 border-black rounded-lg"
                                            />
                                            {errors.tokenFromBlock && (
                                                <p className="text-sm text-red-600 font-medium">{errors.tokenFromBlock}</p>
                                            )}
                                        </div>

                                        {/* Block range controls */}
                                        <div className="flex items-center justify-between gap-2">
                                            <div className="flex items-center gap-2">
                                                <Button
                                                    variant="outline"
                                                    size="icon"
                                                    onClick={() => tokenCurrentPage > 0 && handleTokenQuery(tokenCurrentPage - 1)}
                                                    disabled={tokenCurrentPage === 0 || loading || !tokenFromBlock || !tokenAddress}
                                                    className="border-2 border-black rounded-lg bg-white"
                                                    title="Previous range"
                                                >
                                                    <ChevronLeft className="h-4 w-4" />
                                                </Button>
                                                <div className="px-3 py-2 text-center font-bold border-2 border-black rounded-lg bg-white/60 min-w-[260px]">
                                                    {(() => {
                                                        const fb = Number.parseInt(tokenFromBlock || "0")
                                                        const chunkSize = Number.parseInt(tokenChunkSize)
                                                        if (isNaN(fb) || isNaN(chunkSize)) return "-"
                                                        const rs = fb + tokenCurrentPage * chunkSize
                                                        const re = rs + chunkSize
                                                        return `#${rs.toLocaleString()} - #${re.toLocaleString()}`
                                                    })()}
                                                </div>
                                                <Button
                                                    variant="outline"
                                                    size="icon"
                                                    onClick={() => handleTokenQuery(tokenCurrentPage + 1)}
                                                    disabled={loading || !tokenFromBlock || !tokenAddress}
                                                    className="border-2 border-black rounded-lg bg-white"
                                                    title="Next range"
                                                >
                                                    <ChevronRight className="h-4 w-4" />
                                                </Button>
                                                {tokenCurrentPage > 0 && tokenResult && (
                                                    <Button
                                                        variant="outline"
                                                        onClick={() => handleTokenQuery(0)}
                                                        disabled={loading}
                                                        className="border-2 border-black rounded-lg bg-white font-bold ml-2"
                                                        title="Return to initial block range"
                                                    >
                                                        Return to Initial Range
                                                    </Button>
                                                )}
                                            </div>
                                            {tokenResult && (
                                                <div className="text-sm font-bold">
                                                    Total Transfers: {tokenResult?.logs?.length?.toLocaleString() || '0'}
                                                </div>
                                            )}
                                        </div>

                                        <div className="flex gap-2">
                                            <Button
                                                onClick={() => handleTokenQuery(0)}
                                                disabled={loading}
                                                className="bg-[#F86753] hover:bg-[#fb8c7d] text-white rounded-xl border-2 border-black font-bold shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]"
                                            >
                                                <Play className="h-4 w-4" />
                                                {loading ? "Running..." : "Run Query"}
                                            </Button>
                                        </div>
                                    </CardContent>
                                </Card>

                                {loading && activeTab === "token" && (
                                    <Card className="border-2 border-black rounded-xl">
                                        <CardContent className="p-6">
                                            <div className="space-y-4">
                                                <Skeleton className="h-4 w-3/4" />
                                                <Skeleton className="h-4 w-1/2" />
                                                <Skeleton className="h-32 w-full" />
                                            </div>
                                        </CardContent>
                                    </Card>
                                )}

                                {tokenResult && (
                                    <div className="space-y-4">
                                        {/* Metadata */}
                                        {/* 
                                        <Card className="border-2 border-black rounded-xl">
                                            <CardHeader>
                                                <CardTitle>Token Transfer Results</CardTitle>
                                            </CardHeader>
                                            <CardContent>
                                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                                    <div>
                                                        <p className="text-sm text-muted-foreground">From Block</p>
                                                        <p className="font-bold">#{tokenResult.metadata.from_block}</p>
                                                    </div>
                                                    <div>
                                                        <p className="text-sm text-muted-foreground">To Block</p>
                                                        <p className="font-bold">#{tokenResult.metadata.to_block}</p>
                                                    </div>
                                                    <div>
                                                        <p className="text-sm text-muted-foreground">Total Transfers</p>
                                                        <p className="font-bold">{tokenResult.metadata.total_logs}</p>
                                                    </div>
                                                    <div>
                                                        <p className="text-sm text-muted-foreground">Chunk Size</p>
                                                        <p className="font-bold">{tokenResult.metadata.chunk_size}</p>
                                                    </div>
                                                </div>
                                            </CardContent>
                                        </Card>
                                        */}

                                        {/* Results Table */}
                                        <Card className="border-2 border-black rounded-xl">
                                            <CardHeader>
                                                <CardTitle>ERC-20 Transfers</CardTitle>
                                            </CardHeader>
                                            <CardContent>
                                                <div className="overflow-x-auto">
                                                    <Table>
                                                        <TableHeader>
                                                            <TableRow>
                                                                <TableHead>Type</TableHead>
                                                                <TableHead>From</TableHead>
                                                                <TableHead>To</TableHead>
                                                                <TableHead>Value</TableHead>
                                                                <TableHead>Token</TableHead>
                                                                <TableHead>Tx Hash</TableHead>
                                                                <TableHead>Block</TableHead>
                                                                <TableHead>Actions</TableHead>
                                                            </TableRow>
                                                        </TableHeader>
                                                        <TableBody>
                                                            {(tokenResult?.logs || [])
                                                                .slice(tokenTablePage * itemsPerPage, (tokenTablePage + 1) * itemsPerPage)
                                                                .map((transfer, index) => (
                                                                    <TableRow key={index}>
                                                                        <TableCell>
                                                                            <Badge variant="outline" className="border-[#F86753] text-[#F86753]">
                                                                                {transfer.type}
                                                                            </Badge>
                                                                        </TableCell>
                                                                        <TableCell>
                                                                            <TooltipProvider>
                                                                                <Tooltip>
                                                                                    <TooltipTrigger>
                                                                                        <span className="font-mono text-sm">{truncateHash(transfer.from, 8)}</span>
                                                                                    </TooltipTrigger>
                                                                                    <TooltipContent>
                                                                                        <p>{transfer.from}</p>
                                                                                    </TooltipContent>
                                                                                </Tooltip>
                                                                            </TooltipProvider>
                                                                        </TableCell>
                                                                        <TableCell>
                                                                            <TooltipProvider>
                                                                                <Tooltip>
                                                                                    <TooltipTrigger>
                                                                                        <span className="font-mono text-sm">{truncateHash(transfer.to, 8)}</span>
                                                                                    </TooltipTrigger>
                                                                                    <TooltipContent>
                                                                                        <p>{transfer.to}</p>
                                                                                    </TooltipContent>
                                                                                </Tooltip>
                                                                            </TooltipProvider>
                                                                        </TableCell>
                                                                        <TableCell>
                                                                            <span className="font-bold">{formatWei(transfer.value)}</span>
                                                                        </TableCell>
                                                                        <TableCell>
                                                                            <span className="font-mono text-sm">{truncateHash(transfer.token, 8)}</span>
                                                                        </TableCell>
                                                                        <TableCell>
                                                                            {transfer.transaction_hash && (
                                                                                <span className="font-mono text-sm">
                                                                                    {truncateHash(transfer.transaction_hash, 8)}
                                                                                </span>
                                                                            )}
                                                                        </TableCell>
                                                                        <TableCell>
                                                                            {transfer.block_number && (
                                                                                <span className="font-bold">#{transfer.block_number}</span>
                                                                            )}
                                                                        </TableCell>
                                                                        <TableCell>
                                                                            <div className="flex gap-1">
                                                                                {transfer.transaction_hash && (
                                                                                    <>
                                                                                        <Button
                                                                                            variant="outline"
                                                                                            size="sm"
                                                                                            onClick={() => copyToClipboard(transfer.transaction_hash!, "Transaction hash")}
                                                                                            className="border border-black rounded-lg h-6 px-2"
                                                                                        >
                                                                                            <Copy className="h-3 w-3" />
                                                                                        </Button>
                                                                                        <Link href={`/transactions?txHash=${transfer.transaction_hash}`}>
                                                                                            <Button
                                                                                                variant="outline"
                                                                                                size="sm"
                                                                                                className="border border-black rounded-lg h-6 px-2"
                                                                                                title="View transaction details"
                                                                                            >
                                                                                                <ExternalLink className="h-3 w-3" />
                                                                                            </Button>
                                                                                        </Link>
                                                                                    </>
                                                                                )}
                                                                            </div>
                                                                        </TableCell>
                                                                    </TableRow>
                                                                ))}
                                                        </TableBody>
                                                    </Table>
                                                </div>
                                                {renderPaginationControls(
                                                    tokenTablePage,
                                                    setTokenTablePage,
                                                    tokenResult?.logs?.length || 0,
                                                    "transfers"
                                                )}
                                            </CardContent>
                                        </Card>

                                        <JsonViewer data={tokenResult} title="Raw Token Transfer Data" />
                                    </div>
                                )}
                            </TabsContent>

                            <TabsContent value="balance" className="space-y-6">
                                <Card className="border-2 border-black rounded-xl">
                                    <CardHeader>
                                        <CardTitle className="flex items-center gap-2">
                                            <Coins className="h-5 w-5" />
                                            Token Balance Query
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent className="space-y-4">
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <div className="space-y-2">
                                                <Label htmlFor="balance-token-address">Token Address</Label>
                                                <Input
                                                    id="balance-token-address"
                                                    placeholder="0xA0b86a33E6441b73aE6b5b0e48e95AD1A756b3a5"
                                                    value={balanceTokenAddress}
                                                    onChange={(e) => setBalanceTokenAddress(e.target.value)}
                                                    className="border-2 border-black rounded-lg font-mono"
                                                />
                                                {errors.balanceTokenAddress && (
                                                    <p className="text-sm text-red-600 font-medium">{errors.balanceTokenAddress}</p>
                                                )}
                                            </div>
                                            <div className="space-y-2">
                                                <Label htmlFor="balance-owner-address">Owner Address</Label>
                                                <Input
                                                    id="balance-owner-address"
                                                    placeholder="0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045"
                                                    value={balanceOwnerAddress}
                                                    onChange={(e) => setBalanceOwnerAddress(e.target.value)}
                                                    className="border-2 border-black rounded-lg font-mono"
                                                />
                                                {errors.balanceOwnerAddress && (
                                                    <p className="text-sm text-red-600 font-medium">{errors.balanceOwnerAddress}</p>
                                                )}
                                            </div>
                                        </div>

                                        <div className="space-y-2">
                                            <Label htmlFor="balance-date">Date (YYYY-MM-DD)</Label>
                                            <div className="flex gap-2">
                                                <Input
                                                    id="balance-date"
                                                    type="date"
                                                    value={balanceDate}
                                                    onChange={(e) => setBalanceDate(e.target.value)}
                                                    className="border-2 border-black rounded-lg"
                                                />
                                                <Button
                                                    variant="outline"
                                                    size="icon"
                                                    onClick={setBalanceToday}
                                                    className="border-2 border-black rounded-lg bg-transparent"
                                                >
                                                    <Calendar className="h-4 w-4" />
                                                </Button>
                                            </div>
                                            {errors.balanceDate && <p className="text-sm text-red-600 font-medium">{errors.balanceDate}</p>}
                                        </div>

                                        {/* Advanced Options */}
                                        <Collapsible open={balanceShowAdvanced} onOpenChange={handleBalanceAdvancedToggle}>
                                            <CollapsibleTrigger asChild>
                                                <Button
                                                    variant="outline"
                                                    className="w-full justify-between border-2 border-black rounded-lg bg-transparent"
                                                >
                                                    Advanced Options
                                                    {balanceShowAdvanced ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                                                </Button>
                                            </CollapsibleTrigger>
                                            <CollapsibleContent className="space-y-4 mt-4">
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                    <div className="space-y-2">
                                                        <Label htmlFor="balance-block-range-lo">Block Range Low (optional)</Label>
                                                        <Input
                                                            id="balance-block-range-lo"
                                                            placeholder="18000000"
                                                            value={balanceBlockRangeLo}
                                                            onChange={(e) => setBalanceBlockRangeLo(e.target.value)}
                                                            className="border-2 border-black rounded-lg"
                                                        />
                                                    </div>
                                                    <div className="space-y-2">
                                                        <Label htmlFor="balance-block-range-hi">Block Range High (optional)</Label>
                                                        <Input
                                                            id="balance-block-range-hi"
                                                            placeholder="18100000"
                                                            value={balanceBlockRangeHi}
                                                            onChange={(e) => setBalanceBlockRangeHi(e.target.value)}
                                                            className="border-2 border-black rounded-lg"
                                                        />
                                                    </div>
                                                </div>

                                                {errors.balanceBlockRange && <p className="text-sm text-red-600 font-medium">{errors.balanceBlockRange}</p>}

                                                <div className="space-y-3">
                                                    <Label>On Miss Behavior</Label>
                                                    <RadioGroup value={balanceOnMiss} onValueChange={(value: any) => setBalanceOnMiss(value)}>
                                                        <div className="flex items-center space-x-2">
                                                            <RadioGroupItem value="strict" id="balance-strict" />
                                                            <Label htmlFor="balance-strict" className="text-sm">
                                                                <span className="font-bold">Strict</span> - Return error if exact date not found
                                                            </Label>
                                                        </div>
                                                        <div className="flex items-center space-x-2">
                                                            <RadioGroupItem value="clamp" id="balance-clamp" />
                                                            <Label htmlFor="balance-clamp" className="text-sm">
                                                                <span className="font-bold">Clamp</span> - Use closest available date
                                                            </Label>
                                                        </div>
                                                        <div className="flex items-center space-x-2">
                                                            <RadioGroupItem value="auto_widen" id="balance-auto-widen" />
                                                            <Label htmlFor="balance-auto-widen" className="text-sm">
                                                                <span className="font-bold">Auto Widen</span> - Automatically expand high to latest
                                                            </Label>
                                                        </div>
                                                    </RadioGroup>
                                                </div>
                                            </CollapsibleContent>
                                        </Collapsible>

                                        <div className="flex gap-2">
                                            <Button
                                                onClick={handleBalanceQuery}
                                                disabled={loading}
                                                className="bg-[#F86753] hover:bg-[#fb8c7d] text-white rounded-xl border-2 border-black font-bold shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]"
                                            >
                                                <Play className="h-4 w-4" />
                                                {loading ? "Running..." : "Run Query"}
                                            </Button>
                                        </div>
                                    </CardContent>
                                </Card>

                                {loading && activeTab === "balance" && (
                                    <Card className="border-2 border-black rounded-xl">
                                        <CardContent className="p-6">
                                            <div className="space-y-4">
                                                <Skeleton className="h-4 w-3/4" />
                                                <Skeleton className="h-4 w-1/2" />
                                                <Skeleton className="h-32 w-full" />
                                            </div>
                                        </CardContent>
                                    </Card>
                                )}

                                {balanceApiError && (
                                    <Card className="border-2 border-red-500 rounded-xl bg-red-50">
                                        <CardHeader>
                                            <CardTitle className="flex items-center gap-2 text-red-700">
                                                <FileText className="h-5 w-5" />
                                                Token Balance Not Found
                                            </CardTitle>
                                        </CardHeader>
                                        <CardContent className="space-y-4">
                                            {balanceApiError.status === 404 && balanceOnMiss === "strict" ? (
                                                <div className="space-y-3">
                                                    <p className="text-red-700 font-medium">
                                                        No balance data found for {balanceOwnerAddress ? truncateHash(balanceOwnerAddress) : 'address'} on {balanceDate || 'specified date'} (Strict mode)
                                                    </p>
                                                    <p className="text-sm text-red-600">
                                                        The exact date you requested doesn't have balance data in our index.
                                                    </p>
                                                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                                                        <p className="text-sm text-yellow-800 font-medium mb-2">Try these alternatives:</p>
                                                        <ul className="text-sm text-yellow-700 space-y-1">
                                                            <li>• Switch to <strong>"Clamp"</strong> mode to get the closest available date</li>
                                                            <li>• Switch to <strong>"Auto Widen"</strong> mode to expand the high range to latest</li>
                                                            <li>• Try a different date that might have more transaction activity</li>
                                                        </ul>
                                                    </div>
                                                    <div className="flex gap-2 pt-2">
                                                        <Button
                                                            variant="outline"
                                                            size="sm"
                                                            onClick={() => setBalanceOnMiss("clamp")}
                                                            className="border-yellow-500 text-yellow-700 hover:bg-yellow-50"
                                                        >
                                                            Switch to Clamp Mode
                                                        </Button>
                                                        <Button
                                                            variant="outline"
                                                            size="sm"
                                                            onClick={() => setBalanceOnMiss("auto_widen")}
                                                            className="border-yellow-500 text-yellow-700 hover:bg-yellow-50"
                                                        >
                                                            Switch to Auto Widen
                                                        </Button>
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="space-y-2">
                                                    <p className="text-red-700 font-medium">
                                                        Error {balanceApiError.status}: Unable to fetch token balance data
                                                    </p>
                                                    <p className="text-sm text-red-600">
                                                        {balanceApiError.message}
                                                    </p>
                                                </div>
                                            )}
                                        </CardContent>
                                    </Card>
                                )}

                                {balanceResult && (
                                    <div className="space-y-4">
                                        <Card className="border-2 border-black rounded-xl">
                                            <CardHeader>
                                                <div className="flex items-center justify-between">
                                                    <CardTitle>Token Balance Result</CardTitle>
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={() => copyToClipboard(balanceResult?.owner_address || balanceResult?.address || balanceOwnerAddress, "Owner address")}
                                                        className="border border-black rounded-lg"
                                                        disabled={!balanceResult?.owner_address && !balanceResult?.address && !balanceOwnerAddress}
                                                    >
                                                        <Copy className="h-4 w-4" />
                                                    </Button>
                                                </div>
                                            </CardHeader>
                                            <CardContent className="space-y-4">
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                                    <div className="space-y-4">
                                                        <div>
                                                            <p className="text-sm text-muted-foreground">Token Address</p>
                                                            <p className="font-mono text-sm">{balanceTokenAddress ? truncateHash(balanceTokenAddress, 16) : 'N/A'}</p>
                                                        </div>
                                                        <div>
                                                            <p className="text-sm text-muted-foreground">Owner Address</p>
                                                            <p className="font-mono text-sm">{balanceResult?.owner_address ? truncateHash(balanceResult.owner_address, 16) : balanceResult?.address ? truncateHash(balanceResult.address, 16) : 'N/A'}</p>
                                                        </div>
                                                        <div>
                                                            <p className="text-sm text-muted-foreground">Query Date</p>
                                                            <p className="font-bold">{balanceResult?.date || 'N/A'}</p>
                                                        </div>
                                                        <div>
                                                            <p className="text-sm text-muted-foreground">Timestamp</p>
                                                            <p className="font-mono text-sm">{balanceResult?.timestamp ? formatTimestamp(balanceResult.timestamp) : 'N/A'}</p>
                                                        </div>
                                                    </div>

                                                    <div className="space-y-4">
                                                        <div>
                                                            <p className="text-sm text-muted-foreground">Token Balance</p>
                                                            <p className="text-2xl font-black text-green-600">{balanceResult?.balance ? formatWei(balanceResult.balance) : '0'}</p>
                                                        </div>
                                                        <div>
                                                            <p className="text-sm text-muted-foreground">Balance (Raw Units)</p>
                                                            <p className="font-mono text-sm break-all">{balanceResult?.balance || '0'}</p>
                                                        </div>
                                                        {balanceResult?.block_number && (
                                                            <div>
                                                                <p className="text-sm text-muted-foreground">Block Number</p>
                                                                <p className="font-bold">#{balanceResult.block_number}</p>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>

                                                {balanceResult?.block_timestamp && (
                                                    <div className="pt-4 border-t border-black/20">
                                                        <div className="flex items-center gap-2">
                                                            <Badge variant="outline" className="border-black">
                                                                Block Timestamp: {formatTimestamp(balanceResult.block_timestamp)}
                                                            </Badge>
                                                        </div>
                                                    </div>
                                                )}
                                            </CardContent>
                                        </Card>

                                        <JsonViewer data={balanceResult} title="Raw Token Balance Data" />
                                    </div>
                                )}
                            </TabsContent>
                        </Tabs>

                        {debugInfo.url && (
                            <div className="mt-6">
                                <DebugDrawer url={debugInfo.url} params={debugInfo.params} responseSize={debugInfo.responseSize} />
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}
