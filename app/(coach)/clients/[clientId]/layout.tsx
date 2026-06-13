import { notFound } from "next/navigation"

import { requireCoach } from "@/lib/auth"
import { getClientById } from "@/lib/data/clients"
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
  const client = await getClientById(clientId)
  if (!client) notFound()

  return (
    <div className="flex flex-1 flex-col gap-4 p-6 md:p-8">
      <ClientHeader client={client} />
      <ClientTabs clientId={clientId} />
      <div className="flex-1">{children}</div>
    </div>
  )
}
