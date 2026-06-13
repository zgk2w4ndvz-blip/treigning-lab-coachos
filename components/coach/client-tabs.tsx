"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"

import { clientTabs } from "@/config/nav"
import { cn } from "@/lib/utils"
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area"

export function ClientTabs({ clientId }: { clientId: string }) {
  const pathname = usePathname()
  const base = `/clients/${clientId}`

  return (
    <ScrollArea className="w-full">
      <nav className="flex items-center gap-1 border-b">
        {clientTabs.map((tab) => {
          const href = tab.segment ? `${base}/${tab.segment}` : base
          const active =
            tab.segment === ""
              ? pathname === base
              : pathname === href || pathname.startsWith(`${href}/`)
          const Icon = tab.icon
          return (
            <Link
              key={tab.label}
              href={href}
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
  )
}
