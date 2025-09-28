import Link from "next/link"
import { Button } from "@/components/ui/button"
import { BarChart3, Database, Search, Coins, FileText, GitBranch } from "lucide-react"

export default function MobileNavigation() {
  return (
    <div className="h-full bg-white/40 backdrop-blur-md flex flex-col">
      <div className="p-6 border-b-4 border-black">
        <h2 className="text-2xl font-black">ETHEREUM INDEXER</h2>
      </div>

      <div className="flex-1 overflow-auto p-4">
        <nav className="space-y-2 mb-8">
          <Link href="/" className="flex items-center gap-2 text-lg font-bold p-3 bg-black text-white rounded-xl">
            <BarChart3 className="h-5 w-5" />
            Dashboard
          </Link>
          <Link href="/blocks" className="flex items-center gap-2 text-lg font-bold p-3 hover:bg-black/10 rounded-xl">
            <Database className="h-5 w-5" />
            Blocks
          </Link>
          <Link
            href="/transactions"
            className="flex items-center gap-2 text-lg font-bold p-3 hover:bg-black/10 rounded-xl"
          >
            <Search className="h-5 w-5" />
            Transactions
          </Link>
          <Link href="/balances" className="flex items-center gap-2 text-lg font-bold p-3 hover:bg-black/10 rounded-xl">
            <Coins className="h-5 w-5" />
            Balances
          </Link>
          <Link href="/erc20" className="flex items-center gap-2 text-lg font-bold p-3 hover:bg-black/10 rounded-xl">
            <Coins className="h-5 w-5" />
            ERC-20
          </Link>
          <Link href="/trace" className="flex items-center gap-2 text-lg font-bold p-3 hover:bg-black/10 rounded-xl">
            <GitBranch className="h-5 w-5" />
            Trace
          </Link>
        </nav>
      </div>

      <div className="p-4 border-t-4 border-black">
        <div className="grid grid-cols-2 gap-2">
          <Button className="bg-black hover:bg-black/80 text-white rounded-xl border-2 border-black font-bold">
            API Docs
          </Button>
          <Button variant="outline" className="rounded-xl border-2 border-black font-bold bg-transparent">
            Settings
          </Button>
        </div>
      </div>
    </div>
  )
}
