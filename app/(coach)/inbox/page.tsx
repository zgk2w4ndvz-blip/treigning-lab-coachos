import { Inbox, ShieldAlert, UserX, CheckCheck } from "lucide-react"

import { requireCoach } from "@/lib/auth"
import { getInbox } from "@/lib/data/inbox"
import { MessageImport } from "@/components/coach/message-import"
import { InboxQueue } from "@/components/coach/inbox-queue"
import { KpiCard, SectionHeader } from "@/components/ds"

// Inbox (U3) — the approval queue restyled on U0 tokens + U1 primitives. Reuses
// getInbox; all approve/edit/reject behavior and unmatched gating live unchanged
// in InboxQueue. Read-only at render; the only writes are the existing
// reviewSuggestionAction (coach-initiated).
export default async function InboxPage() {
  await requireCoach()
  const { items, stats } = await getInbox()

  return (
    <main className="flex flex-1 flex-col gap-5 p-6 md:p-8">
      <div>
        <h1 className="font-sans text-[22px] font-medium tracking-normal text-ds-text-primary">
          Inbox
        </h1>
        <p className="mt-1 text-sm text-ds-text-secondary">
          Ingested athlete messages become suggested actions. Review, edit, and approve — nothing is prescribed automatically.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Pending review" value={stats.pending} icon={<Inbox />} />
        <KpiCard label="Sensitive" value={stats.sensitive} icon={<ShieldAlert />} />
        <KpiCard label="Unmatched" value={stats.unmatched} icon={<UserX />} />
        <KpiCard label="Approved" value={stats.approved} icon={<CheckCheck />} />
      </div>

      <MessageImport />

      <SectionHeader
        title="Review queue"
        action={<span className="text-xs text-ds-text-muted">{stats.pending} pending</span>}
      />
      <InboxQueue items={items} />
    </main>
  )
}
