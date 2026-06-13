"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { CalendarCheck, LineChart } from "lucide-react"

import { cn } from "@/lib/utils"

const NAV = [
  { href: "/today", label: "Today", icon: CalendarCheck },
  { href: "/progress", label: "Progress", icon: LineChart },
]

export function AthleteBottomNav() {
  const pathname = usePathname()

  return (
    <nav className="bg-background/90 fixed inset-x-0 bottom-0 z-20 mx-auto flex w-full max-w-md items-stretch border-t backdrop-blur">
      {NAV.map(({ href, label, icon: Icon }) => {
        const active = pathname === href || pathname.startsWith(`${href}/`)
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex flex-1 flex-col items-center gap-1 py-2.5 text-xs font-medium",
              active ? "text-primary" : "text-muted-foreground"
            )}
          >
            <Icon className="size-5" />
            {label}
          </Link>
        )
      })}
    </nav>
  )
}
