import { Inbox, ShieldAlert, UserX, CheckCheck } from "lucide-react"

import { requireCoach } from "@/lib/auth"
import { getInbox } from "@/lib/data/inbox"
import { PageHeader } from "@/components/shared/page-header"
import { StatCard } from "@/components/shared/stat-card"
import { MessageImport } from "@/components/coach/message-import"
import { InboxQueue } from "@/components/coach/inbox-queue"

export default async function InboxPage() {
  await requireCoach()
  const { items, stats } = await getInbox()

  return (
    <main className="flex flex-1 flex-col gap-6 p-6 md:p-8">
      <PageHeader
        title="Message Inbox"
        description="Ingested athlete messages become suggested actions. Review, edit, and approve — nothing is prescribed automatically."
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Pending review" value={stats.pending} icon={Inbox} accent={stats.pending > 0 ? "warning" : "default"} />
        <StatCard label="Sensitive" value={stats.sensitive} icon={ShieldAlert} accent={stats.sensitive > 0 ? "critical" : "default"} />
        <StatCard label="Unmatched" value={stats.unmatched} icon={UserX} accent={stats.unmatched > 0 ? "warning" : "default"} />
        <StatCard label="Approved" value={stats.approved} icon={CheckCheck} accent="success" />
      </div>

      <MessageImport />
      <InboxQueue items={items} />
    </main>
  )
}
