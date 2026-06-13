import Link from "next/link"
import { ArrowLeft } from "lucide-react"

import { requireCoach } from "@/lib/auth"
import { DEV_AUTH_BYPASS } from "@/lib/dev"
import { readImportedAthletes } from "@/lib/dev-roster-store"
import { PageHeader } from "@/components/shared/page-header"
import { Button } from "@/components/ui/button"
import { ImportRosterClient } from "@/components/coach/import-roster-client"
import fs from "node:fs"
import path from "node:path"

function importedAt(): string | null {
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
  const athletes = readImportedAthletes()

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
          description="Replace the demo athletes with your real roster via CSV. Imported data drives the entire app."
        />
      </div>

      <ImportRosterClient
        active={athletes !== null}
        count={athletes?.length ?? 0}
        importedAt={athletes ? importedAt() : null}
        bypass={DEV_AUTH_BYPASS}
      />
    </main>
  )
}
