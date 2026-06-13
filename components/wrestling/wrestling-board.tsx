"use client"

import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { EmptyState } from "@/components/shared/empty-state"
import { PaceBadge, RiskBadge } from "@/components/wrestling/pace-risk-badges"
import { initials, formatDateShort, relativeDays } from "@/lib/utils/format"
import { cn } from "@/lib/utils"
import { Swords } from "lucide-react"
import type { WrestlingCutRow } from "@/types/models"

type Filter = "all" | "off" | "high" | "soon"

const lb = (n: number | null | undefined) =>
  n == null ? "—" : `${n.toFixed(1)}`

export function WrestlingBoard({ rows }: { rows: WrestlingCutRow[] }) {
  const router = useRouter()
  const [filter, setFilter] = useState<Filter>("all")

  const filtered = useMemo(() => {
    switch (filter) {
      case "off":
        return rows.filter((r) => r.pace === "off")
      case "high":
        return rows.filter((r) => r.risk === "high")
      case "soon":
        return rows.filter((r) => r.daysToWeighIn != null && r.daysToWeighIn <= 14)
      default:
        return rows
    }
  }, [rows, filter])

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-lg font-semibold">Cut board</h2>
        <Select value={filter} onValueChange={(v) => setFilter(v as Filter)}>
          <SelectTrigger className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All cuts</SelectItem>
            <SelectItem value="off">Off pace</SelectItem>
            <SelectItem value="high">High risk</SelectItem>
            <SelectItem value="soon">Weigh-in ≤14 days</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={Swords} title="No wrestling cuts" description="No active wrestling cuts match this filter." />
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Wrestler</TableHead>
                <TableHead>Weigh-in</TableHead>
                <TableHead className="text-right">Current</TableHead>
                <TableHead className="text-right">Target</TableHead>
                <TableHead className="text-right">Projected</TableHead>
                <TableHead className="text-right">To go</TableHead>
                <TableHead className="text-right">Wk target</TableHead>
                <TableHead className="text-right">Daily target</TableHead>
                <TableHead className="text-right">Daily rate</TableHead>
                <TableHead className="text-right">%BW/day</TableHead>
                <TableHead>Pace</TableHead>
                <TableHead>Risk</TableHead>
                <TableHead className="text-right">Readiness</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((r) => (
                <TableRow
                  key={r.cutId}
                  className="cursor-pointer"
                  onClick={() => router.push(`/clients/${r.clientId}/combat`)}
                >
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Avatar className="size-7">
                        <AvatarImage src={r.avatarUrl ?? undefined} />
                        <AvatarFallback className="text-[10px]">{initials(r.name)}</AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium leading-tight">{r.name}</p>
                        <p className="text-muted-foreground text-xs">{r.className} class</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-sm">
                    {r.weighInAt ? (
                      <>
                        {formatDateShort(r.weighInAt)}
                        <span className="text-muted-foreground"> · {relativeDays(r.weighInAt)}</span>
                      </>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{lb(r.currentLbs)}</TableCell>
                  <TableCell className="text-right tabular-nums">{lb(r.targetLbs)}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {lb(r.projectedLbs)}
                    {r.paceDeltaLbs != null ? (
                      <span
                        className={cn(
                          "ml-1 text-xs",
                          r.paceDeltaLbs <= 1
                            ? "text-emerald-600 dark:text-emerald-500"
                            : "text-red-600 dark:text-red-500"
                        )}
                      >
                        {r.paceDeltaLbs > 0 ? `+${r.paceDeltaLbs}` : r.paceDeltaLbs}
                      </span>
                    ) : null}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{lb(r.toGoLbs)}</TableCell>
                  <TableCell className="text-right tabular-nums">{lb(r.weeklyLossTargetLbs)}</TableCell>
                  <TableCell className="text-right tabular-nums">{lb(r.dailyLossTargetLbs)}</TableCell>
                  <TableCell className="text-right tabular-nums">{lb(r.dailyLossRateLbs)}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {r.pctBodyweightPerDay != null ? (
                      <span
                        className={cn(
                          r.pctBodyweightPerDay >= 1.5
                            ? "text-red-600 dark:text-red-500"
                            : r.pctBodyweightPerDay >= 1
                              ? "text-amber-600 dark:text-amber-500"
                              : ""
                        )}
                      >
                        {r.pctBodyweightPerDay}%
                      </span>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                  <TableCell><PaceBadge pace={r.pace} /></TableCell>
                  <TableCell><RiskBadge risk={r.risk} /></TableCell>
                  <TableCell className="text-right tabular-nums">{r.readiness}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}
