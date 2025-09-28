"use client"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { X } from "lucide-react"

interface FilterChipProps {
  label: string
  onRemove: () => void
  className?: string
}

export default function FilterChip({ label, onRemove, className = "" }: FilterChipProps) {
  return (
    <Badge variant="outline" className={`border-black rounded-lg pr-1 ${className}`}>
      <span className="mr-1">{label}</span>
      <Button variant="ghost" size="sm" onClick={onRemove} className="h-4 w-4 p-0 hover:bg-black/10 rounded-full">
        <X className="h-3 w-3" />
      </Button>
    </Badge>
  )
}
