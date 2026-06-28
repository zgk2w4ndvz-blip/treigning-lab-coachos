"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"

import { clientTabGroups } from "@/config/nav"
import { cn } from "@/lib/utils"
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area"

// Athlete section nav (U3) — restyled on the U0 tokens. Two levels: the nine
// top-level sections, then sub-tabs for the active section (hidden when a section
// has only one). All segments are preserved, so every existing route stays
// reachable.
export function ClientTabs({ clientId }: { clientId: string }) {
  const pathname = usePathname()
  const base = `/clients/${clientId}`

  // Current segment (e.g. "weight-plan"); "" for the Overview page.
  const rest = pathname.startsWith(base) ? pathname.slice(base.length).replace(/^\//, "") : ""
  const segment = rest.split("/")[0]

  const activeGroup =
    clientTabGroups.find((g) => g.tabs.some((t) => t.segment === segment)) ?? clientTabGroups[0]
  const hrefFor = (s: string) => (s ? `${base}/${s}` : base)

  return (
    <div className="space-y-2">
      {/* Section bar */}
      <ScrollArea className="w-full">
        <nav className="inline-flex items-center gap-1">
          {clientTabGroups.map((group) => {
            const active = group.label === activeGroup.label
            return (
              <Link
                key={group.label}
                href={hrefFor(group.tabs[0].segment)}
                className={cn(
                  "rounded-control px-3 py-1.5 text-[0.8125rem] font-medium whitespace-nowrap transition-colors duration-150",
                  active
                    ? "bg-ds-primary-bg text-ds-primary-on"
                    : "text-ds-text-secondary hover:bg-ds-surface-2 hover:text-ds-text-primary"
                )}
              >
                {group.label}
              </Link>
            )
          })}
        </nav>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>

      {/* Sub-tabs for the active section (only when more than one) */}
      {activeGroup.tabs.length > 1 ? (
        <ScrollArea className="w-full">
          <nav className="flex items-center gap-1 border-b border-ds-border">
            {activeGroup.tabs.map((tab) => {
              const active = tab.segment === segment
              const Icon = tab.icon
              return (
                <Link
                  key={tab.label}
                  href={hrefFor(tab.segment)}
                  className={cn(
                    "flex items-center gap-1.5 border-b-2 px-3 py-2.5 text-[0.8125rem] font-medium whitespace-nowrap transition-colors duration-150",
                    active
                      ? "border-ds-primary text-ds-text-primary"
                      : "border-transparent text-ds-text-muted hover:text-ds-text-primary"
                  )}
                >
                  <Icon className="size-4" />
                  {tab.label}
                </Link>
              )
            })}
          </nav>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>
      ) : null}
    </div>
  )
}
