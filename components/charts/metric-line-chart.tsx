"use client"

import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import { format, parseISO } from "date-fns"

export interface LineSeries {
  key: string
  label: string
  color: string
}

export interface RefLine {
  y: number
  label: string
  color?: string
}

export function MetricLineChart({
  data,
  xKey = "date",
  series,
  height = 240,
  unit = "",
  refLines = [],
  yDomain,
}: {
  data: Record<string, unknown>[]
  xKey?: string
  series: LineSeries[]
  height?: number
  unit?: string
  refLines?: RefLine[]
  yDomain?: [number | string, number | string]
}) {
  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: -12 }}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" vertical={false} />
          <XAxis
            dataKey={xKey}
            tickFormatter={(d) => {
              try {
                return format(parseISO(String(d)), "MMM d")
              } catch {
                return String(d)
              }
            }}
            tick={{ fontSize: 11 }}
            minTickGap={24}
          />
          <YAxis
            tick={{ fontSize: 11 }}
            width={44}
            domain={yDomain ?? ["auto", "auto"]}
            tickFormatter={(v: number) => `${Math.round(v)}`}
          />
          <Tooltip
            labelFormatter={(d) => {
              try {
                return format(parseISO(String(d)), "MMM d, yyyy")
              } catch {
                return String(d)
              }
            }}
            formatter={(v, name) => [`${v}${unit ? ` ${unit}` : ""}`, name]}
            contentStyle={{ fontSize: 12, borderRadius: 8 }}
          />
          {refLines.map((r) => (
            <ReferenceLine
              key={r.label}
              y={r.y}
              stroke={r.color ?? "#ef4444"}
              strokeDasharray="4 4"
              label={{ value: r.label, fontSize: 10, position: "insideTopRight" }}
            />
          ))}
          {series.map((s) => (
            <Line
              key={s.key}
              type="monotone"
              dataKey={s.key}
              name={s.label}
              stroke={s.color}
              strokeWidth={2}
              dot={false}
              connectNulls
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
