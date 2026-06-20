import Link from "next/link"
import { Plus, Upload, Pencil, Users } from "lucide-react"

import { requireCoach } from "@/lib/auth"
import { DEV_AUTH_BYPASS } from "@/lib/dev"
import { listRosterClients } from "@/lib/data/client-repo"
import { hasImportedRoster } from "@/lib/dev-roster-store"
import { PageHeader } from "@/components/shared/page-header"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { EmptyState } from "@/components/shared/empty-state"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { DeleteClientButton } from "@/components/coach/delete-client-button"
import { initials, fullName, rosterName, formatDate } from "@/lib/utils/format"

export default async function ManageRosterPage() {
  await requireCoach()
  const clients = await listRosterClients()

  // In dev bypass, an empty store means the demo athletes are showing.
  const showingDemo = DEV_AUTH_BYPASS && !hasImportedRoster()

  return (
    <main className="flex flex-1 flex-col gap-6 p-6 md:p-8">
      <PageHeader
        title="Manage Roster"
        description="Add, edit, delete, or import your athletes. Records are stored in Supabase (or the local roster store in dev bypass)."
        actions={
          <>
            <Button asChild variant="outline">
              <Link href="/settings/import">
                <Upload className="size-4" />
                Import CSV
              </Link>
            </Button>
            <Button asChild>
              <Link href="/clients/new">
                <Plus className="size-4" />
                Add client
              </Link>
            </Button>
          </>
        }
      />

      {clients.length === 0 ? (
        showingDemo ? (
          <Card className="border-amber-300 dark:border-amber-900">
            <CardContent className="flex flex-col items-start gap-3 p-5 text-sm">
              <span>
                <Badge variant="secondary" className="mr-2">Demo data</Badge>
                The app is currently showing seeded demo athletes. Add a client
                or import a CSV to start your real roster — the demo data
                disappears automatically across every page.
              </span>
              <div className="flex gap-2">
                <Button asChild>
                  <Link href="/clients/new">
                    <Plus className="size-4" />
                    Add client
                  </Link>
                </Button>
                <Button asChild variant="outline">
                  <Link href="/settings/import">
                    <Upload className="size-4" />
                    Import CSV
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <EmptyState
            icon={Users}
            title="No clients yet"
            description="Add your first athlete or import a CSV to build your roster."
            action={
              <Button asChild>
                <Link href="/clients/new">
                  <Plus className="size-4" />
                  Add client
                </Link>
              </Button>
            }
          />
        )
      ) : (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead className="hidden md:table-cell">Sport</TableHead>
                <TableHead>Class</TableHead>
                <TableHead className="text-right">Current</TableHead>
                <TableHead className="text-right">Goal</TableHead>
                <TableHead className="hidden lg:table-cell">Next competition</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {clients.map((a) => {
                // Initials stay first+last ("JV"); the list label is "Last, First".
                const name = fullName(a.firstName, a.lastName)
                return (
                  <TableRow key={a.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="size-8">
                          <AvatarFallback className="text-xs">{initials(name)}</AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <Link href={`/clients/${a.id}`} className="block truncate font-medium hover:underline">
                            {rosterName(a.firstName, a.lastName)}
                          </Link>
                          {a.email ? (
                            <p className="text-muted-foreground truncate text-xs">{a.email}</p>
                          ) : null}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-sm">{a.sport ?? "—"}</TableCell>
                    <TableCell className="text-sm">{a.weightClass ?? "—"}</TableCell>
                    <TableCell className="text-right tabular-nums">{a.currentWeight ?? "—"}</TableCell>
                    <TableCell className="text-right tabular-nums">{a.goalWeight ?? "—"}</TableCell>
                    <TableCell className="hidden lg:table-cell text-sm">
                      {a.nextCompetition ?? "—"}
                      {a.competitionDate ? (
                        <span className="text-muted-foreground"> · {formatDate(a.competitionDate)}</span>
                      ) : null}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-1">
                        <Button asChild variant="ghost" size="icon" className="size-8" aria-label={`Edit ${name}`}>
                          <Link href={`/clients/${a.id}/edit`}>
                            <Pencil className="size-4" />
                          </Link>
                        </Button>
                        <DeleteClientButton clientId={a.id} name={name} />
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </main>
  )
}
