"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import {
    Menu,
    ArrowRightToLine,
    BarChart3,
    Database,
    ScanQrCode,
    DollarSign,
    Coins,
    FileText,
    Play,
    Copy,
    ExternalLink,
    ChevronLeft,
    ChevronRight,
} from "lucide-react"
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import MobileNavigation from "@/components/mobile-navigation"
import {
    EthereumIndexerClient,
    type TraceResult,
    isValidAddress,
    normalizeAddress,
    isValidBlockNumber,
    truncateHash,
    formatHexWei,
} from "@/lib/ethereum-client"
import { useToast } from "@/hooks/use-toast"
import { API_BASE_URL, TRACE_CHUNK_SIZE } from "@/lib/config"

const TRACE_CHUNK_STORAGE_KEY = "trace-chunk-size"

export default function TracePage() {
    const [address, setAddress] = useState("")
    const [startblock, setStartBlock] = useState("")
    // Pagination over block ranges (configurable)
    const [chunkSize, setChunkSize] = useState<number>(TRACE_CHUNK_SIZE)
    const [currentPage, setCurrentPage] = useState(0)
    const [loading, setLoading] = useState(false)
    const [result, setResult] = useState<TraceResult[] | null>(null)
    const [error, setError] = useState<string | null>(null)
    const [expandedTraces, setExpandedTraces] = useState<Set<number>>(new Set())
    const [debugInfo, setDebugInfo] = useState<{ url?: string; params?: any; responseSize?: number }>({})
    const [errors, setErrors] = useState<{ address?: string; startblock?: string }>({})

    // Table pagination state
    const [itemsPerPage, setItemsPerPage] = useState(25)
    const [tablePage, setTablePage] = useState(0)

    const { toast } = useToast()
    const client = new EthereumIndexerClient(API_BASE_URL)

    // Prefill from query string for reruns
    // /trace?address=0xabc...&startblock=18000000
    useEffect(() => {
        if (typeof window === "undefined") return
        const params = new URLSearchParams(window.location.search)
        const a = params.get("address")
        const sb = params.get("startblock")
        if (a) setAddress(a)
        if (sb) setStartBlock(sb)
    }, [])

    useEffect(() => {
        if (typeof window === "undefined") return

        const stored = window.localStorage.getItem(TRACE_CHUNK_STORAGE_KEY)
        if (stored) {
            const value = Number.parseInt(stored, 10)
            if (!Number.isNaN(value) && value > 0) {
                setChunkSize(value)
            }
        }

        const handleStorage = (event: StorageEvent) => {
            if (event.key !== TRACE_CHUNK_STORAGE_KEY) return

            if (event.newValue) {
                const value = Number.parseInt(event.newValue, 10)
                if (!Number.isNaN(value) && value > 0) {
                    setChunkSize(value)
                    setCurrentPage(0)
                }
            } else {
                setChunkSize(TRACE_CHUNK_SIZE)
                setCurrentPage(0)
            }
        }

        const handleCustom = (event: Event) => {
            const customEvent = event as CustomEvent<number>
            const value = customEvent.detail
            if (typeof value === "number" && value > 0) {
                setChunkSize(value)
                setCurrentPage(0)
            }
        }

        window.addEventListener("storage", handleStorage)
        window.addEventListener("trace-chunk-size-updated", handleCustom as EventListener)

        return () => {
            window.removeEventListener("storage", handleStorage)
            window.removeEventListener("trace-chunk-size-updated", handleCustom as EventListener)
        }
    }, [])

    const validateInputs = () => {
        const newErrors: any = {}

        if (!address) {
            newErrors.address = "Address is required"
        } else if (!isValidAddress(address)) {
            newErrors.address = "Invalid Ethereum address format"
        }

        if (!startblock) {
            newErrors.startblock = "Start block is required"
        } else {
            const start = Number.parseInt(startblock)
            if (isNaN(start) || !isValidBlockNumber(start)) {
                newErrors.startblock = "Invalid start block number"
            }
        }

        return newErrors
    }

    const handleTraceQuery = async (pageIndex = currentPage) => {
        const validationErrors = validateInputs()
        if (Object.keys(validationErrors).length > 0) {
            setErrors(validationErrors)
            return
        }

        setErrors({})
        setLoading(true)
        setResult(null)
        setError(null)

        try {
            const baseStart = Number.parseInt(startblock)
            const effectiveChunk = Math.max(chunkSize, 1)
            const rangeStart = baseStart + pageIndex * effectiveChunk
            const rangeEnd = rangeStart + effectiveChunk
            const params: any = { startblock: rangeStart, endblock: rangeEnd }

            const normalizedAddress = address ? normalizeAddress(address) : undefined
            const traceResult = await client.getTraceFilter(normalizedAddress, params)
            setResult(traceResult)
            setCurrentPage(pageIndex)

            const url = normalizedAddress
                ? `${API_BASE_URL}/api/trace/filter/${normalizedAddress}`
                : `${API_BASE_URL}/api/trace/filter`

            setDebugInfo({
                url,
                params,
                responseSize: JSON.stringify(traceResult).length,
            })

            toast({
                title: "Trace filter executed successfully",
                description: `Retrieved ${traceResult.length} trace results`,
            })

            // Store in recent queries
            const query = {
                id: Date.now().toString(),
                type: "Trace Filter",
                query: `${normalizedAddress ? truncateHash(normalizedAddress) : "All addresses"} (${traceResult.length} traces)`,
                timestamp: new Date(),
                status: "success" as const,
                href: `/trace?${normalizedAddress ? `address=${encodeURIComponent(normalizedAddress)}&` : ""}startblock=${encodeURIComponent(
                    String(baseStart)
                )}`,
            }
            const stored = localStorage.getItem("ethereum-indexer-queries") || "[]"
            const queries = JSON.parse(stored)
            queries.unshift(query)
            localStorage.setItem("ethereum-indexer-queries", JSON.stringify(queries.slice(0, 10)))
        } catch (error: any) {
            const errorMessage = error.message || "Failed to fetch trace data"
            setError(errorMessage)
            toast({
                title: "Error executing trace filter",
                description: errorMessage,
                variant: "destructive",
            })
        } finally {
            setLoading(false)
        }
    }

    const toggleTraceExpansion = (index: number) => {
        const newExpanded = new Set(expandedTraces)
        if (newExpanded.has(index)) {
            newExpanded.delete(index)
        } else {
            newExpanded.add(index)
        }
        setExpandedTraces(newExpanded)
    }

    const copyToClipboard = (text: string, label: string) => {
        navigator.clipboard.writeText(text)
        toast({
            title: "Copied to clipboard",
            description: `${label} has been copied to your clipboard.`,
        })
    }

    const copyTracePath = (tracePath: number[]) => {
        const pathString = tracePath.join(".")
        copyToClipboard(pathString, "Trace path")
    }

    const handleItemsPerPageChange = (value: string) => {
        setItemsPerPage(Number(value))
        setTablePage(0)
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

    // Removed Try Example for cleaner UI

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
                        <div className="flex items-center gap-x-5">
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
                            <Button
                                asChild
                                className="bg-black hover:bg-black/80 text-white rounded-xl border-2 border-black font-bold shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]"
                            >
                                <Link href="https://github.com/navahas/ethereum-indexer/blob/master/README.md" target="_blank">
                                    API Docs
                                </Link>
                            </Button>
                            <Button
                                asChild
                                variant="outline"
                                className="rounded-xl border-2 border-black font-bold shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] bg-transparent"
                            >
                                <Link href="/">Settings</Link>
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
                                className="flex items-center gap-2 text-lg font-bold p-3 bg-black text-white rounded-xl"
                            >
                                <ArrowRightToLine className="h-5 w-5" />
                                Trace
                            </Link>
                            <Link
                                href="/transactions"
                                className="flex items-center gap-2 text-lg font-bold p-3 hover:bg-black/10 rounded-xl"
                            >
                                <ScanQrCode className="h-5 w-5" />
                                Transactions
                            </Link>
                            <Link
                                href="/balances"
                                className="flex items-center gap-2 text-lg font-bold p-3 hover:bg-black/10 rounded-xl"
                            >
                                <DollarSign className="h-5 w-5" />
                                Balances
                            </Link>
                            <Link
                                href="/erc20"
                                className="flex items-center gap-2 text-lg font-bold p-3 hover:bg-black/10 rounded-xl"
                            >
                                <Coins className="h-5 w-5" />
                                ERC-20
                            </Link>
                        </nav>
                    </div>

                    {/* Main content */}
                    <div className="overflow-auto bg-[#F1F1F1] p-4 sm:p-6">
                        <div className="mb-6">
                            <h2 className="text-2xl font-black mb-2">TRACE FILTER</h2>
                            <p className="text-muted-foreground">Filter and analyze Ethereum transaction traces</p>
                        </div>

                        <div className="max-w-4xl space-y-6">
                            <Card className="border-2 border-black rounded-xl">
                                <CardHeader>
                                    <CardTitle className="flex items-center gap-2">
                                        <ArrowRightToLine className="h-5 w-5" />
                                        Trace Filter Query
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <Label htmlFor="address">Address</Label>
                                            <Input
                                                id="address"
                                                placeholder="0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045"
                                                value={address}
                                                onChange={(e) => setAddress(e.target.value)}
                                                className="border-2 border-black rounded-lg font-mono"
                                            />
                                            {errors.address && <p className="text-sm text-red-600 font-medium">{errors.address}</p>}
                                        </div>

                                        <div className="space-y-2">
                                            <Label htmlFor="start-block">Start Block</Label>
                                            <Input
                                                id="start-block"
                                                placeholder="18000000"
                                                value={startblock}
                                                onChange={(e) => setStartBlock(e.target.value)}
                                                className="border-2 border-black rounded-lg font-mono"
                                            />
                                            {errors.startblock && (
                                                <p className="text-sm text-red-600 font-medium">{errors.startblock}</p>
                                            )}
                                        </div>

                                    </div>

                                    {/* Block range controls and total count */}
                                    <div className="flex items-center justify-between gap-2">
                                        <div className="flex items-center gap-2">
                                            <Button
                                                variant="outline"
                                                size="icon"
                                                onClick={() => currentPage > 0 && handleTraceQuery(currentPage - 1)}
                                                disabled={currentPage === 0 || loading || !startblock || !address}
                                                className="border-2 border-black rounded-lg bg-white"
                                                title="Previous range"
                                            >
                                                <ChevronLeft className="h-4 w-4" />
                                            </Button>
                                            <div className="px-3 py-2 text-center font-bold border-2 border-black rounded-lg bg-white/60 min-w-[260px]">
                                                {(() => {
                                                    const sb = Number.parseInt(startblock || "0")
                                                    if (isNaN(sb)) return "-"
                                                    const chunk = Math.max(chunkSize, 1)
                                                    const rs = sb + currentPage * chunk
                                                    const re = rs + chunk
                                                    return `#${rs.toLocaleString()} - #${re.toLocaleString()}`
                                                })()}
                                            </div>
                                            <Button
                                                variant="outline"
                                                size="icon"
                                                onClick={() => handleTraceQuery(currentPage + 1)}
                                                disabled={loading || !startblock || !address}
                                                className="border-2 border-black rounded-lg bg-white"
                                                title="Next range"
                                            >
                                                <ChevronRight className="h-4 w-4" />
                                            </Button>
                                            {currentPage > 0 && result && (
                                                <Button
                                                    variant="outline"
                                                    onClick={() => handleTraceQuery(0)}
                                                    disabled={loading}
                                                    className="border-2 border-black rounded-lg bg-white font-bold ml-2"
                                                    title="Return to initial block range"
                                                >
                                                    Return to Initial Range
                                                </Button>
                                            )}
                                        </div>
                                        <div className="text-sm font-bold text-right space-y-1">
                                            <div>Chunk Size: {Math.max(chunkSize, 1).toLocaleString()} blocks</div>
                                            {result && <div>Traces Returned: {result.length.toLocaleString()}</div>}
                                        </div>
                                    </div>

                                    {/* Run button (separate row) */}
                                    <div>
                                        <Button
                                            onClick={() => handleTraceQuery(0)}
                                            //disabled={loading || !address || !startblock}
                                            className="mt-2 bg-[#F86753] hover:bg-[#fb8c7d] text-white font-weight-bold rounded-xl border-2 border-black font-bold shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]"
                                        >
                                            <Play className="h-4 w-4" />
                                            {loading ? "Running..." : "Run Query"}
                                        </Button>
                                    </div>
                                </CardContent>
                            </Card>

                            {loading && (
                                <Card className="border-2 border-black rounded-xl">
                                    <CardHeader>
                                        <CardTitle className="flex items-center gap-2">
                                            <ArrowRightToLine className="h-5 w-5" />
                                            Loading Trace Results...
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent className="p-0">
                                        <div className="p-6 space-y-4">
                                            <div className="flex items-center justify-between">
                                                <Skeleton className="h-4 w-32" />
                                                <Skeleton className="h-4 w-24" />
                                            </div>
                                            <div className="space-y-3">
                                                {Array.from({ length: 5 }).map((_, idx) => (
                                                    <div key={idx} className="flex items-center justify-between p-3 border border-gray-200 rounded-lg">
                                                        <div className="flex items-center gap-4 flex-1">
                                                            <Skeleton className="h-4 w-32" />
                                                            <Skeleton className="h-4 w-16" />
                                                            <Skeleton className="h-4 w-24" />
                                                            <Skeleton className="h-4 w-24" />
                                                            <Skeleton className="h-4 w-20" />
                                                        </div>
                                                        <Skeleton className="h-8 w-8 rounded-lg" />
                                                    </div>
                                                ))}
                                            </div>
                                            <div className="flex items-center justify-between pt-4 border-t border-gray-200">
                                                <Skeleton className="h-4 w-48" />
                                                <div className="flex gap-2">
                                                    <Skeleton className="h-8 w-16" />
                                                    <Skeleton className="h-8 w-16" />
                                                    <Skeleton className="h-8 w-16" />
                                                </div>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            )}

                            {error && (
                                <Card className="border-2 border-red-500 rounded-xl bg-red-50">
                                    <CardHeader>
                                        <CardTitle className="flex items-center gap-2 text-red-700">
                                            <ArrowRightToLine className="h-5 w-5" />
                                            Error Executing Trace Filter
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="space-y-4">
                                            <div className="p-4 bg-red-100 border border-red-300 rounded-lg">
                                                <p className="font-medium text-red-800 mb-2">Request Failed</p>
                                                <p className="text-red-700">{error}</p>
                                            </div>

                                            <div className="space-y-2">
                                                <p className="font-medium text-red-800">Possible causes:</p>
                                                <ul className="list-disc list-inside text-red-700 space-y-1 text-sm">
                                                    <li>Invalid address format or block number</li>
                                                    <li>RPC endpoint temporarily unavailable</li>
                                                    <li>Network connectivity issues</li>
                                                    <li>Server processing error or timeout</li>
                                                    <li>Block range too large or contains malformed data</li>
                                                </ul>
                                            </div>

                                            <div className="flex gap-2">
                                                <Button
                                                    onClick={() => setError(null)}
                                                    variant="outline"
                                                    className="border-2 border-red-500 text-red-700 hover:bg-red-100 rounded-lg"
                                                >
                                                    Dismiss
                                                </Button>
                                                <Button
                                                    onClick={() => handleTraceQuery(currentPage)}
                                                    disabled={loading}
                                                    className="bg-red-600 hover:bg-red-700 text-white border-2 border-red-700 rounded-lg"
                                                >
                                                    Retry Query
                                                </Button>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            )}

                            {result && (
                                <Card className="border-2 border-black rounded-xl">
                                    <CardHeader>
                                        <CardTitle className="flex items-center gap-2">
                                            <ArrowRightToLine className="h-5 w-5" />
                                            Trace Results
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent className="p-0">
                                        <Table>
                                            <TableHeader>
                                                <TableRow>
                                                    <TableHead>Transaction Hash</TableHead>
                                                    <TableHead>Block</TableHead>
                                                    <TableHead>From</TableHead>
                                                    <TableHead>To</TableHead>
                                                    <TableHead>Value</TableHead>
                                                    <TableHead className="text-right">Actions</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {result
                                                    .slice(tablePage * itemsPerPage, (tablePage + 1) * itemsPerPage)
                                                    .map((item, idx) => {
                                                        const action = (item.action ?? (item as any)?.trace?.action) as
                                                            | { from?: string; to?: string; value?: string | number }
                                                            | undefined
                                                        const from = action?.from
                                                        const to = action?.to
                                                        const value = action?.value
                                                        const txHash = (item as any).transactionHash ?? (item as any).transaction_hash
                                                        const blockNum = (item as any).blockNumber ?? (item as any).block_number
                                                        return (
                                                            <TableRow key={`${txHash || idx}-${idx}`}>
                                                                <TableCell className="font-mono text-xs">
                                                                    {txHash ? (
                                                                        <div className="flex items-center gap-2">
                                                                            <span>{truncateHash(txHash, 16)}</span>
                                                                            <Button
                                                                                variant="outline"
                                                                                size="icon"
                                                                                onClick={() => txHash && copyToClipboard(txHash, "Transaction hash")}
                                                                                className="border border-black rounded-lg h-6 w-6"
                                                                            >
                                                                                <Copy className="h-3 w-3" />
                                                                            </Button>
                                                                        </div>
                                                                    ) : (
                                                                        "-"
                                                                    )}
                                                                </TableCell>
                                                                <TableCell className="font-bold">{blockNum ?? "-"}</TableCell>
                                                                <TableCell className="font-mono text-xs">
                                                                    {from ? truncateHash(from, 12) : "-"}
                                                                </TableCell>
                                                                <TableCell className="font-mono text-xs">{to ? truncateHash(to, 12) : "-"}</TableCell>
                                                                <TableCell className="font-mono text-xs break-all">
                                                                    {typeof value === "string" && value.startsWith("0x") ? `${formatHexWei(value)} ETH` : value ?? "-"}
                                                                </TableCell>
                                                                <TableCell className="text-right">
                                                                    {txHash && (
                                                                        <Link href={`/transactions?txHash=${txHash}`}>
                                                                            <Button
                                                                                variant="outline"
                                                                                size="icon"
                                                                                className="border-2 border-black rounded-lg h-8 w-8 bg-white"
                                                                                title="View transaction details"
                                                                            >
                                                                                <ExternalLink className="h-4 w-4" />
                                                                            </Button>
                                                                        </Link>
                                                                    )}
                                                                </TableCell>
                                                            </TableRow>
                                                        )
                                                    })}
                                            </TableBody>
                                        </Table>
                                        {renderPaginationControls(
                                            tablePage,
                                            setTablePage,
                                            result.length,
                                            "trace results"
                                        )}
                                    </CardContent>
                                </Card>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
