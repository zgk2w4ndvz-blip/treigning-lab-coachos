import { notFound } from "next/navigation"

import { requireCoach } from "@/lib/auth"
import { getClientSnapshot } from "@/lib/data/clients"
import { ClientHeader } from "@/components/coach/client-header"
import { ClientTabs } from "@/components/coach/client-tabs"

export default async function ClientDetailLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ clientId: string }>
}) {
  await requireCoach()
  const { clientId } = await params
  // Reuse the existing snapshot reader so the persistent header carries the
  // readiness / weight / next-competition snapshot (no new backend).
  const snap = await getClientSnapshot(clientId)
  if (!snap) notFound()

  return (
    <div className="flex flex-1 flex-col gap-4 p-6 md:p-8">
      <ClientHeader snap={snap} />
      <ClientTabs clientId={clientId} />
      <div className="flex-1">{children}</div>
    </div>
  )
}
