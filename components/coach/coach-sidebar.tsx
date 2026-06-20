"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Dumbbell } from "lucide-react"

import { coachNavGroups, coachSettingsNav, type NavItem } from "@/config/nav"
import { cn } from "@/lib/utils"

export function CoachSidebar({ inboxCount = 0 }: { inboxCount?: number }) {
  const pathname = usePathname()

  const isActive = (href: string) =>
    href === "/dashboard" ? pathname === href : pathname.startsWith(href)

  const NavLink = ({ item }: { item: NavItem }) => {
    const Icon = item.icon
    const active = isActive(item.href)
    return (
      <Link
        href={item.href}
        className={cn(
          "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
          active
            ? "bg-primary/15 text-primary"
            : "text-muted-foreground hover:bg-muted hover:text-foreground"
        )}
      >
        <Icon className="size-4" />
        <span className="flex-1">{item.label}</span>
        {item.href === "/inbox" && inboxCount > 0 ? (
          <span className="bg-primary text-primary-foreground inline-flex min-w-5 items-center justify-center rounded-full px-1.5 text-[11px] font-semibold tabular-nums">
            {inboxCount > 99 ? "99+" : inboxCount}
          </span>
        ) : null}
      </Link>
    )
  }

  return (
    <aside className="bg-sidebar text-sidebar-foreground hidden w-60 shrink-0 flex-col border-r md:flex">
      <div className="flex h-16 items-center gap-2 border-b px-5">
        <div className="bg-primary text-primary-foreground flex size-8 items-center justify-center rounded-md">
          <Dumbbell className="size-4" />
        </div>
        <div className="leading-tight">
          <p className="font-heading text-base font-bold tracking-tight">CoachOS</p>
          <p className="text-muted-foreground text-[11px]">Treigning Lab</p>
        </div>
      </div>

      <nav className="flex-1 space-y-5 overflow-y-auto p-3">
        {coachNavGroups.map((group) => (
          <div key={group.label} className="space-y-1">
            <p className="text-muted-foreground/70 px-3 pb-1 text-[10px] font-semibold tracking-widest uppercase">
              {group.label}
            </p>
            {group.items.map((item) => (
              <NavLink key={item.href} item={item} />
            ))}
          </div>
        ))}
      </nav>

      <div className="border-t p-3">
        <NavLink item={coachSettingsNav} />
      </div>
    </aside>
  )
}
