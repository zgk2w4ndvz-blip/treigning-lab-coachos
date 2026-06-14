import Link from "next/link"
import { ArrowLeft } from "lucide-react"

import { requireCoach } from "@/lib/auth"
import { DEV_AUTH_BYPASS } from "@/lib/dev"
import { listRosterClients } from "@/lib/data/client-repo"
import { PageHeader } from "@/components/shared/page-header"
import { Button } from "@/components/ui/button"
import { ImportRosterClient } from "@/components/coach/import-roster-client"
import fs from "node:fs"
import path from "node:path"

/** Local-store import timestamp — dev bypass only (no .dev-data in prod). */
function localImportedAt(): string | null {
  try {
    const raw = JSON.parse(
      fs.readFileSync(path.join(process.cwd(), ".dev-data", "roster.json"), "utf8")
    ) as { importedAt?: string }
    return raw.importedAt ?? null
  } catch {
    return null
  }
}

export default async function ImportRosterPage() {
  await requireCoach()
  // Reflects the real roster: Supabase `clients` in production, the local store
  // in dev bypass (listRosterClients branches on DEV_AUTH_BYPASS).
  const roster = await listRosterClients()
  const count = roster.length

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6 p-6 md:p-8">
      <div>
        <Button asChild variant="ghost" size="sm" className="-ml-2 mb-2">
          <Link href="/settings">
            <ArrowLeft className="size-4" />
            Back to settings
          </Link>
        </Button>
        <PageHeader
          title="Import Roster"
          description="Add or replace your roster via CSV. Imported athletes drive the entire app."
        />
      </div>

      <ImportRosterClient
        active={count > 0}
        count={count}
        importedAt={DEV_AUTH_BYPASS && count > 0 ? localImportedAt() : null}
        bypass={DEV_AUTH_BYPASS}
      />
    </main>
  )
}
