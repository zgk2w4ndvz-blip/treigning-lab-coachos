import Link from "next/link"
import { Plus, Settings2 } from "lucide-react"

import { requireCoach } from "@/lib/auth"
import { listClientsForRoster } from "@/lib/data/clients"
import { PageHeader } from "@/components/shared/page-header"
import { Button } from "@/components/ui/button"
import { ClientRoster } from "@/components/coach/client-roster"

export default async function ClientsPage() {
  await requireCoach()
  const items = await listClientsForRoster()

  return (
    <main className="flex flex-1 flex-col gap-6 p-6 md:p-8">
      <PageHeader
        title="Clients"
        description={`${items.length} ${items.length === 1 ? "athlete" : "athletes"} on your roster.`}
        actions={
          <>
            <Button asChild variant="outline">
              <Link href="/clients/manage">
                <Settings2 className="size-4" />
                Manage roster
              </Link>
            </Button>
            <Button asChild>
              <Link href="/clients/new">
                <Plus className="size-4" />
                New client
              </Link>
            </Button>
          </>
        }
      />
      <ClientRoster items={items} />
    </main>
  )
}
