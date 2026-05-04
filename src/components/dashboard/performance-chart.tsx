"use client"

import { useState } from "react"
import {
  LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend
} from "recharts"
import { cn } from "@/lib/utils"

const generateData = (days: number) =>
  Array.from({ length: days }, (_, i) => {
    const d = new Date()
    d.setDate(d.getDate() - (days - 1 - i))
    const label = d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })
    const base = 400 + Math.random() * 200
    return {
      date: label,
      meta: +(base * (0.7 + Math.random() * 0.3)).toFixed(0),
      google: +(base * (0.3 + Math.random() * 0.2)).toFixed(0),
      conversoes: Math.floor(8 + Math.random() * 15),
      ctr: +(1.5 + Math.random() * 2.5).toFixed(2),
    }
  })

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[#111118] p-3 shadow-xl text-xs">
      <p className="font-semibold text-[#a1a1aa] mb-2">{label}</p>
      {payload.map((entry: any) => (
        <div key={entry.dataKey} className="flex items-center gap-2 mb-1">
          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
          <span className="text-[#71717a]">{entry.name}:</span>
          <span className="font-bold text-white">
            {entry.dataKey === "ctr" ? `${entry.value}%` :
             entry.dataKey === "conversoes" ? entry.value :
             `R$ ${entry.value.toLocaleString("pt-BR")}`}
          </span>
        </div>
      ))}
    </div>
  )
}

type MetricKey = "spend" | "ctr" | "conversoes"

const metricConfig: Record<MetricKey, { label: string; format: (v: number) => string }> = {
  spend: { label: "Investimento", format: (v) => `R$ ${v.toLocaleString("pt-BR")}` },
  ctr: { label: "CTR", format: (v) => `${v.toFixed(2)}%` },
  conversoes: { label: "Conversões", format: (v) => String(v) },
}

interface ExternalDataPoint {
  date: string; meta_spend: number; google_spend: number
  clicks: number; impressions: number; conversions: number
}

export function PerformanceChart({ externalData }: { externalData?: ExternalDataPoint[] }) {
  const [period, setPeriod] = useState(30)
  const [metric, setMetric] = useState<MetricKey>("spend")

  const sourceData = externalData && externalData.length > 0 ? externalData : generateData(period)

  const processedData = sourceData.map((d: any) => ({
    date: externalData?.length
      ? new Date(d.date + "T00:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })
      : d.date,
    meta: (d as any).meta_spend ?? (d as any).meta ?? 0,
    google: (d as any).google_spend ?? (d as any).google ?? 0,
    conversoes: (d as any).conversions ?? (d as any).conversoes ?? 0,
    ctr: (d as any).impressions > 0 ? +((((d as any).clicks / (d as any).impressions) * 100).toFixed(2)) : (d as any).ctr ?? 0,
    spend: ((d as any).meta_spend ?? (d as any).meta ?? 0) + ((d as any).google_spend ?? (d as any).google ?? 0),
  }))

  return (
    <div className="flex flex-col gap-4">
      {/* Controls */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex gap-1 p-1 bg-[#0d0d14] border border-[var(--border)] rounded-lg">
          {(Object.keys(metricConfig) as MetricKey[]).map(k => (
            <button
              key={k}
              onClick={() => setMetric(k)}
              className={cn(
                "px-3 py-1.5 rounded-md text-xs font-medium transition-all cursor-pointer",
                metric === k ? "bg-[#6366f1] text-white" : "text-[#71717a] hover:text-white"
              )}
            >
              {metricConfig[k].label}
            </button>
          ))}
        </div>
        <div className="flex gap-1 p-1 bg-[#0d0d14] border border-[var(--border)] rounded-lg">
          {[7, 14, 30].map(d => (
            <button
              key={d}
              onClick={() => setPeriod(d)}
              className={cn(
                "px-3 py-1.5 rounded-md text-xs font-medium transition-all cursor-pointer",
                period === d ? "bg-[#6366f1] text-white" : "text-[#71717a] hover:text-white"
              )}
            >
              {d}d
            </button>
          ))}
        </div>
      </div>

      {/* Chart */}
      <ResponsiveContainer width="100%" height={240}>
        {metric === "spend" ? (
          <AreaChart data={processedData} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id="metaGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="googleGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#34a853" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#34a853" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e1e2e" vertical={false} />
            <XAxis dataKey="date" tick={{ fill: "#52525b", fontSize: 10 }} axisLine={false} tickLine={false} interval={Math.floor(period / 7)} />
            <YAxis tick={{ fill: "#52525b", fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={v => `R$${(v/1000).toFixed(0)}k`} width={48} />
            <Tooltip content={<CustomTooltip />} />
            <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: "11px", color: "#71717a" }} />
            <Area type="monotone" dataKey="meta" name="Meta Ads" stroke="#6366f1" fill="url(#metaGrad)" strokeWidth={2} dot={false} />
            <Area type="monotone" dataKey="google" name="Google Ads" stroke="#34a853" fill="url(#googleGrad)" strokeWidth={2} dot={false} />
          </AreaChart>
        ) : (
          <LineChart data={processedData} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e1e2e" vertical={false} />
            <XAxis dataKey="date" tick={{ fill: "#52525b", fontSize: 10 }} axisLine={false} tickLine={false} interval={Math.floor(period / 7)} />
            <YAxis tick={{ fill: "#52525b", fontSize: 10 }} axisLine={false} tickLine={false} width={40}
              tickFormatter={v => metric === "ctr" ? `${v}%` : String(v)} />
            <Tooltip content={<CustomTooltip />} />
            <Line type="monotone" dataKey={metric} name={metricConfig[metric].label} stroke="#6366f1" strokeWidth={2} dot={false} activeDot={{ r: 4, fill: "#6366f1" }} />
          </LineChart>
        )}
      </ResponsiveContainer>
    </div>
  )
}
