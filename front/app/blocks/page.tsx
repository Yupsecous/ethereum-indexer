"use client"

import { useState } from "react"
import Link from "next/link"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Switch } from "@/components/ui/switch"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Skeleton } from "@/components/ui/skeleton"
import { Menu, Database, BarChart3, Search, Coins, FileText, GitBranch, AlertTriangle, Play } from "lucide-react"
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet"
import MobileNavigation from "@/components/mobile-navigation"
import JsonViewer from "@/components/json-viewer"
import DebugDrawer from "@/components/debug-drawer"
import { EthereumIndexerClient, type Block, isValidBlockNumber } from "@/lib/ethereum-client"
import { mockDataProvider, EXAMPLE_DATA } from "@/lib/mock-data"
import { useToast } from "@/hooks/use-toast"

export default function BlocksPage() {
  const [singleBlockNumber, setSingleBlockNumber] = useState("")
  const [rangeFrom, setRangeFrom] = useState("")
  const [rangeTo, setRangeTo] = useState("")
  const [fullTxs, setFullTxs] = useState(false)
  const [loading, setLoading] = useState(false)
  const [singleBlockResult, setSingleBlockResult] = useState<Block | null>(null)
  const [rangeBlocksResult, setRangeBlocksResult] = useState<Block[] | null>(null)
  const [debugInfo, setDebugInfo] = useState<{ url?: string; params?: any; responseSize?: number }>({})
  const [errors, setErrors] = useState<{ single?: string; range?: string }>({})
  const [usingMockData, setUsingMockData] = useState(false)

  const { toast } = useToast()
  const client = new EthereumIndexerClient()

  const validateSingleBlock = (value: string): string | null => {
    if (!value) return "Block number is required"
    if (value === "latest") return null
    const num = Number.parseInt(value)
    if (isNaN(num) || !isValidBlockNumber(num)) return "Invalid block number"
    return null
  }

  const validateRange = (from: string, to: string): string | null => {
    if (!from || !to) return "Both from and to block numbers are required"
    const fromNum = Number.parseInt(from)
    const toNum = Number.parseInt(to)
    if (isNaN(fromNum) || isNaN(toNum)) return "Invalid block numbers"
    if (!isValidBlockNumber(fromNum) || !isValidBlockNumber(toNum)) return "Block numbers must be >= 0"
    if (fromNum >= toNum) return "From block must be less than to block"
    if (toNum - fromNum > 10000) return "Range too large (max 10,000 blocks)"
    return null
  }

  const handleSingleBlockQuery = async () => {
    const error = validateSingleBlock(singleBlockNumber)
    if (error) {
      setErrors({ ...errors, single: error })
      return
    }

    setErrors({ ...errors, single: undefined })
    setLoading(true)
    setSingleBlockResult(null)

    try {
      const isExample = singleBlockNumber === EXAMPLE_DATA.blocks.recent.toString()
      let result: Block

      if (isExample) {
        setUsingMockData(true)
        result = (await mockDataProvider.getBlockByNumber(singleBlockNumber)) as Block

        setDebugInfo({
          url: `[MOCK] http://localhost:3000/api/eth/getBlockByNumber/${singleBlockNumber}`,
          params: { full: fullTxs },
          responseSize: JSON.stringify(result).length,
        })

        toast({
          title: "Mock data loaded successfully",
          description: `Retrieved example block ${singleBlockNumber}`,
        })
      } else {
        setUsingMockData(false)
        const params = { full: fullTxs }
        const url = `http://localhost:3000/api/eth/getBlockByNumber/${singleBlockNumber}`

        result = (await client.getBlockByNumber(singleBlockNumber, params)) as Block

        setDebugInfo({
          url,
          params,
          responseSize: JSON.stringify(result).length,
        })

        toast({
          title: "Block fetched successfully",
          description: `Retrieved block ${singleBlockNumber}`,
        })
      }

      setSingleBlockResult(result)

      const query = {
        id: Date.now().toString(),
        type: "Single Block",
        query: `Block ${singleBlockNumber}${fullTxs ? " (full txs)" : ""}${isExample ? " [MOCK]" : ""}`,
        timestamp: new Date(),
        status: "success" as const,
      }
      const stored = localStorage.getItem("ethereum-indexer-queries") || "[]"
      const queries = JSON.parse(stored)
      queries.unshift(query)
      localStorage.setItem("ethereum-indexer-queries", JSON.stringify(queries.slice(0, 10)))
    } catch (error: any) {
      setUsingMockData(false)
      toast({
        title: "Error fetching block",
        description: error.message || "Failed to fetch block data",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const handleRangeQuery = async () => {
    const error = validateRange(rangeFrom, rangeTo)
    if (error) {
      setErrors({ ...errors, range: error })
      return
    }

    setErrors({ ...errors, range: undefined })
    setLoading(true)
    setRangeBlocksResult(null)

    try {
      const isExample =
        rangeFrom === EXAMPLE_DATA.blocks.range.from.toString() && rangeTo === EXAMPLE_DATA.blocks.range.to.toString()
      let result: Block[]

      if (isExample) {
        setUsingMockData(true)
        result = (await mockDataProvider.getBlockByNumber("range", true)) as Block[]

        setDebugInfo({
          url: `[MOCK] http://localhost:3000/api/eth/getBlockByNumber/range`,
          params: { from: Number.parseInt(rangeFrom), to: Number.parseInt(rangeTo), full: fullTxs },
          responseSize: JSON.stringify(result).length,
        })

        toast({
          title: "Mock data loaded successfully",
          description: `Retrieved ${result.length} example blocks`,
        })
      } else {
        setUsingMockData(false)
        const params = { from: Number.parseInt(rangeFrom), to: Number.parseInt(rangeTo), full: fullTxs }
        const url = `http://localhost:3000/api/eth/getBlockByNumber/range`

        result = (await client.getBlockByNumber("range", params)) as Block[]

        setDebugInfo({
          url,
          params,
          responseSize: JSON.stringify(result).length,
        })

        toast({
          title: "Block range fetched successfully",
          description: `Retrieved ${result.length} blocks`,
        })
      }

      setRangeBlocksResult(result)

      const query = {
        id: Date.now().toString(),
        type: "Block Range",
        query: `Blocks ${rangeFrom}-${rangeTo}${fullTxs ? " (full txs)" : ""}${isExample ? " [MOCK]" : ""}`,
        timestamp: new Date(),
        status: "success" as const,
      }
      const stored = localStorage.getItem("ethereum-indexer-queries") || "[]"
      const queries = JSON.parse(stored)
      queries.unshift(query)
      localStorage.setItem("ethereum-indexer-queries", JSON.stringify(queries.slice(0, 10)))
    } catch (error: any) {
      setUsingMockData(false)
      toast({
        title: "Error fetching block range",
        description: error.message || "Failed to fetch block range data",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const tryExample = (type: "single" | "range") => {
    if (type === "single") {
      setSingleBlockNumber(EXAMPLE_DATA.blocks.recent.toString())
      setFullTxs(false)
    } else {
      setRangeFrom(EXAMPLE_DATA.blocks.range.from.toString())
      setRangeTo(EXAMPLE_DATA.blocks.range.to.toString())
      setFullTxs(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 p-2 sm:p-4 md:p-8">
      <div className="w-full max-w-7xl mx-auto backdrop-blur-xl bg-white/30 border-4 border-black rounded-3xl shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] overflow-hidden">
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
                className="flex items-center gap-2 text-lg font-bold p-3 hover:bg-black/10 rounded-xl"
              >
                <Coins className="h-5 w-5" />
                ERC-20
              </Link>
              <Link
                href="/blocks"
                className="flex items-center gap-2 text-lg font-bold p-3 bg-black text-white rounded-xl"
              >
                <Database className="h-5 w-5" />
                Blocks
              </Link>
            </nav>
          </div>

          {/* Main content */}
          <div className="overflow-auto p-4 sm:p-6">
            <div className="mb-6">
              <h2 className="text-2xl font-black mb-2">BLOCKS EXPLORER</h2>
              <p className="text-muted-foreground">
                Query individual blocks or block ranges from the Ethereum blockchain
              </p>
              {usingMockData && (
                <Alert className="mt-4 border-2 border-blue-500 bg-blue-50">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    <strong>Mock Data Mode:</strong> You're viewing example data that demonstrates the API response
                    structure.
                  </AlertDescription>
                </Alert>
              )}
            </div>

            <Tabs defaultValue="single" className="w-full">
              <TabsList className="w-full bg-white/50 border-2 border-black rounded-xl p-1 mb-6">
                <TabsTrigger
                  value="single"
                  className="rounded-lg data-[state=active]:bg-black data-[state=active]:text-white font-bold"
                >
                  Single Block
                </TabsTrigger>
                <TabsTrigger
                  value="range"
                  className="rounded-lg data-[state=active]:bg-black data-[state=active]:text-white font-bold"
                >
                  Block Range
                </TabsTrigger>
              </TabsList>

              <TabsContent value="single" className="space-y-6">
                <Card className="border-2 border-black rounded-xl">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Database className="h-5 w-5" />
                      Single Block Query
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="single-block">Block Number or "latest"</Label>
                        <Input
                          id="single-block"
                          placeholder="18000000 or latest"
                          value={singleBlockNumber}
                          onChange={(e) => setSingleBlockNumber(e.target.value)}
                          className="border-2 border-black rounded-lg"
                        />
                        {errors.single && <p className="text-sm text-red-600 font-medium">{errors.single}</p>}
                      </div>
                      <div className="flex items-center space-x-2">
                        <Switch id="single-full-txs" checked={fullTxs} onCheckedChange={setFullTxs} />
                        <Label htmlFor="single-full-txs">Include full transactions</Label>
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <Button
                        onClick={handleSingleBlockQuery}
                        disabled={loading}
                        className="bg-[#F86753] hover:bg-[#fb8c7d] text-white rounded-xl border-2 border-black font-bold shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]"
                      >
                        <Play className="h-4 w-4 mr-2" />
                        {loading ? "Running..." : "Run Query"}
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => tryExample("single")}
                        className="rounded-xl border-2 border-black font-bold bg-transparent"
                      >
                        Try Example
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

                {singleBlockResult && (
                  <div className="space-y-4">
                    <Card className="border-2 border-black rounded-xl">
                      <CardHeader>
                        <CardTitle>Block Summary</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <div>
                            <p className="text-sm text-muted-foreground">Block Number</p>
                            <p className="font-bold">#{singleBlockResult.header.number}</p>
                          </div>
                          <div>
                            <p className="text-sm text-muted-foreground">Hash</p>
                            <p className="font-mono text-sm">{singleBlockResult.header.hash.slice(0, 20)}...</p>
                          </div>
                          <div>
                            <p className="text-sm text-muted-foreground">Transactions</p>
                            <p className="font-bold">{singleBlockResult.transactions.length}</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    <JsonViewer data={singleBlockResult} title="Block Data" />
                  </div>
                )}
              </TabsContent>

              <TabsContent value="range" className="space-y-6">
                <Card className="border-2 border-black rounded-xl">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Database className="h-5 w-5" />
                      Block Range Query
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="range-from">From Block</Label>
                        <Input
                          id="range-from"
                          placeholder="18000000"
                          value={rangeFrom}
                          onChange={(e) => setRangeFrom(e.target.value)}
                          className="border-2 border-black rounded-lg"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="range-to">To Block</Label>
                        <Input
                          id="range-to"
                          placeholder="18000100"
                          value={rangeTo}
                          onChange={(e) => setRangeTo(e.target.value)}
                          className="border-2 border-black rounded-lg"
                        />
                      </div>
                      <div className="flex items-center space-x-2">
                        <Switch id="range-full-txs" checked={fullTxs} onCheckedChange={setFullTxs} />
                        <Label htmlFor="range-full-txs">Include full transactions</Label>
                      </div>
                    </div>

                    {errors.range && (
                      <Alert className="border-2 border-red-500">
                        <AlertTriangle className="h-4 w-4" />
                        <AlertDescription>{errors.range}</AlertDescription>
                      </Alert>
                    )}

                    {rangeFrom && rangeTo && Number.parseInt(rangeTo) - Number.parseInt(rangeFrom) > 1000 && (
                      <Alert className="border-2 border-yellow-500">
                        <AlertTriangle className="h-4 w-4" />
                        <AlertDescription>
                          Large range detected. Consider splitting into multiple smaller ranges for better performance.
                        </AlertDescription>
                      </Alert>
                    )}

                    <div className="flex gap-2">
                      <Button
                        onClick={handleRangeQuery}
                        disabled={loading}
                        className="bg-[#F86753] hover:bg-[#fb8c7d] text-white rounded-xl border-2 border-black font-bold shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]"
                      >
                        <Play className="h-4 w-4" />
                        {loading ? "Running..." : "Run Query"}
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => tryExample("range")}
                        className="rounded-xl border-2 border-black font-bold bg-transparent"
                      >
                        Try Example
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

                {rangeBlocksResult && (
                  <div className="space-y-4">
                    <Card className="border-2 border-black rounded-xl">
                      <CardHeader>
                        <CardTitle>Range Summary</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <div>
                            <p className="text-sm text-muted-foreground">Blocks Retrieved</p>
                            <p className="font-bold">{rangeBlocksResult.length}</p>
                          </div>
                          <div>
                            <p className="text-sm text-muted-foreground">Range</p>
                            <p className="font-bold">
                              #{rangeFrom} - #{rangeTo}
                            </p>
                          </div>
                          <div>
                            <p className="text-sm text-muted-foreground">Total Transactions</p>
                            <p className="font-bold">
                              {rangeBlocksResult.reduce((sum, block) => sum + block.transactions.length, 0)}
                            </p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    <div className="grid gap-4">
                      {rangeBlocksResult.map((block) => (
                        <Card key={block.header.hash} className="border-2 border-black rounded-xl">
                          <CardContent className="p-4">
                            <div className="flex justify-between items-start">
                              <div>
                                <p className="font-bold">Block #{block.header.number}</p>
                                <p className="text-sm text-muted-foreground font-mono">
                                  {block.header.hash.slice(0, 20)}...
                                </p>
                                <p className="text-sm text-muted-foreground">
                                  {block.transactions.length} transactions
                                </p>
                              </div>
                              <div className="text-right text-sm text-muted-foreground">
                                <p>Gas Used: {Number.parseInt(block.header.gas_used).toLocaleString()}</p>
                                <p>Size: {block.header.size ? `${(block.header.size / 1024).toFixed(1)}KB` : "N/A"}</p>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>

                    <JsonViewer data={rangeBlocksResult} title="Block Range Data" />
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
