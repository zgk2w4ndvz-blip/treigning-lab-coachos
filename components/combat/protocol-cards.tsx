import { Droplets, GlassWater, UtensilsCrossed } from "lucide-react"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { EmptyState } from "@/components/shared/empty-state"
import type { WeightCut } from "@/types/models"

export function WaterLoadCard({ plan }: { plan: WeightCut["water_load_plan"] }) {
  return (
    <Card>
      <CardHeader className="flex-row items-center gap-2 space-y-0">
        <Droplets className="text-muted-foreground size-4" />
        <CardTitle className="text-base">Water load &amp; cut</CardTitle>
      </CardHeader>
      <CardContent className="px-0">
        {plan.length === 0 ? (
          <EmptyState title="No plan generated" className="mx-6 py-8" />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Days out</TableHead>
                <TableHead>Plan</TableHead>
                <TableHead className="text-right">Water</TableHead>
                <TableHead>Sodium</TableHead>
                <TableHead>Notes</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {plan.map((d, i) => (
                <TableRow key={i}>
                  <TableCell className="tabular-nums">
                    {d.day_offset === 0 ? "Weigh-in" : `−${d.day_offset}d`}
                  </TableCell>
                  <TableCell className="font-medium">{d.label}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {d.water_oz} oz
                  </TableCell>
                  <TableCell>{d.sodium ?? "—"}</TableCell>
                  <TableCell className="text-muted-foreground text-xs">
                    {d.notes ?? "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  )
}

export function RehydrationCard({
  steps,
}: {
  steps: WeightCut["hydration_restoration"]
}) {
  return (
    <Card>
      <CardHeader className="flex-row items-center gap-2 space-y-0">
        <GlassWater className="text-muted-foreground size-4" />
        <CardTitle className="text-base">Hydration restoration</CardTitle>
      </CardHeader>
      <CardContent className="px-0">
        {steps.length === 0 ? (
          <EmptyState title="No protocol generated" className="mx-6 py-8" />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>After scale</TableHead>
                <TableHead>Step</TableHead>
                <TableHead className="text-right">Fluid</TableHead>
                <TableHead>Electrolytes</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {steps.map((s, i) => (
                <TableRow key={i}>
                  <TableCell className="tabular-nums">
                    +{s.hour_offset}h
                  </TableCell>
                  <TableCell className="font-medium">{s.label}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {s.fluid_oz} oz
                  </TableCell>
                  <TableCell className="text-muted-foreground text-xs">
                    {s.electrolytes ?? "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  )
}

export function RefuelCard({ steps }: { steps: WeightCut["refuel_protocol"] }) {
  return (
    <Card>
      <CardHeader className="flex-row items-center gap-2 space-y-0">
        <UtensilsCrossed className="text-muted-foreground size-4" />
        <CardTitle className="text-base">Post-weigh-in fueling</CardTitle>
      </CardHeader>
      <CardContent className="px-0">
        {steps.length === 0 ? (
          <EmptyState title="No protocol generated" className="mx-6 py-8" />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>After scale</TableHead>
                <TableHead>Step</TableHead>
                <TableHead className="text-right">Carbs</TableHead>
                <TableHead className="text-right">Protein</TableHead>
                <TableHead>Food</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {steps.map((s, i) => (
                <TableRow key={i}>
                  <TableCell className="tabular-nums">
                    +{s.hour_offset}h
                  </TableCell>
                  <TableCell className="font-medium">{s.label}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {s.carbs_g != null ? `${s.carbs_g} g` : "—"}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {s.protein_g != null ? `${s.protein_g} g` : "—"}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-xs">
                    {s.food ?? s.notes ?? "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  )
}
