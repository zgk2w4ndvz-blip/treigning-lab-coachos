import { requireCoach } from "@/lib/auth"
import { getLowBasePrescription } from "@/lib/data/low-base"
import { LowBaseCard } from "@/components/low-base/low-base-card"

export default async function LowBasePage({
  params,
}: {
  params: Promise<{ clientId: string }>
}) {
  await requireCoach()
  const { clientId } = await params
  const prescription = await getLowBasePrescription(clientId)

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Low Base</h2>
        <p className="text-muted-foreground text-sm">
          Aerobic base prescription — current active dose for this athlete.
        </p>
      </div>
      <LowBaseCard clientId={clientId} prescription={prescription} />
    </div>
  )
}
