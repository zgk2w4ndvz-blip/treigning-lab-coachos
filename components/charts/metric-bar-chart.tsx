"use client"

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import { format, parseISO } from "date-fns"

export interface BarSeries {
  key: string
  label: string
  color: string
  stackId?: string
}

export function MetricBarChart({
  data,
  xKey = "date",
  bars,
  height = 240,
  unit = "",
  refLine,
  /** Name of a field on each row holding a per-bar color (applied to first bar). */
  colorKey,
}: {
  data: Record<string, unknown>[]
  xKey?: string
  bars: BarSeries[]
  height?: number
  unit?: string
  refLine?: { y: number; label: string; color?: string }
  colorKey?: string
}) {
  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: -12 }}>
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
            minTickGap={20}
          />
          <YAxis tick={{ fontSize: 11 }} width={44} tickFormatter={(v: number) => `${Math.round(v)}`} />
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
            cursor={{ fill: "var(--color-muted)", opacity: 0.4 }}
          />
          {refLine ? (
            <ReferenceLine
              y={refLine.y}
              stroke={refLine.color ?? "#10b981"}
              strokeDasharray="4 4"
              label={{ value: refLine.label, fontSize: 10, position: "insideTopRight" }}
            />
          ) : null}
          {bars.map((b, bi) => (
            <Bar
              key={b.key}
              dataKey={b.key}
              name={b.label}
              fill={b.color}
              stackId={b.stackId}
              radius={b.stackId ? 0 : [3, 3, 0, 0]}
            >
              {bi === 0 && colorKey
                ? data.map((row, i) => {
                    const c = row[colorKey]
                    return <Cell key={i} fill={typeof c === "string" ? c : b.color} />
                  })
                : null}
            </Bar>
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
