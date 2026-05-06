"use client"

import { useState, useEffect } from "react"
import {
  LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend
} from "recharts"
import { cn, formatCurrency } from "@/lib/utils"

const generateData = (days: number) =>
  Array.from({ length: days }, (_, i) => {
    const d = new Date()
    d.setDate(d.getDate() - (days - 1 - i))
    const label = d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })
    const base = 400 + Math.random() * 200
    return {
      date: label,
      meta_spend: +(base * (0.7 + Math.random() * 0.3)).toFixed(0),
      google_spend: +(base * (0.3 + Math.random() * 0.2)).toFixed(0),
      conversions: Math.floor(8 + Math.random() * 15),
      clicks: Math.floor(120 + Math.random() * 80),
      impressions: Math.floor(8000 + Math.random() * 4000),
    }
  })

interface ChartMetric {
  key: string
  label: string
  format: (v: number) => string
  isCurrency?: boolean
}

const METRICS: Record<string, ChartMetric> = {
  spend:       { key: "spend",       label: "Investimento",  format: (v) => formatCurrency(v), isCurrency: true },
  conversions: { key: "conversions", label: "Conversões",     format: (v) => String(Math.round(v)) },
  clicks:      { key: "clicks",      label: "Cliques",        format: (v) => v.toLocaleString("pt-BR") },
  impressions: { key: "impressions", label: "Impressões",     format: (v) => v.toLocaleString("pt-BR") },
  ctr:         { key: "ctr",         label: "CTR",            format: (v) => `${v.toFixed(2)}%` },
  cpc:         { key: "cpc",         label: "CPC",            format: (v) => formatCurrency(v), isCurrency: true },
  cpa:         { key: "cpa",         label: "Custo por Resultado", format: (v) => formatCurrency(v), isCurrency: true },
  cpm:         { key: "cpm",         label: "CPM",            format: (v) => formatCurrency(v), isCurrency: true },
  revenue:     { key: "revenue",     label: "Retorno R$",     format: (v) => formatCurrency(v), isCurrency: true },
  roas:        { key: "roas",        label: "ROAS",           format: (v) => `${v.toFixed(2)}x` },
}

const CustomTooltip = ({ active, payload, label, metricKey }: any) => {
  if (!active || !payload?.length) return null
  const meta = METRICS[metricKey] || METRICS.spend
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[#131313] p-3 shadow-xl text-xs">
      <p className="font-semibold text-[#a1a1aa] mb-2">{label}</p>
      {payload.map((entry: any) => (
        <div key={entry.dataKey} className="flex items-center gap-2 mb-1">
          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
          <span className="text-[#71717a]">{entry.name}:</span>
          <span className="font-bold text-white">{meta.format(entry.value)}</span>
        </div>
      ))}
    </div>
  )
}

interface ExternalDataPoint {
  date: string
  meta_spend?: number
  google_spend?: number
  clicks?: number
  impressions?: number
  conversions?: number
}

interface Props {
  externalData?: ExternalDataPoint[]
  availableMetrics?: string[]  // chave dos KPIs selecionados pelo user
}

