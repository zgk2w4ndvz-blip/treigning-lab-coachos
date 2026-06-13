import Link from "next/link"
import {
  Dumbbell,
  Utensils,
  Droplets,
  Pill,
  HeartPulse,
  Trophy,
  ListTodo,
  Scale,
  Bell,
} from "lucide-react"

import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { PriorityBadge, SeverityBadge } from "@/components/shared/badges"
import {
  AgendaPriorityBadge,
  priorityBorder,
} from "@/components/coach/agenda-priority-badge"
import { cn } from "@/lib/utils"
import {
  fullName,
  initials,
  relativeDays,
} from "@/lib/utils/format"
import type { AthleteAgenda } from "@/types/models"

function Section({
  icon: Icon,
  label,
  children,
}: {
  icon: typeof Dumbbell
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="space-y-1">
      <p className="text-muted-foreground flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide">
        <Icon className="size-3.5" />
        {label}
      </p>
      <div className="text-sm">{children}</div>
    </div>
  )
}

const none = <span className="text-muted-foreground">—</span>

export function AgendaCard({ agenda }: { agenda: AthleteAgenda }) {
  const { client } = agenda
  const name = fullName(client.first_name, client.last_name)

  return (
    <Card className={cn("flex flex-col border-l-4", priorityBorder(agenda.priority))}>
      <CardHeader className="flex-row items-center justify-between gap-2 space-y-0 pb-3">
        <Link href={`/clients/${client.id}`} className="flex min-w-0 items-center gap-2.5 hover:underline">
          <Avatar className="size-9">
            <AvatarImage src={client.avatar_url ?? undefined} />
            <AvatarFallback className="text-xs">{initials(name)}</AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="truncate font-semibold leading-tight">{name}</p>
            <p className="text-muted-foreground truncate text-xs">
              {client.sport ?? "—"}
              {client.current_weight_class ? ` · ${client.current_weight_class}` : ""}
            </p>
          </div>
        </Link>
        <div className="flex shrink-0 items-center gap-1.5">
          {agenda.weighInToday ? (
            <Badge className="bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300">
              <Scale className="mr-1 size-3" />
              Weigh-in
            </Badge>
          ) : null}
          <AgendaPriorityBadge
            priority={agenda.priority}
            reasons={agenda.priorityReasons}
          />
        </div>
      </CardHeader>

      <CardContent className="flex-1 space-y-3.5 border-t pt-3.5">
        {/* readiness + compliance + alert count */}
        <div className="grid grid-cols-3 gap-2 text-center">
          <ScorePill
            label="Readiness"
            value={agenda.readiness != null ? `${agenda.readiness}` : "—"}
            score={agenda.readiness}
          />
          <ScorePill
            label="Compliance"
            value={`${agenda.compliance}%`}
            score={agenda.compliance}
          />
          <ScorePill
            label="Alerts"
            value={`${agenda.alerts.length}`}
            score={agenda.alerts.length === 0 ? 100 : agenda.alerts.some((a) => a.severity === "critical") ? 30 : 60}
          />
        </div>

        {agenda.alerts.length > 0 ? (
          <Section icon={Bell} label="Open alerts">
            <ul className="space-y-1">
              {agenda.alerts.slice(0, 3).map((a) => (
                <li key={a.id} className="flex items-start gap-2">
                  <SeverityBadge severity={a.severity} />
                  <span className="min-w-0 flex-1 truncate">{a.title}</span>
                </li>
              ))}
              {agenda.alerts.length > 3 ? (
                <li className="text-muted-foreground text-xs">
                  +{agenda.alerts.length - 3} more
                </li>
              ) : null}
            </ul>
          </Section>
        ) : null}

        <Section icon={Dumbbell} label="Today's training">
          {agenda.training.length === 0 ? (
            <span className="text-muted-foreground">Rest day</span>
          ) : (
            <ul className="space-y-0.5">
              {agenda.training.map((s) => (
                <li key={s.id} className="flex items-center justify-between gap-2">
                  <span className="capitalize">{s.session_type ?? "Session"}</span>
                  <span className="text-muted-foreground text-xs">
                    {s.duration_min ? `${s.duration_min} min` : ""}
                    {s.completed_at ? " · done" : ""}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section icon={Utensils} label="Fuel targets">
          <div className="flex flex-wrap gap-1.5">
            <Chip
              icon={Utensils}
              value={agenda.caloriesTarget != null ? `${agenda.caloriesTarget} kcal` : "—"}
            />
            <Chip
              label="P"
              value={agenda.proteinTarget != null ? `${agenda.proteinTarget} g` : "—"}
            />
            <Chip
              icon={Droplets}
              value={agenda.waterTargetOz != null ? `${agenda.waterTargetOz} oz` : "—"}
            />
          </div>
        </Section>

        <Section icon={Pill} label="Supplements">
          {agenda.supplements.length === 0 ? (
            none
          ) : (
            <ul className="space-y-0.5">
              {agenda.supplements.map((s) => (
                <li key={s.id} className="flex items-center justify-between gap-2">
                  <span className="truncate">{s.name}</span>
                  <span className="text-muted-foreground shrink-0 text-xs">
                    {[s.dosage, s.timing].filter(Boolean).join(" · ")}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section icon={HeartPulse} label="Recovery goals">
          <div className="flex items-center justify-between gap-2">
            <span>Sleep ≥ {agenda.recovery.sleepTargetH}h · soreness ≤ 4</span>
            <span className="text-muted-foreground text-xs">
              last:{" "}
              {agenda.recovery.latestSleepH != null
                ? `${agenda.recovery.latestSleepH}h`
                : "—"}
              {agenda.recovery.latestSoreness != null
                ? ` · S${agenda.recovery.latestSoreness}`
                : ""}
            </span>
          </div>
        </Section>

        <Section icon={Trophy} label="Competition prep">
          {agenda.competitionTasks.length === 0 ? (
            none
          ) : (
            <ul className="space-y-0.5">
              {agenda.competitionTasks.map((t) => (
                <li key={t.id} className="flex items-center justify-between gap-2">
                  <span className="truncate">{t.task}</span>
                  {t.dueDate ? (
                    <span className="text-muted-foreground shrink-0 text-xs">
                      {relativeDays(t.dueDate)}
                    </span>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section icon={ListTodo} label="Coach reminders">
          {agenda.reminders.length === 0 ? (
            none
          ) : (
            <ul className="space-y-1">
              {agenda.reminders.map((r) => (
                <li key={r.id} className="flex items-center justify-between gap-2">
                  <span className="truncate">{r.title}</span>
                  <PriorityBadge priority={r.priority} />
                </li>
              ))}
            </ul>
          )}
        </Section>
      </CardContent>
    </Card>
  )
}

function Chip({
  icon: Icon,
  label,
  value,
}: {
  icon?: typeof Dumbbell
  label?: string
  value: string
}) {
  return (
    <span className="bg-muted inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium tabular-nums">
      {Icon ? <Icon className="size-3" /> : null}
      {label ? <span className="text-muted-foreground">{label}</span> : null}
      {value}
    </span>
  )
}

function ScorePill({
  label,
  value,
  score,
}: {
  label: string
  value: string
  score: number | null
}) {
  const tone =
    score == null
      ? "text-muted-foreground"
      : score >= 80
        ? "text-emerald-600 dark:text-emerald-500"
        : score >= 50
          ? "text-amber-600 dark:text-amber-500"
          : "text-red-600 dark:text-red-500"
  return (
    <div className="bg-muted/50 rounded-md py-1.5">
      <p className={cn("text-lg font-bold tabular-nums leading-none", tone)}>
        {value}
      </p>
      <p className="text-muted-foreground mt-0.5 text-[10px] uppercase tracking-wide">
        {label}
      </p>
    </div>
  )
}
