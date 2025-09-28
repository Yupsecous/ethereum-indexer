"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { Copy, ChevronDown, ChevronRight } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

interface JsonViewerProps {
  data: any
  title?: string
  className?: string
}

export default function JsonViewer({ data, title = "JSON Data", className = "" }: JsonViewerProps) {
  const [isOpen, setIsOpen] = useState(false)
  const { toast } = useToast()

  const copyToClipboard = () => {
    navigator.clipboard.writeText(JSON.stringify(data, null, 2))
    toast({
      title: "Copied to clipboard",
      description: "JSON data has been copied to your clipboard.",
    })
  }

  return (
    <Card className={`border-2 border-black ${className}`}>
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger asChild>
          <div className="flex items-center justify-between p-4 cursor-pointer hover:bg-black/5">
            <div className="flex items-center gap-2">
              {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              <span className="font-bold">{title}</span>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={(e) => {
                e.stopPropagation()
                copyToClipboard()
              }}
              className="border-2 border-black rounded-lg"
            >
              <Copy className="h-4 w-4 mr-1" />
              Copy
            </Button>
          </div>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="border-t-2 border-black p-4">
            <pre className="text-sm bg-black/5 p-4 rounded-lg overflow-auto max-h-96 font-mono">
              {JSON.stringify(data, null, 2)}
            </pre>
          </div>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  )
}