export function PerformanceChart({ externalData, availableMetrics }: Props) {
  const [period, setPeriod] = useState(30)
  // Métricas a exibir como abas (filtradas pelas selecionadas pelo user, ou todas)
  const allowedKeys = (availableMetrics && availableMetrics.length > 0
    ? availableMetrics.filter(k => METRICS[k])
    : ["spend", "conversions", "ctr"])
  const [metric, setMetric] = useState<string>(allowedKeys[0])

  // Garante que metric esteja sempre dentro das allowed
  useEffect(() => {
    if (!allowedKeys.includes(metric)) setMetric(allowedKeys[0])
  }, [allowedKeys, metric])

  const sourceData = externalData && externalData.length > 0 ? externalData : generateData(period)

  const processedData = sourceData.map((d: any) => {
    const meta = d.meta_spend ?? 0
    const google = d.google_spend ?? 0
    const spend = meta + google
    const clicks = d.clicks ?? 0
    const impressions = d.impressions ?? 0
    const conversions = d.conversions ?? 0
    const ctr = impressions > 0 ? (clicks / impressions) * 100 : 0
    const cpc = clicks > 0 ? spend / clicks : 0
    const cpa = conversions > 0 ? spend / conversions : 0
    const cpm = impressions > 0 ? (spend / impressions) * 1000 : 0
    const revenue = (d.purchase_value ?? 0) || (conversions * cpa)
    const roas = spend > 0 ? revenue / spend : 0
    return {
      date: externalData?.length
        ? new Date(d.date + "T00:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })
        : d.date,
      meta, google, spend,
      clicks, impressions, conversions,
      ctr, cpc, cpa, cpm, revenue, roas,
    }
  })

  const meta = METRICS[metric] || METRICS.spend
  const isStacked = metric === "spend"  // mostrar Meta + Google empilhado
  const yFormatter = meta.isCurrency
    ? (v: number) => `R$${(v / 1000).toFixed(0)}k`
    : (v: number) => v >= 1000 ? `${(v/1000).toFixed(1)}k` : String(Math.round(v))

  return (
    <div className="flex flex-col gap-4">
      {/* Controls */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex gap-1 p-1 bg-[#0f0f0f] border border-[var(--border)] rounded-lg overflow-x-auto max-w-full">
          {allowedKeys.map(k => (
            <button
              key={k}
              onClick={() => setMetric(k)}
              className={cn(
                "px-3 py-1.5 rounded-md text-xs font-medium transition-all cursor-pointer whitespace-nowrap",
                metric === k
                  ? "bg-gradient-to-r from-[#FF5F1A] to-[#E54E0B] text-white shadow"
                  : "text-[#71717a] hover:text-white"
              )}
            >
              {METRICS[k]?.label || k}
            </button>
          ))}
        </div>
        <div className="flex gap-1 p-1 bg-[#0f0f0f] border border-[var(--border)] rounded-lg">
          {[7, 14, 30].map(d => (
            <button
              key={d}
              onClick={() => setPeriod(d)}
              className={cn(
                "px-3 py-1.5 rounded-md text-xs font-medium transition-all cursor-pointer",
                period === d ? "bg-[#FF5F1A] text-white" : "text-[#71717a] hover:text-white"
              )}
            >
              {d}d
            </button>
          ))}
        </div>
      </div>

      {/* Chart */}
      <ResponsiveContainer width="100%" height={260}>
        {isStacked ? (
          <AreaChart data={processedData} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id="metaGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#FF5F1A" stopOpacity={0.4} />
                <stop offset="95%" stopColor="#FF5F1A" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="googleGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#34a853" stopOpacity={0.4} />
                <stop offset="95%" stopColor="#34a853" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#1a1410" vertical={false} />
            <XAxis dataKey="date" tick={{ fill: "#52525b", fontSize: 10 }} axisLine={false} tickLine={false} interval={Math.floor(period / 7)} />
            <YAxis tick={{ fill: "#52525b", fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={yFormatter} width={48} />
            <Tooltip content={<CustomTooltip metricKey={metric} />} />
            <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: "11px", color: "#71717a" }} />
            <Area type="monotone" dataKey="meta" name="Meta Ads" stroke="#FF5F1A" fill="url(#metaGrad)" strokeWidth={2} dot={false} stackId="1" />
            <Area type="monotone" dataKey="google" name="Google Ads" stroke="#34a853" fill="url(#googleGrad)" strokeWidth={2} dot={false} stackId="1" />
          </AreaChart>
        ) : (
          <AreaChart data={processedData} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id="orangeGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#FF5F1A" stopOpacity={0.5} />
                <stop offset="95%" stopColor="#FF5F1A" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#1a1410" vertical={false} />
            <XAxis dataKey="date" tick={{ fill: "#52525b", fontSize: 10 }} axisLine={false} tickLine={false} interval={Math.floor(period / 7)} />
            <YAxis tick={{ fill: "#52525b", fontSize: 10 }} axisLine={false} tickLine={false} width={48} tickFormatter={yFormatter} />
            <Tooltip content={<CustomTooltip metricKey={metric} />} />
            <Area type="monotone" dataKey={metric} name={meta.label} stroke="#FF5F1A" fill="url(#orangeGrad)" strokeWidth={2.5} dot={false} activeDot={{ r: 5, fill: "#FF5F1A" }} />
          </AreaChart>
        )}
      </ResponsiveContainer>
    </div>
  )
}
