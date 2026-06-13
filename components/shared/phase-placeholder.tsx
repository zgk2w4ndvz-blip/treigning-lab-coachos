import type { LucideIcon } from "lucide-react"

import { EmptyState } from "@/components/shared/empty-state"

/** Lightweight "coming in a later phase" placeholder for stubbed routes. */
export function PhasePlaceholder({
  icon,
  title,
  phase,
}: {
  icon?: LucideIcon
  title: string
  phase: string
}) {
  return (
    <EmptyState
      icon={icon}
      title={title}
      description={`This area is part of ${phase} and isn't wired up yet.`}
    />
  )
}
