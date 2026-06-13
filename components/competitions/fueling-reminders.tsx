import { UtensilsCrossed, GlassWater } from "lucide-react"

import type { RefuelStep, RehydrationStep } from "@/types/models"

/** Compact post-weigh-in fueling reminder list (from the cut's refuel protocol). */
export function FuelingReminders({ steps }: { steps: RefuelStep[] }) {
  if (steps.length === 0) return null
  return (
    <div className="space-y-1">
      <p className="text-muted-foreground flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide">
        <UtensilsCrossed className="size-3.5" />
        Post-weigh-in fueling
      </p>
      <ul className="space-y-0.5 text-sm">
        {steps.map((s, i) => (
          <li key={i} className="flex items-center justify-between gap-2">
            <span className="truncate">
              <span className="text-muted-foreground tabular-nums">+{s.hour_offset}h</span>{" "}
              {s.label}
              {s.food ? <span className="text-muted-foreground"> · {s.food}</span> : null}
            </span>
            <span className="text-muted-foreground shrink-0 text-xs tabular-nums">
              {s.carbs_g != null ? `${s.carbs_g}C` : ""}
              {s.protein_g ? ` ${s.protein_g}P` : ""}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}

/** Compact hydration-restoration summary. */
export function HydrationReminders({ steps }: { steps: RehydrationStep[] }) {
  if (steps.length === 0) return null
  const totalOz = steps.reduce((s, x) => s + x.fluid_oz, 0)
  return (
    <div className="space-y-1">
      <p className="text-muted-foreground flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide">
        <GlassWater className="size-3.5" />
        Hydration restoration
      </p>
      <p className="text-sm">
        {steps.length} steps · {totalOz} oz over the rehydration window
        <span className="text-muted-foreground">
          {" "}
          (start +{steps[0].hour_offset}h · {steps[0].fluid_oz} oz
          {steps[0].electrolytes ? ` + ${steps[0].electrolytes}` : ""})
        </span>
      </p>
    </div>
  )
}
