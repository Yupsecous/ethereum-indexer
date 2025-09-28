"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"
import {
    Menu,
    Coins,
    BarChart3,
    Database,
    Search,
    FileText,
    GitBranch,
    Play,
    ChevronDown,
    ChevronRight,
    Copy,
    Calendar,
} from "lucide-react"
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet"
import MobileNavigation from "@/components/mobile-navigation"
import JsonViewer from "@/components/json-viewer"
import DebugDrawer from "@/components/debug-drawer"
import {
    type BalanceResponse,
    isValidAddress,
    normalizeAddress,
    isValidDate,
    isValidBlockNumber,
    truncateHash,
    formatTimestamp,
    formatEth,
} from "@/lib/ethereum-client"
import { API_BASE_URL } from "@/lib/config"
import { useToast } from "@/hooks/use-toast"

export default function BalancesPage() {
    const [address, setAddress] = useState("")
    const [date, setDate] = useState("")
    const [showAdvanced, setShowAdvanced] = useState(false)
    const [blockRangeLo, setBlockRangeLo] = useState("")
    const [blockRangeHi, setBlockRangeHi] = useState("")
    const [onMiss, setOnMiss] = useState<"strict" | "clamp" | "auto_widen">("strict")
    const [loading, setLoading] = useState(false)
    const [result, setResult] = useState<BalanceResponse | null>(null)
    const [apiError, setApiError] = useState<{ status?: number; message?: string } | null>(null)
    const [debugInfo, setDebugInfo] = useState<{ url?: string; params?: any; responseSize?: number }>({})
    const [errors, setErrors] = useState<{ address?: string; date?: string; blockRange?: string }>({})

    const { toast } = useToast()

    // Prefill from query string
    // Supports: address, date, blockRangeLo, blockRangeHi, onMiss
    // Example: /balances?address=0xabc...&date=2024-09-25&onMiss=strict&blockRangeLo=18000000&blockRangeHi=18001000
    useEffect(() => {
        if (typeof window === "undefined") return
        const params = new URLSearchParams(window.location.search)
        const a = params.get("address")
        const d = params.get("date")
        const lo = params.get("blockRangeLo")
        const hi = params.get("blockRangeHi")
        const om = params.get("onMiss") as "strict" | "clamp" | "auto_widen" | null
        if (a) setAddress(a)
        if (d) setDate(d)
        if (lo) setBlockRangeLo(lo)
        if (hi) setBlockRangeHi(hi)
        if (om === "strict" || om === "clamp" || om === "auto_widen") setOnMiss(om)
        if (lo || hi) setShowAdvanced(true)
    }, [])

    const validateInputs = (): { address?: string; date?: string; blockRange?: string } => {
        const newErrors: { address?: string; date?: string; blockRange?: string } = {}

        if (!address) {
            newErrors.address = "Address is required"
        } else if (!isValidAddress(address)) {
            newErrors.address = "Invalid Ethereum address format"
        }

        if (!date) {
            newErrors.date = "Date is required"
        } else if (!isValidDate(date)) {
            newErrors.date = "Invalid date format (use YYYY-MM-DD)"
        } else {
            const dateObj = new Date(date)
            const now = new Date()
            if (dateObj > now) {
                newErrors.date = "Date cannot be in the future"
            }
        }

        if (blockRangeLo || blockRangeHi) {
            const lo = Number.parseInt(blockRangeLo)
            const hi = Number.parseInt(blockRangeHi)

            if (blockRangeLo && (isNaN(lo) || !isValidBlockNumber(lo))) {
                newErrors.blockRange = "Invalid low block number"
            } else if (blockRangeHi && (isNaN(hi) || !isValidBlockNumber(hi))) {
                newErrors.blockRange = "Invalid high block number"
            } else if (blockRangeLo && blockRangeHi && lo >= hi) {
                newErrors.blockRange = "Low block must be less than high block"
            }
        }

        return newErrors
    }

    const handleBalanceQuery = async () => {
        const validationErrors = validateInputs()
        if (Object.keys(validationErrors).length > 0) {
            setErrors(validationErrors)
            return
        }

        setErrors({})
        setLoading(true)
        setResult(null)
        setApiError(null)

        try {
            const params: Record<string, any> = { on_miss: onMiss }
            if (blockRangeLo) params.block_range_lo = Number.parseInt(blockRangeLo)
            if (blockRangeHi) params.block_range_hi = Number.parseInt(blockRangeHi)

            const normalizedAddress = normalizeAddress(address)
            const url = new URL(`/api/eth/getBalance/${normalizedAddress}/${date}`, API_BASE_URL)
            Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, String(v)))

            const res = await fetch(url.toString())
            if (!res.ok) {
                const errorText = await res.text()
                setApiError({
                    status: res.status,
                    message: errorText || `Request failed with status ${res.status}`
                })
                return
            }
            const balanceResult: BalanceResponse = await res.json()
            setResult(balanceResult)

            setDebugInfo({
                url: url.toString(),
                params,
                responseSize: JSON.stringify(balanceResult).length,
            })

            toast({
                title: "Balance fetched successfully",
                description: `Retrieved balance for ${truncateHash(address)} on ${date}`,
            })

            // Store in recent queries
            const query = {
                id: Date.now().toString(),
                type: "Balance",
                query: `${truncateHash(address)} on ${date}`,
                timestamp: new Date(),
                status: "success" as const,
                href: `/balances?address=${encodeURIComponent(normalizedAddress)}&date=${encodeURIComponent(
                    date
                )}${blockRangeLo ? `&blockRangeLo=${encodeURIComponent(blockRangeLo)}` : ""}${blockRangeHi ? `&blockRangeHi=${encodeURIComponent(
                    blockRangeHi
                )}` : ""}&onMiss=${encodeURIComponent(onMiss)}`,
            }
            const stored = localStorage.getItem("ethereum-indexer-queries") || "[]"
            const queries = JSON.parse(stored)
            queries.unshift(query)
            localStorage.setItem("ethereum-indexer-queries", JSON.stringify(queries.slice(0, 10)))
        } catch (error: any) {
            toast({
                title: "Error fetching balance",
                description: error.message || "Failed to fetch balance data",
                variant: "destructive",
            })
        } finally {
            setLoading(false)
        }
    }

    const copyToClipboard = (text: string, label: string) => {
        navigator.clipboard.writeText(text)
        toast({
            title: "Copied to clipboard",
            description: `${label} has been copied to your clipboard.`,
        })
    }


    const setToday = () => {
        const today = new Date().toISOString().split("T")[0]
        setDate(today)
    }

    const handleAdvancedToggle = (open: boolean) => {
        setShowAdvanced(open)
        if (!open) {
            // Clear advanced options when collapsed
            setBlockRangeLo("")
            setBlockRangeHi("")
        }
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
            <div className="w-full max-w-7xl mx-auto  bg-white border-4 border-black rounded-3xl shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] overflow-hidden">
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
                                className="flex items-center gap-2 text-lg font-bold p-3 bg-black text-white rounded-xl"
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

                    {/* Main content */}
                    <div className="overflow-auto bg-[#F1F1F1] p-4 sm:p-6">
                        <div className="mb-6">
                            <h2 className="text-2xl font-black mb-2">BALANCES CHECKER</h2>
                            <p className="text-muted-foreground">Check Ethereum account balance at a specific date</p>
                        </div>

                        <div className="max-w-2xl space-y-6">
                            <Card className="border-2 border-black rounded-xl">
                                <CardHeader>
                                    <CardTitle className="flex items-center gap-2">
                                        <Coins className="h-5 w-5" />
                                        Balance Query
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <Label htmlFor="address">Ethereum Address</Label>
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
                                            <Label htmlFor="date">Date (YYYY-MM-DD)</Label>
                                            <div className="flex gap-2">
                                                <Input
                                                    id="date"
                                                    type="date"
                                                    value={date}
                                                    onChange={(e) => setDate(e.target.value)}
                                                    className="border-2 border-black rounded-lg"
                                                />
                                                <Button
                                                    variant="outline"
                                                    size="icon"
                                                    onClick={setToday}
                                                    className="border-2 border-black rounded-lg bg-transparent"
                                                >
                                                    <Calendar className="h-4 w-4" />
                                                </Button>
                                            </div>
                                            {errors.date && <p className="text-sm text-red-600 font-medium">{errors.date}</p>}
                                        </div>
                                    </div>

                                    {/* Advanced Options */}
                                    <Collapsible open={showAdvanced} onOpenChange={handleAdvancedToggle}>
                                        <CollapsibleTrigger asChild>
                                            <Button
                                                variant="outline"
                                                className="w-full justify-between border-2 border-black rounded-lg bg-transparent"
                                            >
                                                Advanced Options
                                                {showAdvanced ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                                            </Button>
                                        </CollapsibleTrigger>
                                        <CollapsibleContent className="space-y-4 mt-4">
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                <div className="space-y-2">
                                                    <Label htmlFor="block-range-lo">Block Range Low (optional)</Label>
                                                    <Input
                                                        id="block-range-lo"
                                                        placeholder="18000000"
                                                        value={blockRangeLo}
                                                        onChange={(e) => setBlockRangeLo(e.target.value)}
                                                        className="border-2 border-black rounded-lg"
                                                    />
                                                </div>
                                                <div className="space-y-2">
                                                    <Label htmlFor="block-range-hi">Block Range High (optional)</Label>
                                                    <Input
                                                        id="block-range-hi"
                                                        placeholder="18100000"
                                                        value={blockRangeHi}
                                                        onChange={(e) => setBlockRangeHi(e.target.value)}
                                                        className="border-2 border-black rounded-lg"
                                                    />
                                                </div>
                                            </div>

                                            {errors.blockRange && <p className="text-sm text-red-600 font-medium">{errors.blockRange}</p>}

                                            <div className="space-y-3">
                                                <Label>On Miss Behavior</Label>
                                                <RadioGroup value={onMiss} onValueChange={(value: any) => setOnMiss(value)}>
                                                    <div className="flex items-center space-x-2">
                                                        <RadioGroupItem value="strict" id="strict" />
                                                        <Label htmlFor="strict" className="text-sm">
                                                            <span className="font-bold">Strict</span> - Return error if exact date not found
                                                        </Label>
                                                    </div>
                                                    <div className="flex items-center space-x-2">
                                                        <RadioGroupItem value="clamp" id="clamp" />
                                                        <Label htmlFor="clamp" className="text-sm">
                                                            <span className="font-bold">Clamp</span> - Use closest available date
                                                        </Label>
                                                    </div>
                                                    <div className="flex items-center space-x-2">
                                                        <RadioGroupItem value="auto_widen" id="auto_widen" />
                                                        <Label htmlFor="auto_widen" className="text-sm">
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

                            {loading && (
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

                            {apiError && (
                                <Card className="border-2 border-red-500 rounded-xl bg-red-50">
                                    <CardHeader>
                                        <CardTitle className="flex items-center gap-2 text-red-700">
                                            <FileText className="h-5 w-5" />
                                            Balance Not Found
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent className="space-y-4">
                                        {apiError.status === 404 && onMiss === "strict" ? (
                                            <div className="space-y-3">
                                                <p className="text-red-700 font-medium">
                                                    No balance data found for {truncateHash(address)} on {date} (Strict mode)
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
                                                        onClick={() => setOnMiss("clamp")}
                                                        className="border-yellow-500 text-yellow-700 hover:bg-yellow-50"
                                                    >
                                                        Switch to Clamp Mode
                                                    </Button>
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={() => setOnMiss("auto_widen")}
                                                        className="border-yellow-500 text-yellow-700 hover:bg-yellow-50"
                                                    >
                                                        Switch to Auto Widen
                                                    </Button>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="space-y-2">
                                                <p className="text-red-700 font-medium">
                                                    Error {apiError.status}: Unable to fetch balance data
                                                </p>
                                                <p className="text-sm text-red-600">
                                                    {apiError.message}
                                                </p>
                                            </div>
                                        )}
                                    </CardContent>
                                </Card>
                            )}

                            {result && (
                                <div className="space-y-4">
                                    <Card className="border-2 border-black rounded-xl">
                                        <CardHeader>
                                            <div className="flex items-center justify-between">
                                                <CardTitle>Balance Result</CardTitle>
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() => copyToClipboard(result.address, "Address")}
                                                    className="border border-black rounded-lg"
                                                >
                                                    <Copy className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        </CardHeader>
                                        <CardContent className="space-y-4">
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                                <div className="space-y-4">
                                                    <div>
                                                        <p className="text-sm text-muted-foreground">Address</p>
                                                        <p className="font-mono text-sm">{truncateHash(result.address, 16)}</p>
                                                    </div>
                                                    <div>
                                                        <p className="text-sm text-muted-foreground">Query Date</p>
                                                        <p className="font-bold">{result.date}</p>
                                                    </div>
                                                    <div>
                                                        <p className="text-sm text-muted-foreground">Timestamp</p>
                                                        <p className="font-mono text-sm">{formatTimestamp(result.timestamp)}</p>
                                                    </div>
                                                </div>

                                                <div className="space-y-4">
                                                    <div>
                                                        <p className="text-sm text-muted-foreground">Balance (ETH)</p>
                                                        <p className="text-2xl font-black text-green-600">{formatEth(result.balance_eth)} ETH</p>
                                                    </div>
                                                    <div>
                                                        <p className="text-sm text-muted-foreground">Balance (Wei)</p>
                                                        <p className="font-mono text-sm break-all">{result.balance_wei}</p>
                                                    </div>
                                                    {result.block_number && (
                                                        <div>
                                                            <p className="text-sm text-muted-foreground">Block Number</p>
                                                            <p className="font-bold">#{result.block_number}</p>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>

                                            {result.block_timestamp && (
                                                <div className="pt-4 border-t border-black/20">
                                                    <div className="flex items-center gap-2">
                                                        <Badge variant="outline" className="border-black">
                                                            Block Timestamp: {formatTimestamp(result.block_timestamp)}
                                                        </Badge>
                                                    </div>
                                                </div>
                                            )}
                                        </CardContent>
                                    </Card>

                                    <JsonViewer data={result} title="Raw Balance Data" />
                                </div>
                            )}

                            {debugInfo.url && (
                                <DebugDrawer url={debugInfo.url} params={debugInfo.params} responseSize={debugInfo.responseSize} />
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
