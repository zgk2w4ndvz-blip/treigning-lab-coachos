import { Card, Skeleton } from "@/components/ds"

export default function NotificationsLoading() {
  return (
    <main className="flex flex-1 flex-col gap-4 p-6 md:p-8">
      <Skeleton className="h-6 w-44" />
      <div className="flex gap-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-7 w-20 rounded-pill" />
        ))}
      </div>
      <Card>
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex gap-3">
              <Skeleton className="size-7 rounded-control" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-3.5 w-1/2" />
                <Skeleton className="h-3 w-3/4" />
              </div>
            </div>
          ))}
        </div>
      </Card>
    </main>
  )
}
