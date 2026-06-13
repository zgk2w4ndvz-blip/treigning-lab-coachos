"use client"

import { usePathname, useRouter, useSearchParams } from "next/navigation"

import { RANGE_OPTIONS } from "@/lib/utils/range"
import { cn } from "@/lib/utils"

/** Segmented 7 / 30 / 90-day control that drives the `?range=` query param. */
export function RangeSelector({ value }: { value: number }) {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()

  function setRange(days: number) {
    const next = new URLSearchParams(params)
    next.set("range", String(days))
    router.replace(`${pathname}?${next.toString()}`, { scroll: false })
  }

  return (
    <div className="bg-muted inline-flex items-center rounded-md p-0.5 text-sm">
      {RANGE_OPTIONS.map((d) => (
        <button
          key={d}
          type="button"
          onClick={() => setRange(d)}
          className={cn(
            "rounded px-2.5 py-1 font-medium transition-colors",
            value === d
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          {d}d
        </button>
      ))}
    </div>
  )
}
