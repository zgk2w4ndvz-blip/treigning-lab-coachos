"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Search, Users, AlertTriangle, ArrowDownUp } from "lucide-react"

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
  rosterName,
  compareByLastFirst,
  initials,
  formatDateShort,
  relativeDays,
} from "@/lib/utils/format"
import type { ClientListItem, ClientStatus } from "@/types/models"

type StatusFilter = ClientStatus | "all"
type SortKey = "last_asc" | "last_desc" | "modified_desc" | "modified_asc"

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: "last_asc", label: "Last Name A → Z" },
  { value: "last_desc", label: "Last Name Z → A" },
  { value: "modified_desc", label: "Recently Modified" },
  { value: "modified_asc", label: "Oldest Modified" },
]

/** Epoch millis for an updated_at; missing/invalid sorts to 0 (last). */
function modifiedTime(item: ClientListItem): number {
  const t = item.client.updated_at ? Date.parse(item.client.updated_at) : NaN
  return Number.isNaN(t) ? 0 : t
}

export function ClientRoster({ items }: { items: ClientListItem[] }) {
  const router = useRouter()
  const [query, setQuery] = useState("")
  const [status, setStatus] = useState<StatusFilter>("all")
  const [sort, setSort] = useState<SortKey>("last_asc")

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    const matched = items.filter(({ client }) => {
      if (status !== "all" && client.status !== status) return false
      if (!q) return true
      // Searchable text covers both name orders so "Julian", "Ramirez",
      // "Julian Ramirez", and "Ramirez, Julian" all match.
      const haystack = [
        client.first_name,
        client.last_name,
        fullName(client.first_name, client.last_name),
        rosterName(client.first_name, client.last_name),
        client.sport,
        client.discipline,
        client.email,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
      return haystack.includes(q)
    })

    // All clients are loaded up front, so sorting is client-side. Name compare
    // is by last name then first (locale-aware, case-insensitive); "modified"
    // uses clients.updated_at.
    const sorted = [...matched]
    sorted.sort((a, b) => {
      switch (sort) {
        case "last_desc":
          return -compareByLastFirst(a.client, b.client)
        case "modified_desc":
          return modifiedTime(b) - modifiedTime(a)
        case "modified_asc":
          return modifiedTime(a) - modifiedTime(b)
        case "last_asc":
        default:
          return compareByLastFirst(a.client, b.client)
      }
    })
    return sorted
  }, [items, query, status, sort])

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
        <Select value={sort} onValueChange={(v) => setSort(v as SortKey)}>
          <SelectTrigger className="w-full sm:w-48" aria-label="Sort clients">
            <ArrowDownUp className="text-muted-foreground size-4" />
            <SelectValue placeholder="Sort" />
          </SelectTrigger>
          <SelectContent>
            {SORT_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
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
                          {rosterName(client.first_name, client.last_name)}
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
