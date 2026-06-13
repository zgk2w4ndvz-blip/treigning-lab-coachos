import { cn } from "@/lib/utils"
import type { ReadinessLevel, ReadinessScore } from "@/types/models"

const LEVEL_META: Record<
  ReadinessLevel,
  { label: string; ring: string; text: string }
> = {
  on_track: {
    label: "On track",
    ring: "stroke-emerald-500",
    text: "text-emerald-600 dark:text-emerald-500",
  },
  watch: {
    label: "Watch",
    ring: "stroke-amber-500",
    text: "text-amber-600 dark:text-amber-500",
  },
  at_risk: {
    label: "At risk",
    ring: "stroke-red-500",
    text: "text-red-600 dark:text-red-500",
  },
}

const COMPONENT_LABELS: Record<keyof ReadinessScore["components"], string> = {
  weight: "Weight",
  safety: "Cut safety",
  hydration: "Hydration",
  recovery: "Recovery",
  training: "Training",
}

function barTone(v: number): string {
  if (v >= 75) return "bg-emerald-500"
  if (v >= 50) return "bg-amber-500"
  return "bg-red-500"
}

export function ReadinessGauge({ readiness }: { readiness: ReadinessScore }) {
  const meta = LEVEL_META[readiness.level]
  const r = 52
  const circ = 2 * Math.PI * r
  const offset = circ * (1 - readiness.overall / 100)

  return (
    <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
      <div className="relative size-36 shrink-0">
        <svg viewBox="0 0 128 128" className="size-full -rotate-90">
          <circle
            cx="64"
            cy="64"
            r={r}
            fill="none"
            strokeWidth="12"
            className="stroke-muted"
          />
          <circle
            cx="64"
            cy="64"
            r={r}
            fill="none"
            strokeWidth="12"
            strokeLinecap="round"
            strokeDasharray={circ}
            strokeDashoffset={offset}
            className={cn("transition-all", meta.ring)}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-3xl font-bold tabular-nums">
            {readiness.overall}
          </span>
          <span className={cn("text-xs font-medium", meta.text)}>
            {meta.label}
          </span>
        </div>
      </div>

      <dl className="grid flex-1 gap-2">
        {(
          Object.keys(COMPONENT_LABELS) as (keyof ReadinessScore["components"])[]
        ).map((key) => {
          const v = readiness.components[key]
          return (
            <div key={key} className="grid grid-cols-[5.5rem_1fr_2.5rem] items-center gap-2">
              <dt className="text-muted-foreground text-xs">
                {COMPONENT_LABELS[key]}
              </dt>
              <dd className="bg-muted h-2 overflow-hidden rounded-full">
                <div
                  className={cn("h-full rounded-full", barTone(v))}
                  style={{ width: `${v}%` }}
                />
              </dd>
              <dd className="text-right text-xs tabular-nums">{v}</dd>
            </div>
          )
        })}
      </dl>
    </div>
  )
}

export function readinessBadgeTone(level: ReadinessLevel): string {
  return LEVEL_META[level].text
}
