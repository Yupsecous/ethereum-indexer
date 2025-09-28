"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { Copy, Bug, ChevronDown, ChevronRight } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

interface DebugDrawerProps {
  url?: string
  params?: Record<string, any>
  responseSize?: number
  className?: string
}

export default function DebugDrawer({ url, params, responseSize, className = "" }: DebugDrawerProps) {
  const [isOpen, setIsOpen] = useState(false)
  const { toast } = useToast()

  const generateCurl = () => {
    if (!url) return ""

    let cleanUrl = url
    let isMockData = false

    // Check if this is mock data
    if (url.startsWith("[MOCK]")) {
      isMockData = true
      cleanUrl = url.replace("[MOCK] ", "")
    }

    try {
      const fullUrl = new URL(cleanUrl)
      if (params) {
        Object.entries(params).forEach(([key, value]) => {
          if (value !== undefined) {
            if (Array.isArray(value)) {
              value.forEach((v) => fullUrl.searchParams.append(key, v.toString()))
            } else {
              fullUrl.searchParams.append(key, value.toString())
            }
          }
        })
      }

      const curlCommand = `curl -X GET "${fullUrl.toString()}"`
      return isMockData ? `# Mock Data Example\n${curlCommand}` : curlCommand
    } catch (error) {
      const baseUrl = cleanUrl.includes("?") ? cleanUrl.split("?")[0] : cleanUrl
      const queryString = params
        ? Object.entries(params)
            .filter(([_, value]) => value !== undefined)
            .map(([key, value]) => {
              if (Array.isArray(value)) {
                return value.map((v) => `${key}=${encodeURIComponent(v.toString())}`).join("&")
              }
              return `${key}=${encodeURIComponent(value.toString())}`
            })
            .join("&")
        : ""

      const finalUrl = queryString ? `${baseUrl}?${queryString}` : baseUrl
      const curlCommand = `curl -X GET "${finalUrl}"`
      return isMockData ? `# Mock Data Example\n${curlCommand}` : curlCommand
    }
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    toast({
      title: "Copied to clipboard",
      description: "Debug information has been copied to your clipboard.",
    })
  }

  if (!url) return null

  return (
    <Card className={`border-2 border-black ${className}`}>
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger asChild>
          <div className="flex items-center justify-between p-3 cursor-pointer hover:bg-black/5">
            <div className="flex items-center gap-2">
              {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              <Bug className="h-4 w-4" />
              <span className="font-bold text-sm">Debug Info</span>
            </div>
            {responseSize && (
              <span className="text-sm text-muted-foreground">{(responseSize / 1024).toFixed(1)}KB</span>
            )}
          </div>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="border-t-2 border-black p-4 space-y-4">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="font-bold text-sm">Request URL</span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => copyToClipboard(url)}
                  className="border border-black rounded-lg h-6 px-2"
                >
                  <Copy className="h-3 w-3" />
                </Button>
              </div>
              <code className="text-xs bg-black/5 p-2 rounded block break-all">{url}</code>
            </div>

            {params && Object.keys(params).length > 0 && (
              <div>
                <span className="font-bold text-sm">Query Parameters</span>
                <pre className="text-xs bg-black/5 p-2 rounded mt-1">{JSON.stringify(params, null, 2)}</pre>
              </div>
            )}

            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="font-bold text-sm">cURL Command</span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => copyToClipboard(generateCurl())}
                  className="border border-black rounded-lg h-6 px-2"
                >
                  <Copy className="h-3 w-3" />
                </Button>
              </div>
              <code className="text-xs bg-black/5 p-2 rounded block break-all">{generateCurl()}</code>
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  )
}
