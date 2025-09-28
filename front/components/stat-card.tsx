import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

interface StatCardProps {
  title: string
  value: string
  className?: string
}

export default function StatCard({ title, value, className = "" }: StatCardProps) {
  return (
    <Card className={`border-2 border-black rounded-xl ${className}`}>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm text-muted-foreground">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-black">{value}</p>
      </CardContent>
    </Card>
  )
}
