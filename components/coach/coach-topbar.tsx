"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { UserButton } from "@clerk/nextjs"
import { Bell, Dumbbell, Menu, Search } from "lucide-react"

import { coachNav } from "@/config/nav"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"

export function CoachTopbar({
  alertCount = 0,
  devMode = false,
}: {
  alertCount?: number
  devMode?: boolean
}) {
  const pathname = usePathname()

  return (
    <header className="bg-background/80 sticky top-0 z-20 flex h-16 items-center justify-between gap-3 border-b px-4 backdrop-blur md:px-6">
      <div className="flex items-center gap-2">
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="md:hidden">
              <Menu className="size-5" />
              <span className="sr-only">Open navigation</span>
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-64 p-0">
            <SheetHeader className="h-16 flex-row items-center gap-2 border-b px-5">
              <Dumbbell className="size-4" />
              <SheetTitle>CoachOS</SheetTitle>
            </SheetHeader>
            <nav className="space-y-1 p-3">
              {coachNav.map((item) => {
                const Icon = item.icon
                const active =
                  item.href === "/dashboard"
                    ? pathname === item.href
                    : pathname.startsWith(item.href)
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium",
                      active
                        ? "bg-primary/10 text-primary"
                        : "text-muted-foreground hover:bg-muted"
                    )}
                  >
                    <Icon className="size-4" />
                    {item.label}
                  </Link>
                )
              })}
            </nav>
          </SheetContent>
        </Sheet>
      </div>

      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          className="text-muted-foreground hidden gap-1.5 sm:inline-flex"
          onClick={() => window.dispatchEvent(new Event("open-command-palette"))}
          aria-label="Open command palette"
        >
          <Search className="size-4" />
          <span className="text-xs">Search</span>
          <kbd className="text-[10px] opacity-70">⌘K</kbd>
        </Button>
        <Button asChild variant="ghost" size="icon" className="relative">
          <Link href="/notifications" aria-label="Notifications">
            <Bell className="size-5" />
            {alertCount > 0 ? (
              <span className="bg-red-500 text-white absolute -top-0.5 -right-0.5 flex size-4 items-center justify-center rounded-full text-[10px] font-semibold">
                {alertCount > 9 ? "9+" : alertCount}
              </span>
            ) : null}
          </Link>
        </Button>
        {devMode ? (
          <div className="bg-primary/10 text-primary flex size-7 items-center justify-center rounded-full text-xs font-semibold">
            DC
          </div>
        ) : (
          <UserButton />
        )}
      </div>
    </header>
  )
}
