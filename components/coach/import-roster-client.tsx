"use client"

import { useMemo, useRef, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Upload, FileText, Trash2, Copy, CheckCircle2, AlertTriangle, Bug } from "lucide-react"

import {
  ROSTER_COLUMNS,
  SAMPLE_CSV,
  parseRosterCsv,
} from "@/lib/import/csv"
import {
  importRosterAction,
  clearRosterAction,
  type ImportResult,
} from "@/lib/actions/import-roster"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

interface Props {
  active: boolean
  count: number
  importedAt: string | null
  bypass: boolean
}

export function ImportRosterClient({ active, count, importedAt, bypass }: Props) {
  const router = useRouter()
  const [text, setText] = useState("")
  const [pending, start] = useTransition()
  const fileRef = useRef<HTMLInputElement>(null)
  // Last save outcome (server result) + any thrown client-side error, for debug.
  const [lastResult, setLastResult] = useState<ImportResult | null>(null)
  const [clientError, setClientError] = useState<string | null>(null)

  const parsed = useMemo(
    () => (text.trim() ? parseRosterCsv(text) : { athletes: [], errors: [] }),
    [text]
  )

  function loadFile(file: File) {
    const reader = new FileReader()
    reader.onload = () => setText(String(reader.result ?? ""))
    reader.readAsText(file)
  }

  function doImport() {
    setClientError(null)
    start(async () => {
      try {
        const res = await importRosterAction(text)
        setLastResult(res)
        if (res.ok) {
          toast.success(
            res.fellBackToLocal
              ? `Saved ${res.count} athletes to local dev storage (the database was unavailable).`
              : `Imported ${res.count} athletes — now showing your roster.`
          )
          if (res.rowErrors?.length)
            toast.message(`${res.rowErrors.length} row note(s) — see preview.`)
          // Keep the editor text so the debug panel stays populated.
          router.refresh()
        } else {
          toast.error(res.error ?? "Import failed.")
        }
      } catch (err) {
        // A thrown/“Failed to fetch” error must never crash the page.
        const message = err instanceof Error ? err.message : String(err)
        setLastResult(null)
        setClientError(message)
        toast.error(
          "Couldn't reach the server, so nothing was imported. See the debug panel for the exact error."
        )
      }
    })
  }

  function doClear() {
    if (!confirm("Restore the demo athletes and remove your imported roster?")) return
    start(async () => {
      try {
        const res = await clearRosterAction()
        if (res.ok) {
          toast.success("Restored demo data.")
          router.refresh()
        } else {
          toast.error(res.error ?? "Failed.")
        }
      } catch {
        toast.error("Couldn't reach the server. Please try again.")
      }
    })
  }

  return (
    <div className="space-y-6">
      {/* DEBUG PANEL — visible diagnostics for the import flow */}
      <Card className="border-dashed border-fuchsia-400/60 bg-fuchsia-50/40 dark:bg-fuchsia-950/10">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm">
            <Bug className="size-4" /> Import debug
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-xs">
          <dl className="grid grid-cols-[150px_1fr] gap-x-3 gap-y-1">
            <dt className="text-muted-foreground">1. DEV_AUTH_BYPASS</dt>
            <dd className="font-mono">
              {String(bypass)}
              {lastResult?.bypass !== undefined
                ? `  (last request: ${String(lastResult.bypass)})`
                : ""}
            </dd>

            <dt className="text-muted-foreground">2. Save target</dt>
            <dd className="font-mono">
              {(lastResult?.savedTo ?? (bypass ? "local" : "supabase")) === "local"
                ? "local dev storage (.dev-data/roster.json)"
                : "Supabase (clients table)"}
              {lastResult?.fellBackToLocal ? "  — fell back from Supabase" : ""}
            </dd>

            <dt className="text-muted-foreground">3. Parsed rows</dt>
            <dd className="font-mono">
              {parsed.athletes.length}
              {parsed.errors.length ? `  (${parsed.errors.length} note(s))` : ""}
            </dd>

            <dt className="text-muted-foreground">5. Last save</dt>
            <dd className="font-mono">
              {clientError
                ? "threw — see error below"
                : lastResult
                  ? lastResult.ok
                    ? `ok · ${lastResult.count} saved`
                    : "failed — see error below"
                  : "— not run yet"}
            </dd>
          </dl>

          <div>
            <p className="text-muted-foreground mb-1">4. First parsed athlete</p>
            <pre className="bg-muted overflow-x-auto rounded p-2 text-[11px] leading-snug">
              {JSON.stringify(parsed.athletes[0] ?? null, null, 2)}
            </pre>
          </div>

          {clientError || lastResult?.error || lastResult?.supabaseError ? (
            <div>
              <p className="mb-1 font-medium text-red-600 dark:text-red-400">
                Exact error
              </p>
              <pre className="overflow-x-auto rounded border border-red-300 bg-red-50 p-2 text-[11px] text-red-800 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">
                {clientError ?? lastResult?.error ?? ""}
                {lastResult?.supabaseError
                  ? `\n[supabase] ${lastResult.supabaseError}`
                  : ""}
              </pre>
            </div>
          ) : null}
        </CardContent>
      </Card>

      {!bypass ? (
        <Card className="border-amber-300 dark:border-amber-900">
          <CardContent className="flex items-start gap-3 p-4 text-sm">
            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-400" />
            <p>
              CSV import writes to local mock data and is available in{" "}
              <strong>dev bypass mode</strong> only. Set{" "}
              <code className="text-xs">NEXT_PUBLIC_DEV_AUTH_BYPASS=true</code> and restart.
            </p>
          </CardContent>
        </Card>
      ) : null}

      {/* current status */}
      <Card>
        <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
          <div className="flex items-center gap-2 text-sm">
            {active ? (
              <>
                <CheckCircle2 className="size-4 text-emerald-600 dark:text-emerald-500" />
                <span>
                  Showing <strong>your imported roster</strong> — {count} athlete
                  {count === 1 ? "" : "s"}
                  {importedAt ? ` · imported ${new Date(importedAt).toLocaleString()}` : ""}
                </span>
              </>
            ) : (
              <>
                <Badge variant="secondary">Demo data</Badge>
                <span className="text-muted-foreground">
                  Showing the seeded demo athletes. Import a CSV to replace them.
                </span>
              </>
            )}
          </div>
          {active ? (
            <Button variant="outline" size="sm" onClick={doClear} disabled={pending}>
              <Trash2 className="size-4" />
              Restore demo data
            </Button>
          ) : null}
        </CardContent>
      </Card>

      {/* instructions */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">CSV format</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-muted-foreground text-sm">
            The first row must be a header with these column names (any order). Only{" "}
            <strong>first_name</strong> and <strong>last_name</strong> are required.
          </p>
          <div className="overflow-x-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Column</TableHead>
                  <TableHead>Required</TableHead>
                  <TableHead>Example</TableHead>
                  <TableHead>Notes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ROSTER_COLUMNS.map((c) => (
                  <TableRow key={c.key}>
                    <TableCell className="font-mono text-xs">{c.key}</TableCell>
                    <TableCell>
                      {c.required ? (
                        <Badge variant="secondary" className="bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300">Required</Badge>
                      ) : (
                        <span className="text-muted-foreground text-xs">Optional</span>
                      )}
                    </TableCell>
                    <TableCell className="text-xs">{c.example}</TableCell>
                    <TableCell className="text-muted-foreground text-xs">{c.note}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                navigator.clipboard.writeText(SAMPLE_CSV)
                toast.success("Sample CSV copied")
              }}
            >
              <Copy className="size-4" />
              Copy sample CSV
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setText(SAMPLE_CSV)}>
              Paste sample into editor
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* paste / upload */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Paste or upload CSV</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <input
            ref={fileRef}
            type="file"
            accept=".csv,text/csv,text/plain"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) loadFile(f)
              e.target.value = ""
            }}
          />
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
              <Upload className="size-4" />
              Upload .csv file
            </Button>
            {text ? (
              <Button variant="ghost" size="sm" onClick={() => setText("")}>
                Clear editor
              </Button>
            ) : null}
          </div>
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="first_name,last_name,email,...&#10;Alex,Rivera,alex@email.com,..."
            rows={8}
            className="font-mono text-xs"
          />

          {/* preview */}
          {text.trim() ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm">
                <FileText className="size-4" />
                <span>
                  {parsed.athletes.length} athlete{parsed.athletes.length === 1 ? "" : "s"} parsed
                </span>
                {parsed.errors.length > 0 ? (
                  <Badge variant="secondary" className="bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300">
                    {parsed.errors.length} note{parsed.errors.length === 1 ? "" : "s"}
                  </Badge>
                ) : null}
              </div>

              {parsed.athletes.length > 0 ? (
                <div className="max-h-56 overflow-auto rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Sport</TableHead>
                        <TableHead>Class</TableHead>
                        <TableHead className="text-right">Current</TableHead>
                        <TableHead className="text-right">Goal</TableHead>
                        <TableHead>Next comp</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {parsed.athletes.slice(0, 50).map((a) => (
                        <TableRow key={a.id}>
                          <TableCell className="font-medium">{a.firstName} {a.lastName}</TableCell>
                          <TableCell className="text-sm">{a.sport ?? "—"}</TableCell>
                          <TableCell className="text-sm">{a.weightClass ?? "—"}</TableCell>
                          <TableCell className="text-right tabular-nums">{a.currentWeight ?? "—"}</TableCell>
                          <TableCell className="text-right tabular-nums">{a.goalWeight ?? "—"}</TableCell>
                          <TableCell className="text-sm">
                            {a.nextCompetition ?? "—"}
                            {a.competitionDate ? ` (${a.competitionDate})` : ""}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : null}

              {parsed.errors.length > 0 ? (
                <ul className="space-y-0.5 text-xs text-amber-700 dark:text-amber-400">
                  {parsed.errors.slice(0, 8).map((e, i) => (
                    <li key={i} className="flex items-start gap-1.5">
                      <AlertTriangle className="mt-0.5 size-3 shrink-0" />
                      {e}
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : null}

          <div className="flex justify-end">
            <Button
              onClick={doImport}
              disabled={pending || !bypass || parsed.athletes.length === 0}
            >
              {pending ? "Importing…" : `Import ${parsed.athletes.length || ""} athletes`.trim()}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
