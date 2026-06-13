import { cn } from "@/lib/utils"

interface ComplianceBarProps {
  score: number // 0–100
  showValue?: boolean
  className?: string
}

function toneFor(score: number): string {
  if (score >= 80) return "bg-emerald-500"
  if (score >= 50) return "bg-amber-500"
  return "bg-red-500"
}

export function ComplianceBar({
  score,
  showValue = true,
  className,
}: ComplianceBarProps) {
  const pct = Math.max(0, Math.min(100, Math.round(score)))
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <div className="bg-muted h-2 w-full overflow-hidden rounded-full">
        <div
          className={cn("h-full rounded-full transition-all", toneFor(pct))}
          style={{ width: `${pct}%` }}
        />
      </div>
      {showValue ? (
        <span className="text-muted-foreground w-9 text-right text-xs tabular-nums">
          {pct}%
        </span>
      ) : null}
    </div>
  )
}
