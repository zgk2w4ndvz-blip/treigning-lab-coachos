"use client"

import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import { format, parseISO } from "date-fns"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { EmptyState } from "@/components/shared/empty-state"

interface Point {
  date: string
  weight: number
}

export function CutDescentChart({
  series,
  targetLbs,
  classLimitLbs,
}: {
  series: Point[]
  targetLbs: number
  classLimitLbs: number
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Weight descent</CardTitle>
      </CardHeader>
      <CardContent>
        {series.length < 2 ? (
          <EmptyState
            title="Not enough weigh-ins yet"
            description="Log a few weights to chart the descent toward target."
            className="py-8"
          />
        ) : (
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={series} margin={{ top: 8, right: 12, bottom: 0, left: -8 }}>
                <defs>
                  <linearGradient id="wt" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--color-primary)" stopOpacity={0.25} />
                    <stop offset="100%" stopColor="var(--color-primary)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" vertical={false} />
                <XAxis
                  dataKey="date"
                  tickFormatter={(d: string) => format(parseISO(d), "MMM d")}
                  tick={{ fontSize: 11 }}
                  minTickGap={24}
                />
                <YAxis
                  domain={["dataMin - 3", "dataMax + 3"]}
                  tick={{ fontSize: 11 }}
                  width={40}
                  tickFormatter={(v: number) => `${Math.round(v)}`}
                />
                <Tooltip
                  formatter={(v) => [`${v} lb`, "Weight"]}
                  labelFormatter={(d) => format(parseISO(String(d)), "MMM d, yyyy")}
                  contentStyle={{ fontSize: 12, borderRadius: 8 }}
                />
                <ReferenceLine
                  y={classLimitLbs}
                  stroke="var(--color-destructive)"
                  strokeDasharray="4 4"
                  label={{ value: "Class limit", fontSize: 10, position: "insideTopRight" }}
                />
                <ReferenceLine
                  y={targetLbs}
                  stroke="var(--color-emerald-500, #10b981)"
                  strokeDasharray="4 4"
                  label={{ value: "Target", fontSize: 10, position: "insideBottomRight" }}
                />
                <Area
                  type="monotone"
                  dataKey="weight"
                  stroke="var(--color-primary)"
                  strokeWidth={2}
                  fill="url(#wt)"
                  dot={{ r: 2 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
