"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"

import { clientTabGroups } from "@/config/nav"
import { cn } from "@/lib/utils"
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area"

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
      {/* Group bar */}
      <ScrollArea className="w-full">
        <nav className="bg-muted/40 inline-flex items-center gap-1 rounded-lg p-1">
          {clientTabGroups.map((group) => {
            const active = group.label === activeGroup.label
            return (
              <Link
                key={group.label}
                href={hrefFor(group.tabs[0].segment)}
                className={cn(
                  "font-heading rounded-md px-3 py-1.5 text-xs font-semibold tracking-wide uppercase whitespace-nowrap transition-colors",
                  active
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {group.label}
              </Link>
            )
          })}
        </nav>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>

      {/* Sub-tabs for the active group */}
      <ScrollArea className="w-full">
        <nav className="flex items-center gap-1 border-b">
          {activeGroup.tabs.map((tab) => {
            const active = tab.segment === segment
            const Icon = tab.icon
            return (
              <Link
                key={tab.label}
                href={hrefFor(tab.segment)}
                className={cn(
                  "flex items-center gap-1.5 border-b-2 px-3 py-2.5 text-sm font-medium whitespace-nowrap transition-colors",
                  active
                    ? "border-primary text-foreground"
                    : "text-muted-foreground hover:text-foreground border-transparent"
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
    </div>
  )
}
