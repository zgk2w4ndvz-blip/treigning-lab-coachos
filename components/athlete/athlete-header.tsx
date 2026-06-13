"use client"

import { UserButton } from "@clerk/nextjs"
import { Dumbbell } from "lucide-react"

import { initials } from "@/lib/utils/format"

export function AthleteHeader({
  name,
  devMode = false,
}: {
  name: string
  devMode?: boolean
}) {
  return (
    <header className="bg-background/85 sticky top-0 z-20 flex h-14 items-center justify-between gap-3 border-b px-4 backdrop-blur">
      <div className="flex items-center gap-2">
        <div className="bg-primary/10 text-primary flex size-8 items-center justify-center rounded-md">
          <Dumbbell className="size-4" />
        </div>
        <div className="leading-tight">
          <p className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
            Treigning Lab
          </p>
          <p className="text-sm font-semibold">{name}</p>
        </div>
      </div>
      {devMode ? (
        <div className="bg-primary/10 text-primary flex size-8 items-center justify-center rounded-full text-xs font-semibold">
          {initials(name)}
        </div>
      ) : (
        <UserButton />
      )}
    </header>
  )
}
