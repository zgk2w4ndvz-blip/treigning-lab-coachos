import { ClipboardList } from "lucide-react"

import { requireCoach } from "@/lib/auth"
import { getPrescriptions } from "@/lib/data/prescriptions"
import { formatDate } from "@/lib/utils/format"
import { cn } from "@/lib/utils"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { EmptyState } from "@/components/shared/empty-state"
import type { SuggestionDomain } from "@/types/models"

const DOMAIN_LABELS: Record<SuggestionDomain, string> = {
  diet: "Diet", supplementation: "Supplementation", altolab: "AltoLab",
  low_base: "Low base", hydration: "Hydration", recovery: "Recovery",
  labs: "Labs", training: "Training",
}

const STATUS_TONE: Record<string, string> = {
  active: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  completed: "bg-muted text-muted-foreground",
  cancelled: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
}

export default async function PrescriptionsPage({
  params,
}: {
  params: Promise<{ clientId: string }>
}) {
  await requireCoach()
  const { clientId } = await params
  const prescriptions = await getPrescriptions(clientId)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Prescriptions</h2>
        <span className="text-muted-foreground text-sm">
          {prescriptions.length} total
        </span>
      </div>

      {prescriptions.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title="No prescriptions yet"
          description="Approved protocols from the message inbox appear here."
          className="py-10"
        />
      ) : (
        <div className="space-y-3">
          {prescriptions.map((p) => (
            <Card key={p.id}>
              <CardContent className="space-y-2 p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="secondary">
                    {DOMAIN_LABELS[p.domain] ?? p.domain}
                  </Badge>
                  <Badge className={cn("capitalize", STATUS_TONE[p.status])}>
                    {p.status}
                  </Badge>
                  <span className="text-muted-foreground ml-auto text-xs">
                    {formatDate(p.created_at)}
                  </span>
                </div>
                <p className="text-sm font-medium">{p.title}</p>
                <p className="text-sm">{p.protocol}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
