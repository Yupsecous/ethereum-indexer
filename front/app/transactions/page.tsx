"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import {
    Menu,
    Search,
    BarChart3,
    Database,
    Coins,
    FileText,
    GitBranch,
    Play,
    ExternalLink,
    Copy,
} from "lucide-react"
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet"
import MobileNavigation from "@/components/mobile-navigation"
import JsonViewer from "@/components/json-viewer"
import DebugDrawer from "@/components/debug-drawer"
import {
    EthereumIndexerClient,
    type TransactionResponse,
    type TransactionReceipt,
    isValidHash,
    truncateHash,
    formatWei,
    hexToValue,
    hexToValueBlock,
    formatHexGwei,
} from "@/lib/ethereum-client"
import { API_BASE_URL } from "@/lib/config"
import { useToast } from "@/hooks/use-toast"

export default function TransactionsPage() {
    const [txHash, setTxHash] = useState("")
    const [receiptHash, setReceiptHash] = useState("")
    const [loading, setLoading] = useState<{ tx: boolean; receipt: boolean }>({ tx: false, receipt: false })
    const [txResult, setTxResult] = useState<TransactionResponse | null>(null)
    const [receiptResult, setReceiptResult] = useState<TransactionReceipt | null>(null)
    const [debugInfo, setDebugInfo] = useState<{ url?: string; params?: any; responseSize?: number }>({})
    const [errors, setErrors] = useState<{ tx?: string; receipt?: string }>({})
    // mock mode removed; always fetch real data

    const { toast } = useToast()
    const client = new EthereumIndexerClient(API_BASE_URL)

    // Prefill from query string: ?txHash=0x... or ?receiptHash=0x...
    useEffect(() => {
        if (typeof window === "undefined") return
        const params = new URLSearchParams(window.location.search)
        const q = params.get("txHash")
        if (q) setTxHash(q)
        const r = params.get("receiptHash")
        if (r) setReceiptHash(r)
    }, [])

    const validateHash = (hash: string): string | null => {
        if (!hash) return "Transaction hash is required"
        if (!isValidHash(hash)) return "Invalid transaction hash format (must be 0x + 64 hex characters)"
        return null
    }

    const copyToClipboard = (text: string, label: string) => {
        navigator.clipboard.writeText(text)
        toast({
            title: "Copied to clipboard",
            description: `${label} has been copied to your clipboard.`,
        })
    }

    const openInEtherscan = (hash: string) => {
        window.open(`https://etherscan.io/tx/${hash}`, "_blank")
    }

    const handleTransactionQuery = async () => {
        const error = validateHash(txHash)
        if (error) {
            setErrors({ ...errors, tx: error })
            return
        }

        setErrors({ ...errors, tx: undefined })
        setLoading({ ...loading, tx: true })
        setTxResult(null)

        try {
            const url = `${API_BASE_URL}/api/eth/getTransactionByHash/${txHash}`
            const result: TransactionResponse = await client.getTransactionByHash(txHash)

            setDebugInfo({
                url,
                params: {},
                responseSize: JSON.stringify(result).length,
            })

            toast({
                title: "Transaction fetched successfully",
                description: `Retrieved transaction ${truncateHash(txHash)}`,
            })

            setTxResult(result)

            const query = {
                id: Date.now().toString(),
                type: "Transaction",
                query: `Tx ${truncateHash(txHash)}`,
                timestamp: new Date(),
                status: "success" as const,
                href: `/transactions?txHash=${txHash}`,
            }
            const stored = localStorage.getItem("ethereum-indexer-queries") || "[]"
            const queries = JSON.parse(stored)
            queries.unshift(query)
            localStorage.setItem("ethereum-indexer-queries", JSON.stringify(queries.slice(0, 10)))
        } catch (error: any) {
            toast({
                title: "Error fetching transaction",
                description: error.message || "Failed to fetch transaction data",
                variant: "destructive",
            })
        } finally {
            setLoading({ ...loading, tx: false })
        }
    }

    const handleReceiptQuery = async () => {
        const error = validateHash(receiptHash)
        if (error) {
            setErrors({ ...errors, receipt: error })
            return
        }

        setErrors({ ...errors, receipt: undefined })
        setLoading({ ...loading, receipt: true })
        setReceiptResult(null)

        try {
            const url = `${API_BASE_URL}/api/eth/getTransactionReceipt/${receiptHash}`
            const result: TransactionReceipt = await client.getTransactionReceipt(receiptHash)

            setDebugInfo({
                url,
                params: {},
                responseSize: JSON.stringify(result).length,
            })

            toast({
                title: "Receipt fetched successfully",
                description: `Retrieved receipt for ${truncateHash(receiptHash)}`,
            })

            setReceiptResult(result)

            const query = {
                id: Date.now().toString(),
                type: "Receipt",
                query: `Receipt ${truncateHash(receiptHash)}`,
                timestamp: new Date(),
                status: "success" as const,
                href: `/transactions?receiptHash=${receiptHash}`,
            }
            const stored = localStorage.getItem("ethereum-indexer-queries") || "[]"
            const queries = JSON.parse(stored)
            queries.unshift(query)
            localStorage.setItem("ethereum-indexer-queries", JSON.stringify(queries.slice(0, 10)))
        } catch (error: any) {
            toast({
                title: "Error fetching receipt",
                description: error.message || "Failed to fetch receipt data",
                variant: "destructive",
            })
        } finally {
            setLoading({ ...loading, receipt: false })
        }
    }

    // Try Example removed; always real data

    const syncHashes = (hash: string) => {
        setTxHash(hash)
        setReceiptHash(hash)
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


            {/* Glassmorphic container */}
            <div className="w-full max-w-7xl mx-auto  bg-white border-4 border-black rounded-3xl shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] overflow-hidden">
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
                                className="flex items-center gap-2 text-lg font-bold p-3 bg-black text-white rounded-xl"
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
                                className="flex items-center gap-2 text-lg font-bold p-3 hover:bg-black/10 rounded-xl"
                            >
                                <Coins className="h-5 w-5" />
                                ERC-20
                            </Link>
                        </nav>
                    </div>

                    <div className="overflow-auto bg-[#F1F1F1] p-4 sm:p-6">
                        <div className="mb-6">
                            <h2 className="text-2xl font-black mb-2">TRANSACTIONS VIEWER</h2>
                            <p className="text-muted-foreground">Look up transaction details and receipts by transaction hash</p>
                            {/* Mock Data alert removed */}
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            <div className="space-y-6">
                                <Card className="border-2 border-black rounded-xl">
                                    <CardHeader>
                                        <CardTitle className="flex items-center gap-2">
                                            <Search className="h-5 w-5" />
                                            Transaction by Hash
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent className="space-y-4">
                                        <div className="space-y-2">
                                            <Label htmlFor="tx-hash">Transaction Hash</Label>
                                            <Input
                                                id="tx-hash"
                                                placeholder="0x1234567890abcdef..."
                                                value={txHash}
                                                onChange={(e) => setTxHash(e.target.value)}
                                                className="border-2 border-black rounded-lg font-mono"
                                            />
                                            {errors.tx && <p className="text-sm text-red-600 font-medium">{errors.tx}</p>}
                                        </div>

                                        <div className="flex gap-2">
                                            <Button
                                                onClick={handleTransactionQuery}
                                                disabled={loading.tx}
                                                className="bg-[#F86753] hover:bg-[#fb8c7d] text-white rounded-xl border-2 border-black font-bold shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]"
                                            >
                                                <Play className="h-4 w-4" />
                                                {loading.tx ? "Running..." : "Run Query"}
                                            </Button>
                                            {/* Try Example removed */}
                                            {txHash && (
                                                <Button
                                                    variant="outline"
                                                    onClick={() => syncHashes(txHash)}
                                                    className="rounded-xl border-2 border-black font-bold bg-transparent"
                                                >
                                                    Sync Hash
                                                </Button>
                                            )}
                                        </div>
                                    </CardContent>
                                </Card>

                                {loading.tx && (
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

                                {txResult && (
                                    <div className="space-y-4">
                                        <Card className="border-2 border-black rounded-xl">
                                            <CardHeader>
                                                <div className="flex items-center justify-between">
                                                    <CardTitle>Transaction Details</CardTitle>
                                                    <div className="flex gap-2">
                                                        <Button
                                                            variant="outline"
                                                            size="sm"
                                                            onClick={() => openInEtherscan(txResult.hash)}
                                                            className="border border-black rounded-lg"
                                                        >
                                                            <ExternalLink className="h-4 w-4" />
                                                        </Button>
                                                    </div>
                                                </div>
                                            </CardHeader>
                                            <CardContent className="space-y-4">
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                    <div>
                                                        <p className="text-sm text-muted-foreground">Hash</p>
                                                        <p className="font-mono text-sm">{truncateHash(txResult.hash, 16)}</p>
                                                    </div>
                                                    <div>
                                                        <p className="text-sm text-muted-foreground">Block</p>
                                                        <p className="font-bold">
                                                            {txResult.blockNumber ? `#${hexToValueBlock(txResult.blockNumber)}` : "Pending"}
                                                        </p>
                                                    </div>
                                                    <div>
                                                        <p className="text-sm text-muted-foreground">From</p>
                                                        <p className="font-mono text-sm">{truncateHash(txResult.from, 12)}</p>
                                                    </div>
                                                    <div>
                                                        <p className="text-sm text-muted-foreground">To</p>
                                                        <p className="font-mono text-sm">
                                                            {txResult.to ? truncateHash(txResult.to, 12) : "Contract Creation"}
                                                        </p>
                                                    </div>
                                                    <div>
                                                        <p className="text-sm text-muted-foreground">Value</p>
                                                        <p className="font-bold">{formatWei(txResult.value)} ETH</p>
                                                    </div>
                                                    <div>
                                                        <p className="text-sm text-muted-foreground">Gas Used</p>
                                                        <p className="font-bold">{Number.parseInt(txResult.gas).toLocaleString()}</p>
                                                    </div>
                                                </div>

                                                {txResult.transaction_type !== undefined && (
                                                    <div className="flex gap-2">
                                                        <Badge variant="outline" className="border-black">
                                                            Type {txResult.transaction_type}
                                                        </Badge>
                                                        {txResult.transaction_type === 2 && (
                                                            <Badge variant="outline" className="border-black">
                                                                EIP-1559
                                                            </Badge>
                                                        )}
                                                    </div>
                                                )}
                                            </CardContent>
                                        </Card>

                                        <JsonViewer data={txResult} title="Raw Transaction Data" />
                                    </div>
                                )}
                            </div>

                            <div className="space-y-6">
                                <Card className="border-2 border-black rounded-xl">
                                    <CardHeader>
                                        <CardTitle className="flex items-center gap-2">
                                            <FileText className="h-5 w-5" />
                                            Transaction Receipt
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent className="space-y-4">
                                        <div className="space-y-2">
                                            <Label htmlFor="receipt-hash">Transaction Hash</Label>
                                            <Input
                                                id="receipt-hash"
                                                placeholder="0x1234567890abcdef..."
                                                value={receiptHash}
                                                onChange={(e) => setReceiptHash(e.target.value)}
                                                className="border-2 border-black rounded-lg font-mono"
                                            />
                                            {errors.receipt && <p className="text-sm text-red-600 font-medium">{errors.receipt}</p>}
                                        </div>

                                        <div className="flex gap-2">
                                            <Button
                                                onClick={handleReceiptQuery}
                                                disabled={loading.receipt}
                                                className="bg-[#F86753] hover:bg-[#fb8c7d] text-white rounded-xl border-2 border-black font-bold shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]"
                                            >
                                                <Play className="h-4 w-4" />
                                                {loading.receipt ? "Running..." : "Run Query"}
                                            </Button>
                                            {/* Try Example removed */}
                                            {receiptHash && (
                                                <Button
                                                    variant="outline"
                                                    onClick={() => syncHashes(receiptHash)}
                                                    className="rounded-xl border-2 border-black font-bold bg-transparent"
                                                >
                                                    Sync Hash
                                                </Button>
                                            )}
                                        </div>
                                    </CardContent>
                                </Card>

                                {loading.receipt && (
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

                                {receiptResult && (
                                    <div className="space-y-4">
                                        <Card className="border-2 border-black rounded-xl">
                                            <CardHeader>
                                                <div className="flex items-center justify-between">
                                                    <CardTitle>Receipt Details</CardTitle>
                                                </div>
                                            </CardHeader>
                                            <CardContent className="space-y-4">
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                    <div>
                                                        <p className="text-sm text-muted-foreground">Status</p>
                                                        <div className="flex items-center gap-2">
                                                            <Badge
                                                                variant={(() => {
                                                                    const s: any = (receiptResult as any).status
                                                                    const ok = typeof s === "string" ? s === "0x1" || s === "1" : s === 1
                                                                    return ok ? "default" : "destructive"
                                                                })()}
                                                                className={(() => {
                                                                    const s: any = (receiptResult as any).status
                                                                    const ok = typeof s === "string" ? s === "0x1" || s === "1" : s === 1
                                                                    return ok ? "bg-green-600" : ""
                                                                })()}
                                                            >
                                                                {(() => {
                                                                    const s: any = (receiptResult as any).status
                                                                    const ok = typeof s === "string" ? s === "0x1" || s === "1" : s === 1
                                                                    return ok ? "Success" : "Failed"
                                                                })()}
                                                            </Badge>
                                                        </div>
                                                    </div>
                                                    <div>
                                                        <p className="text-sm text-muted-foreground">Block</p>
                                                        <p className="font-bold">
                                                            {(() => {
                                                                const bn: any = (receiptResult as any).block_number ?? (receiptResult as any).blockNumber
                                                                if (typeof bn === "string") return `#${(parseInt(bn, 16)).toLocaleString()}`
                                                                return `#${bn}`
                                                            })()}
                                                        </p>
                                                    </div>
                                                    <div>
                                                        <p className="text-sm text-muted-foreground">Gas Used</p>
                                                        <p className="font-bold">
                                                            {(() => {
                                                                const gu: any = (receiptResult as any).gas_used ?? (receiptResult as any).gasUsed
                                                                if (typeof gu === "string" && gu.startsWith("0x")) return (parseInt(gu, 16)).toLocaleString()
                                                                return Number(gu).toLocaleString()
                                                            })()}
                                                        </p>
                                                    </div>
                                                    <div>
                                                        <p className="text-sm text-muted-foreground">Cumulative Gas</p>
                                                        <p className="font-bold">
                                                            {(() => {
                                                                const cgu: any = (receiptResult as any).cumulative_gas_used ?? (receiptResult as any).cumulativeGasUsed
                                                                if (typeof cgu === "string" && cgu.startsWith("0x")) return (parseInt(cgu, 16)).toLocaleString()
                                                                return Number(cgu).toLocaleString()
                                                            })()}
                                                        </p>
                                                    </div>
                                                    <div>
                                                        <p className="text-sm text-muted-foreground">Logs Count</p>
                                                        <p className="font-bold">{receiptResult.logs.length}</p>
                                                    </div>
                                                    {receiptResult.contract_address && (
                                                        <div>
                                                            <p className="text-sm text-muted-foreground">Contract Created</p>
                                                            <p className="font-mono text-sm">{truncateHash(receiptResult.contract_address, 12)}</p>
                                                        </div>
                                                    )}
                                                    {!(receiptResult as any).contract_address && (receiptResult as any).contractAddress && (
                                                        <div>
                                                            <p className="text-sm text-muted-foreground">Contract Created</p>
                                                            <p className="font-mono text-sm">{truncateHash((receiptResult as any).contractAddress, 12)}</p>
                                                        </div>
                                                    )}
                                                    <div>
                                                        <p className="text-sm text-muted-foreground">Tx Index</p>
                                                        <p className="font-bold">
                                                            {(() => {
                                                                const ti: any = (receiptResult as any).transaction_index ?? (receiptResult as any).transactionIndex
                                                                if (typeof ti === "string" && ti.startsWith("0x")) return parseInt(ti, 16)
                                                                return ti
                                                            })()}
                                                        </p>
                                                    </div>
                                                    <div>
                                                        <p className="text-sm text-muted-foreground">Type</p>
                                                        <p className="font-bold">
                                                            {(() => {
                                                                const t: any = (receiptResult as any).type
                                                                const v = typeof t === "string" && t.startsWith("0x") ? parseInt(t, 16) : t
                                                                if (v === 2) return "2 (EIP-1559)"
                                                                if (v === 1) return "1 (Access List)"
                                                                if (v === 0) return "0 (Legacy)"
                                                                return String(v ?? "-")
                                                            })()}
                                                        </p>
                                                    </div>
                                                </div>

                                                {((receiptResult as any).effective_gas_price || (receiptResult as any).effectiveGasPrice) && (
                                                    <div>
                                                        <p className="text-sm text-muted-foreground">Effective Gas Price</p>
                                                        <p className="font-bold">
                                                            {(() => {
                                                                const egp: any = (receiptResult as any).effective_gas_price ?? (receiptResult as any).effectiveGasPrice
                                                                if (typeof egp === "string" && egp.startsWith("0x")) return `${formatHexGwei(egp)} Gwei`
                                                                const n = typeof egp === "string" ? Number.parseInt(egp) : Number(egp)
                                                                return `${(n / 1e9).toFixed(2)} Gwei`
                                                            })()}
                                                        </p>
                                                    </div>
                                                )}
                                            </CardContent>
                                        </Card>

                                        <JsonViewer data={receiptResult} title="Raw Receipt Data" />
                                    </div>
                                )}
                            </div>
                        </div>

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
