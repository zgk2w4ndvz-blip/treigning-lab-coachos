"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Search, Users, AlertTriangle } from "lucide-react"

import { Input } from "@/components/ui/input"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { ClientStatusBadge } from "@/components/shared/badges"
import { ComplianceBar } from "@/components/shared/compliance-bar"
import { EmptyState } from "@/components/shared/empty-state"
import {
  fullName,
  initials,
  formatDateShort,
  relativeDays,
} from "@/lib/utils/format"
import type { ClientListItem, ClientStatus } from "@/types/models"

type StatusFilter = ClientStatus | "all"

export function ClientRoster({ items }: { items: ClientListItem[] }) {
  const router = useRouter()
  const [query, setQuery] = useState("")
  const [status, setStatus] = useState<StatusFilter>("all")

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return items.filter(({ client }) => {
      if (status !== "all" && client.status !== status) return false
      if (!q) return true
      const haystack = [
        client.first_name,
        client.last_name,
        client.sport,
        client.discipline,
        client.email,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
      return haystack.includes(q)
    })
  }, [items, query, status])

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name, sport, email…"
            className="pl-9"
          />
        </div>
        <Select value={status} onValueChange={(v) => setStatus(v as StatusFilter)}>
          <SelectTrigger className="w-full sm:w-44">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="prospect">Prospect</SelectItem>
            <SelectItem value="inactive">Inactive</SelectItem>
            <SelectItem value="archived">Archived</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No clients found"
          description={
            items.length === 0
              ? "Add your first client to get started."
              : "Try adjusting your search or filters."
          }
        />
      ) : (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead className="hidden md:table-cell">Sport</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="hidden sm:table-cell text-right">Body fat</TableHead>
                <TableHead className="hidden lg:table-cell">Next comp</TableHead>
                <TableHead className="w-40">Compliance</TableHead>
                <TableHead className="text-right">Alerts</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map(({ client, nextCompetition, openAlertCount, complianceScore, latestBodyFatPct }) => (
                <TableRow
                  key={client.id}
                  className="cursor-pointer"
                  onClick={() => router.push(`/clients/${client.id}`)}
                >
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar className="size-8">
                        <AvatarImage src={client.avatar_url ?? undefined} />
                        <AvatarFallback className="text-xs">
                          {initials(fullName(client.first_name, client.last_name))}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <Link
                          href={`/clients/${client.id}`}
                          className="block truncate font-medium hover:underline"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {fullName(client.first_name, client.last_name)}
                        </Link>
                        {client.email ? (
                          <p className="text-muted-foreground truncate text-xs">
                            {client.email}
                          </p>
                        ) : null}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    <span className="text-sm">
                      {client.sport ?? "—"}
                      {client.discipline ? (
                        <span className="text-muted-foreground">
                          {" "}
                          · {client.discipline}
                        </span>
                      ) : null}
                    </span>
                  </TableCell>
                  <TableCell>
                    <ClientStatusBadge status={client.status} />
                  </TableCell>
                  <TableCell className="hidden sm:table-cell text-right tabular-nums text-sm">
                    {latestBodyFatPct != null ? (
                      `${latestBodyFatPct}%`
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="hidden lg:table-cell">
                    {nextCompetition ? (
                      <div className="text-sm">
                        {formatDateShort(nextCompetition.competition_date)}
                        <span className="text-muted-foreground">
                          {" "}
                          · {relativeDays(nextCompetition.competition_date)}
                        </span>
                      </div>
                    ) : (
                      <span className="text-muted-foreground text-sm">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <ComplianceBar score={complianceScore} />
                  </TableCell>
                  <TableCell className="text-right">
                    {openAlertCount > 0 ? (
                      <span className="inline-flex items-center gap-1 text-sm font-medium text-red-600 dark:text-red-500">
                        <AlertTriangle className="size-3.5" />
                        {openAlertCount}
                      </span>
                    ) : (
                      <span className="text-muted-foreground text-sm">—</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}
