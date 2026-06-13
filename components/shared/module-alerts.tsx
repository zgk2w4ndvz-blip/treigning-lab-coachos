import { AlertTriangle } from "lucide-react"

import { SeverityBadge } from "@/components/shared/badges"
import { cn } from "@/lib/utils"
import type { Alert } from "@/types/models"

/**
 * Inline strip of engine-computed alerts relevant to a module.
 * Pass the client's computed alerts + the rule keys this module owns.
 */
export function ModuleAlerts({
  alerts,
  keys,
}: {
  alerts: Alert[]
  keys: string[]
}) {
  const relevant = alerts.filter((a) => keys.includes(a.rule_key))
  if (relevant.length === 0) return null

  const critical = relevant.some((a) => a.severity === "critical")

  return (
    <div
      className={cn(
        "space-y-2 rounded-lg border p-3",
        critical
          ? "border-red-300 bg-red-50 dark:border-red-900 dark:bg-red-950/40"
          : "border-amber-300 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/40"
      )}
    >
      {relevant.map((a) => (
        <div key={a.id} className="flex items-start gap-2">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-400" />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <SeverityBadge severity={a.severity} />
              <span className="text-sm font-medium">{a.title}</span>
            </div>
            {a.detail ? (
              <p className="text-muted-foreground text-xs">{a.detail}</p>
            ) : null}
          </div>
        </div>
      ))}
    </div>
  )
}
