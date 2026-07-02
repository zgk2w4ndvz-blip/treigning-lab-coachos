import { Card, Skeleton } from "@/components/ds"

// Loading state (U4 polish) — ds skeletons matching the Reports layout.
export default function ReportsLoading() {
  return (
    <main className="flex flex-1 flex-col gap-5 p-6 md:p-8">
      <Skeleton className="h-6 w-40" />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i}>
            <Skeleton className="h-3 w-24" />
            <Skeleton className="mt-3 h-7 w-16" />
          </Card>
        ))}
      </div>
      <Card>
        <Skeleton className="h-4 w-40" />
        <div className="mt-3 space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-8 w-full" />
          ))}
        </div>
      </Card>
    </main>
  )
}
