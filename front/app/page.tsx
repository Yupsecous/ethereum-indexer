"use client"

import { useState, useEffect, useCallback } from "react"
import Link from "next/link"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Menu, Activity, Search, Database, Coins, FileText, GitBranch, BarChart3, Play } from "lucide-react"
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet"
import MobileNavigation from "@/components/mobile-navigation"
import QuickActionCard from "@/components/quick-action-card"
import { API_BASE_URL, ETH_RPC_URL, DASHBOARD_REFRESH_MS, TRACE_CHUNK_SIZE } from "@/lib/config"
import { useToast } from "@/hooks/use-toast"

const TRACE_CHUNK_STORAGE_KEY = "trace-chunk-size"

export default function Dashboard() {
    const [latestBlock, setLatestBlock] = useState<string>("—")
    const [apiStatus, setApiStatus] = useState<"success" | "error" | "loading">("loading")
    const [recentQueries, setRecentQueries] = useState<
        Array<{
            id: string
            type: string
            query: string
            timestamp: Date | string
            status: "success" | "error"
            href?: string
        }>
    >([])
    const [traceChunkSize, setTraceChunkSize] = useState<number>(TRACE_CHUNK_SIZE)
    const [chunkInput, setChunkInput] = useState<string>(TRACE_CHUNK_SIZE.toString())
    const [rpcInfo, setRpcInfo] = useState<{ rpc_urls: string[]; parallel_per_rpc: number } | null>(null)
    const [rpcStatus, setRpcStatus] = useState<"loading" | "success" | "error">("loading")
    const { toast } = useToast()

    const apiStatusMeta = (
        {
            success: { label: "Connected", indicatorClass: "bg-green-500" },
            error: { label: "Error", indicatorClass: "bg-red-500" },
            loading: { label: "Checking...", indicatorClass: "bg-yellow-500 animate-pulse" },
        } as const
    )[apiStatus]

    const fetchLatestBlock = async () => {
        try {
            const res = await fetch(ETH_RPC_URL, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_blockNumber", params: [] }),
            })
            if (!res.ok) throw new Error("Failed to fetch latest block")
            const data = await res.json()
            const hex = data?.result as string
            if (!hex) throw new Error("Invalid response from RPC")
            const num = Number.parseInt(hex, 16)
            setLatestBlock(`#${num.toLocaleString()}`)
        } catch {
            setLatestBlock("—")
        }
    }

    const pingServer = async () => {
        setApiStatus("loading")
        try {
            const res = await fetch(`${API_BASE_URL}/ping`, { method: "GET" })
            setApiStatus(res.ok ? "success" : "error")
            loadRpcInfo()
        } catch {
            setApiStatus("error")
        }
    }

    const loadRpcInfo = useCallback(
        async (showFeedback = false) => {
            try {
                setRpcStatus("loading")
                const res = await fetch(`${API_BASE_URL}/api/rpc-info`)
                if (!res.ok) {
                    throw new Error(`RPC info request failed with status ${res.status}`)
                }
                const data = (await res.json()) as { rpc_urls: string[]; parallel_per_rpc: number }
                setRpcInfo(data)
                setRpcStatus("success")
                if (showFeedback) {
                    toast({
                        title: "RPC info refreshed",
                        description: `Loaded ${data.rpc_urls.length} endpoint${data.rpc_urls.length === 1 ? "" : "s"}.`,
                    })
                }
            } catch (error: any) {
                console.error("Failed to fetch RPC info", error)
                setRpcStatus("error")
                if (showFeedback) {
                    toast({
                        title: "Failed to fetch RPC info",
                        description: error?.message || "Unexpected error",
                        variant: "destructive",
                    })
                }
            }
        },
        [toast]
    )

    const handleChunkSizeApply = () => {
        const trimmed = chunkInput.trim()
        const parsed = Number.parseInt(trimmed, 10)
        if (!trimmed || Number.isNaN(parsed) || parsed <= 0) {
            toast({
                title: "Invalid chunk size",
                description: "Please enter a positive integer value.",
                variant: "destructive",
            })
            return
        }

        setTraceChunkSize(parsed)
        setChunkInput(String(parsed))

        if (typeof window !== "undefined") {
            window.localStorage.setItem(TRACE_CHUNK_STORAGE_KEY, String(parsed))
            window.dispatchEvent(new CustomEvent("trace-chunk-size-updated", { detail: parsed }))
        }

        toast({
            title: "Trace chunk size updated",
            description: `New value: ${parsed.toLocaleString()} blocks per page.`,
        })
    }

    const handleChunkSizeReset = () => {
        setTraceChunkSize(TRACE_CHUNK_SIZE)
        setChunkInput(TRACE_CHUNK_SIZE.toString())

        if (typeof window !== "undefined") {
            window.localStorage.removeItem(TRACE_CHUNK_STORAGE_KEY)
            window.dispatchEvent(new CustomEvent("trace-chunk-size-updated", { detail: TRACE_CHUNK_SIZE }))
        }

        toast({
            title: "Trace chunk size reset",
            description: `Restored to default value of ${TRACE_CHUNK_SIZE.toLocaleString()} blocks per page.`,
        })
    }

    useEffect(() => {
        // Kick off immediately
        fetchLatestBlock()
        pingServer()
        loadRpcInfo()

        // Then refresh every ~15s (avg Ethereum block time)
        const id = setInterval(() => {
            fetchLatestBlock()
            pingServer()
            loadRpcInfo()
        }, DASHBOARD_REFRESH_MS)
        return () => clearInterval(id)
    }, [])

    // Load recent queries from localStorage
    useEffect(() => {
        const stored = localStorage.getItem("ethereum-indexer-queries")
        if (stored) {
            try {
                const queries = JSON.parse(stored)
                setRecentQueries(queries.slice(0, 5)) // Show last 5 queries
            } catch (error) {
                console.error("Failed to load recent queries:", error)
            }
        }
    }, [])

    useEffect(() => {
        if (typeof window === "undefined") return

        const stored = window.localStorage.getItem(TRACE_CHUNK_STORAGE_KEY)
        if (stored) {
            const parsed = Number.parseInt(stored, 10)
            if (!Number.isNaN(parsed) && parsed > 0) {
                setTraceChunkSize(parsed)
                setChunkInput(String(parsed))
            }
        }

        const handleStorage = (event: StorageEvent) => {
            if (event.key !== TRACE_CHUNK_STORAGE_KEY) return

            if (event.newValue) {
                const value = Number.parseInt(event.newValue, 10)
                if (!Number.isNaN(value) && value > 0) {
                    setTraceChunkSize(value)
                    setChunkInput(String(value))
                }
            } else {
                setTraceChunkSize(TRACE_CHUNK_SIZE)
                setChunkInput(TRACE_CHUNK_SIZE.toString())
            }
        }

        const handleCustom = (event: Event) => {
            const customEvent = event as CustomEvent<number>
            const value = customEvent.detail
            if (typeof value === "number" && value > 0) {
                setTraceChunkSize(value)
                setChunkInput(String(value))
            }
        }

        window.addEventListener("storage", handleStorage)
        window.addEventListener("trace-chunk-size-updated", handleCustom as EventListener)

        return () => {
            window.removeEventListener("storage", handleStorage)
            window.removeEventListener("trace-chunk-size-updated", handleCustom as EventListener)
        }
    }, [])

    useEffect(() => {
        loadRpcInfo()
    }, [loadRpcInfo])

    const handleQuickAction = async (action: string) => {
        try {
            setApiStatus("loading")

            switch (action) {
                case "latest-block":
                    // Simulate API call for latest block
                    toast({
                        title: "Fetching latest block...",
                        description: "This would fetch the most recent block from the API.",
                    })
                    break
                case "lookup-tx":
                    // Navigate to transactions page
                    window.location.href = "/transactions"
                    break
                case "get-balance":
                    // Navigate to balances page
                    window.location.href = "/balances"
                    break
            }

            setApiStatus("success")
        } catch (error) {
            setApiStatus("error")
            toast({
                title: "Error",
                description: "Failed to execute action. Please try again.",
                variant: "destructive",
            })
        }
    }

    const rerunQuery = (query: any) => {
        // Prefer an explicit href saved with the query so we can prefill fields
        if (query?.href) {
            window.location.href = query.href
            return
        }

        // Fallbacks by type (no prefill possible for legacy entries)
        const t = String(query?.type || "")
        if (t.includes("Balance")) {
            window.location.href = "/balances"
            return
        }
        if (t.includes("Transaction") || t.includes("Receipt")) {
            window.location.href = "/transactions"
            return
        }
        if (t.includes("ERC-20 Wallet")) {
            window.location.href = "/erc20?tab=wallet"
            return
        }
        if (t.includes("ERC-20 Token")) {
            window.location.href = "/erc20?tab=token"
            return
        }
        if (t.includes("Trace")) {
            window.location.href = "/trace"
            return
        }

        // As a last resort, go nowhere but inform the user
        toast({
            title: "Unable to re-run",
            description: "This entry lacks details to restore the query.",
            variant: "destructive",
        })
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

                        {/* Mobile menu */}
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

                        {/* Desktop buttons */}
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
                    {/* Sidebar - Desktop only */}
                    <div className="hidden md:block border-r-4 border-black bg-white/40 p-4">
                        <nav className="space-y-2">
                            <Link href="/" className="flex items-center gap-2 text-lg font-bold p-3 bg-black text-white rounded-xl">
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
                                className="flex items-center gap-2 text-lg font-bold p-3 hover:bg-black/10 rounded-xl"
                            >
                                <Coins className="h-5 w-5" />
                                ERC-20
                            </Link>
                        </nav>
                    </div>

                    {/* Main content */}
                    <div className="overflow-auto bg-[#F1F1F1] p-4 sm:p-6">
                        {/* Quick Actions */}
                        {/* 
            <div className="mb-8">
              <h2 className="text-xl sm:text-2xl font-black mb-4">QUICK ACTIONS</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <QuickActionCard
                  title="Latest Block"
                  description="Get the most recent block"
                  icon={Activity}
                  onClick={() => handleQuickAction("latest-block")}
                />
                <QuickActionCard
                  title="Lookup Tx"
                  description="Find transaction by hash"
                  icon={Search}
                  onClick={() => handleQuickAction("lookup-tx")}
                />
                <QuickActionCard
                  title="Get Balance"
                  description="Check balance by date"
                  icon={Coins}
                  onClick={() => handleQuickAction("get-balance")}
                />
                <QuickActionCard
                  title="Scan Logs"
                  description="Search event logs"
                  icon={FileText}
                  //onClick={() => handleQuickAction("scan-logs")}
                />
              </div>
            </div>
            */}

                        {/* System Controls */}
                        <div className="mb-8">
                            <h2 className="text-xl sm:text-2xl font-black mb-4">SYSTEM CONTROLS</h2>
                            <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1fr)_minmax(0,1.2fr)]">
                                <Card className="border-2 border-black rounded-xl">
                                    <CardHeader className="pb-2">
                                        <CardTitle className="flex items-center justify-between text-base">
                                            <span>API Health</span>
                                            <span className="flex items-center gap-2 text-sm font-semibold">
                                                <span className={`h-2.5 w-2.5 rounded-full ${apiStatusMeta.indicatorClass}`} />
                                                {apiStatusMeta.label}
                                            </span>
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent className="space-y-4">
                                        <div className="flex items-center justify-between text-sm">
                                            <span className="text-muted-foreground">Latest Block</span>
                                            <span className="font-bold">{latestBlock}</span>
                                        </div>
                                        <div className="space-y-1">
                                            <span className="text-sm text-muted-foreground">API Base URL</span>
                                            <p className="font-mono text-xs break-all">{API_BASE_URL}</p>
                                        </div>
                                        <Button
                                            variant="outline"
                                            onClick={pingServer}
                                            disabled={apiStatus === "loading"}
                                            className="w-full rounded-xl border-2 border-black font-bold bg-white"
                                        >
                                            {apiStatus === "loading" ? "Checking..." : "Refresh"}
                                        </Button>
                                    </CardContent>
                                </Card>
                                <Card className="border-2 border-black rounded-xl">
                                    <CardHeader className="pb-2">
                                        <CardTitle className="text-base">Trace Chunk Size</CardTitle>
                                    </CardHeader>
                                    <CardContent className="space-y-4">
                                        <p className="text-sm text-muted-foreground">
                                            Controls how many blocks are requested per page on the Trace screen.
                                        </p>
                                        <div className="space-y-2">
                                            <Label htmlFor="trace-chunk-size" className="text-sm font-semibold text-foreground">
                                                Trace chunk size
                                            </Label>
                                            <div className="flex gap-2">
                                                <Input
                                                    id="trace-chunk-size"
                                                    type="number"
                                                    inputMode="numeric"
                                                    min={1}
                                                    value={chunkInput}
                                                    onChange={(event) => setChunkInput(event.target.value)}
                                                    className="flex-1 border-2 border-black rounded-lg font-mono text-right"
                                                />
                                                <Button
                                                    onClick={handleChunkSizeApply}
                                                    className="bg-[#F86753] hover:bg-[#fb8c7d] text-white rounded-xl border-2 border-black font-bold shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] px-6"
                                                >
                                                    Apply
                                                </Button>
                                            </div>
                                        </div>
                                        <p className="text-xs text-muted-foreground">
                                            Active chunk size: {" "}
                                            <span className="font-bold text-foreground">{traceChunkSize.toLocaleString()}</span> blocks
                                            <button
                                                type="button"
                                                onClick={handleChunkSizeReset}
                                                className="ml-1 font-bold text-[#F86753] hover:underline"
                                            >
                                                Reset
                                            </button>
                                        </p>
                                    </CardContent>
                                </Card>
                                <Card className="border-2 border-black rounded-xl">
                                    <CardHeader className="pb-2">
                                        <CardTitle className="text-base">RPC Configuration</CardTitle>
                                    </CardHeader>
                                    <CardContent className="space-y-4">
                                        {rpcStatus === "loading" && (
                                            <p className="text-sm text-muted-foreground">Loading RPC info...</p>
                                        )}
                                        {rpcStatus === "error" && (
                                            <p className="text-sm text-red-600 font-semibold">Unable to load RPC info.</p>
                                        )}
                                        {rpcStatus === "success" && rpcInfo && (
                                            <div className="space-y-3 text-sm">
                                                <div className="flex items-center justify-between">
                                                    <span className="text-muted-foreground">Parallel per RPC</span>
                                                    <span className="font-bold">{rpcInfo.parallel_per_rpc}</span>
                                                </div>
                                                <div>
                                                    <span className="text-muted-foreground">RPC URLs</span>
                                                    <ul className="mt-2 space-y-1">
                                                        {rpcInfo.rpc_urls.map((url) => (
                                                            <li key={url} className="font-mono text-xs break-all">
                                                                {url}
                                                            </li>
                                                        ))}
                                                    </ul>
                                                </div>
                                            </div>
                                        )}
                                        {/*
                                        <Button
                                            variant="outline"
                                            onClick={() => loadRpcInfo(true)}
                                            disabled={rpcStatus === "loading"}
                                            className="w-full rounded-xl border-2 border-black font-bold bg-white"
                                        >
                                            {rpcStatus === "loading" ? "Refreshing..." : "Refresh"}
                                        </Button>
                                        */}
                                    </CardContent>
                                </Card>
                            </div>
                        </div>

                        {/* Recent Queries */}
                        <div>
                            <h2 className="text-xl sm:text-2xl font-black mb-4">RECENT QUERIES</h2>
                            <Card className="border-2 border-black rounded-xl">
                                <CardContent className="p-6">
                                    {recentQueries.length === 0 ? (
                                        <div className="text-center text-muted-foreground">
                                            <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                                            <p className="text-lg font-bold mb-2">No recent queries</p>
                                            <p className="text-sm">Your query history will appear here</p>
                                        </div>
                                    ) : (
                                        <div className="space-y-3">
                                            {recentQueries.map((query) => (
                                                <div
                                                    key={query.id}
                                                    className="flex items-center justify-between p-3 bg-white/50 rounded-lg border border-black/20"
                                                >
                                                    <div className="flex-1">
                                                        <div className="flex items-center gap-2 mb-1">
                                                            <span className="font-bold text-sm">{query.type}</span>
                                                            <span
                                                                className={`text-xs px-2 py-1 rounded ${query.status === "success" ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"
                                                                    }`}
                                                            >
                                                                {query.status}
                                                            </span>
                                                        </div>
                                                        <p className="text-sm text-muted-foreground font-mono">{query.query}</p>
                                                        <p className="text-xs text-muted-foreground">{query.timestamp.toLocaleString()}</p>
                                                    </div>
                                                    <Button
                                                        size="sm"
                                                        onClick={() => rerunQuery(query)}
                                                        className="bg-[#F86753] hover:bg-[#fb8c7d] text-white rounded-xl border-2 border-black font-bold shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]"
                                                    >
                                                        <Play className="h-4 w-4" />
                                                        Re-run
                                                    </Button>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
