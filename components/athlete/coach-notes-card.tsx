import { MessageSquareQuote } from "lucide-react"

import { Card, CardContent } from "@/components/ui/card"

/** Read-only coach note surfaced to the athlete. */
export function CoachNotesCard({ notes }: { notes: string }) {
  return (
    <Card className="border-primary/30 bg-primary/5">
      <CardContent className="flex gap-3 p-4">
        <MessageSquareQuote className="text-primary mt-0.5 size-5 shrink-0" />
        <div className="space-y-1">
          <p className="text-primary text-xs font-semibold tracking-wide uppercase">
            Note from your coach
          </p>
          <p className="text-sm leading-relaxed">{notes}</p>
        </div>
      </CardContent>
    </Card>
  )
}
