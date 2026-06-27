import * as React from "react"

import { cn } from "@/lib/utils"

// Design-system loading skeleton (DESIGN_SYSTEM.md §3). Token-driven shimmer block
// on the elevated surface. Additive (U1); the existing ui/skeleton is untouched.
function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="ds-skeleton"
      aria-hidden="true"
      className={cn("animate-pulse rounded-control bg-ds-surface-2", className)}
      {...props}
    />
  )
}

// Convenience: a stack of skeleton text lines (the last is shortened).
function SkeletonText({
  lines = 3,
  className,
  ...props
}: React.ComponentProps<"div"> & { lines?: number }) {
  return (
    <div data-slot="ds-skeleton-text" className={cn("space-y-2", className)} {...props}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          className={cn("h-3", i === lines - 1 ? "w-2/3" : "w-full")}
        />
      ))}
    </div>
  )
}

export { Skeleton, SkeletonText }
