import Link from "next/link"
import { Pencil, MessageSquare } from "lucide-react"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button, Badge } from "@/components/ds"
import { DeleteClientButton } from "@/components/coach/delete-client-button"
import { fullName, initials, formatWeight, relativeDays } from "@/lib/utils/format"
import type { ClientSnapshot } from "@/types/models"

type BadgeTone = "neutral" | "primary" | "positive" | "warning" | "attention" | "danger"

function statusTone(status: string): BadgeTone {
  if (status === "active") return "positive"
  if (status === "prospect") return "primary"
  return "neutral"
}

function complianceTone(score: number): BadgeTone {
  return score >= 80 ? "positive" : score >= 50 ? "warning" : "danger"
}

/** One compact snapshot stat in the persistent header. */
function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col">
      <span className="text-[11px] text-ds-text-muted">{label}</span>
      <span className="text-sm font-medium text-ds-text-primary">{value}</span>
    </div>
  )
}

// Persistent athlete header (U3) — stays fixed across every athlete tab. Built on
// U0 tokens + U1 primitives. Reuses the existing ClientSnapshot reader (no new
// backend); shows identity + a readiness / weight / next-competition snapshot +
// quick actions. Read-only.
export function ClientHeader({ snap }: { snap: ClientSnapshot }) {
  const { client, latestWeight, weightGoal, latestRecovery, nextCompetition, complianceScore } = snap
  const name = fullName(client.first_name, client.last_name)
  const meta = [client.sport, client.discipline, client.current_weight_class]
    .filter(Boolean)
    .join(" · ")

  return (
    <div className="rounded-card border border-ds-border bg-ds-surface-1 p-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <Avatar className="size-12">
            <AvatarImage src={client.avatar_url ?? undefined} />
            <AvatarFallback className="bg-ds-surface-2 text-ds-text-secondary">
              {initials(name)}
            </AvatarFallback>
          </Avatar>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-sans text-lg font-medium tracking-normal text-ds-text-primary">
                {name}
              </h1>
              <Badge tone={statusTone(client.status)}>{client.status}</Badge>
            </div>
            {meta ? <p className="mt-0.5 text-xs text-ds-text-muted">{meta}</p> : null}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button asChild variant="secondary" size="sm">
            <Link href={`/clients/${client.id}/messages`}>
              <MessageSquare className="size-4" />
              Message
            </Link>
          </Button>
          <Button asChild variant="secondary" size="sm">
            <Link href={`/clients/${client.id}/edit`}>
              <Pencil className="size-4" />
              Edit
            </Link>
          </Button>
          <DeleteClientButton clientId={client.id} name={name} variant="full" />
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-x-8 gap-y-3 border-t border-ds-border pt-3">
        <Stat
          label="Readiness"
          value={
            <span className="flex items-center gap-1.5">
              <Badge tone={complianceTone(complianceScore)}>{complianceScore}%</Badge>
              {latestRecovery?.sleep_hours != null ? (
                <span className="text-xs text-ds-text-secondary">
                  {latestRecovery.sleep_hours}h sleep
                </span>
              ) : null}
            </span>
          }
        />
        <Stat
          label="Weight"
          value={
            <>
              {formatWeight(latestWeight?.weight_lbs ?? null)}
              {weightGoal?.target_weight ? (
                <span className="text-ds-text-muted"> → {formatWeight(weightGoal.target_weight)}</span>
              ) : null}
            </>
          }
        />
        <Stat
          label="Next competition"
          value={
            nextCompetition ? (
              <>
                {nextCompetition.name}
                <span className="text-ds-text-muted"> · {relativeDays(nextCompetition.competition_date)}</span>
              </>
            ) : (
              <span className="text-ds-text-muted">None scheduled</span>
            )
          }
        />
      </div>
    </div>
  )
}
