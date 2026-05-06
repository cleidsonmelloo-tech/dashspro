"use client"

import { useState, useEffect, useCallback } from "react"
import { BarChart3, TrendingUp, TrendingDown, DollarSign, MousePointer, Eye, Target, RefreshCw } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { PerformanceChart } from "@/components/dashboard/performance-chart"
import { formatCurrency, formatNumber, formatPercent, cn } from "@/lib/utils"
import { BmCampaignFilter } from "@/components/ui/bm-campaign-filter"
import { PlatformPills } from "@/components/ui/platform-pills"
import { useFilter } from "@/lib/filter-context"

const PERIOD_OPTIONS = [
  { label: "Hoje", value: "today" },
  { label: "Últimos 7 dias", value: "7d" },
  { label: "Últimos 30 dias", value: "30d" },
  { label: "Este mês", value: "this_month" },
]

interface DashMetrics {
  spend: number; impressions: number; clicks: number; conversions: number
  ctr: number; cpc: number; cpa: number; meta_spend: number; google_spend: number
}
interface DailyPoint {
  date: string; meta_spend: number; google_spend: number
  clicks: number; impressions: number; conversions: number
}

function pct(current: number, previous: number): number | null {
  if (!previous || previous === 0) return null
  return ((current - previous) / previous) * 100
}

function MetricCard({
  label, value, change, icon: Icon, color = "#6366f1", loading
}: {
  label: string; value: string; change?: number | null
  icon: React.ElementType; color?: string; loading?: boolean
}) {
  const isPositive = (change ?? 0) >= 0
  return (
    <Card className="relative overflow-hidden">
      <div className="absolute inset-0 opacity-5" style={{ background: `radial-gradient(circle at top right, ${color}, transparent 60%)` }} />
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div className="flex flex-col gap-1">
            <p className="text-xs font-medium text-[#71717a] uppercase tracking-wide">{label}</p>
            {loading
              ? <div className="h-8 w-20 bg-[#1e1e2e] rounded animate-pulse" />
              : <p className="text-2xl font-bold text-white">{value}</p>
            }
          </div>
          <div className="flex items-center justify-center w-10 h-10 rounded-xl" style={{ backgroundColor: `${color}20` }}>
            <Icon className="w-5 h-5" style={{ color }} />
          </div>
        </div>
        {!loading && change !== undefined && change !== null && (
          <div className="flex items-center gap-1.5 mt-3">
            <div className={cn(
              "flex items-center gap-0.5 px-2 py-0.5 rounded-full text-xs font-semibold",
              isPositive ? "bg-emerald-500/15 text-emerald-400" : "bg-red-500/15 text-red-400"
            )}>
              {isPositive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
              {isPositive ? "+" : ""}{change.toFixed(1)}%
            </div>
            <span className="text-xs text-[#52525b]">vs período anterior</span>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function getDateRange(period: string): { since: string; until: string } {
  const today = new Date()
  const until = today.toISOString().split("T")[0]
  if (period === "today") return { since: until, until }
  if (period === "7d") { const d = new Date(today); d.setDate(d.getDate() - 7); return { since: d.toISOString().split("T")[0], until } }
  if (period === "this_month") return { since: `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-01`, until }
  const d = new Date(today); d.setDate(d.getDate() - 30); return { since: d.toISOString().split("T")[0], until }
}

const DEMO_METRICS: DashMetrics = {
  spend: 12480, impressions: 248932, clicks: 4721, conversions: 312,
  ctr: 1.89, cpc: 2.64, cpa: 39.99, meta_spend: 8736, google_spend: 3744,
}
const DEMO_PREV = { spend: 11520, impressions: 221000, clicks: 4980, conversions: 263, ctr: 2.25, cpc: 2.31 }
const DEMO_CAMPAIGNS = [
  { name: "[VENDAS] CBO Principal", spend: 4820, roas: 4.2, platform: "meta" },
  { name: "Search - Comprar Exato", spend: 2840, roas: 3.6, platform: "google" },
  { name: "[LEADS] Remarketing 7d", spend: 1940, roas: 2.8, platform: "meta" },
  { name: "Search - Preço Frase", spend: 1680, roas: 3.2, platform: "google" },
]

export default function DashboardPage() {
  const { filterParam } = useFilter()
  const [platformFilter, setPlatformFilter] = useState<string[]>([])
  const [period, setPeriod] = useState("30d")
  const [loading, setLoading] = useState(true)
  const [connected, setConnected] = useState(false)
  const [metrics, setMetrics] = useState<DashMetrics | null>(null)
  const [prevMetrics, setPrevMetrics] = useState<Partial<DashMetrics> | null>(null)
  const [dailyData, setDailyData] = useState<DailyPoint[]>([])
  const [topCampaigns, setTopCampaigns] = useState(DEMO_CAMPAIGNS)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const { since, until } = getDateRange(period)
      const [metricsRes, compareRes, campaignsResM, campaignsResG] = await Promise.all([
        fetch(`/api/dashboard/metrics?since=${since}&until=${until}${filterParam}`),
        fetch(`/api/dashboard/compare?since=${since}&until=${until}${filterParam}`),
        fetch(`/api/meta/campaigns?since=${since}&until=${until}${filterParam}`),
        fetch(`/api/google/campaigns?since=${since}&until=${until}${filterParam}`),
      ])

      const metricsData = metricsRes.ok ? await metricsRes.json() : { connected: false }
      const compareData = compareRes.ok ? await compareRes.json() : { connected: false }

      if (metricsData.connected) {
        setConnected(true)
        setMetrics(metricsData.metrics)
        setDailyData(metricsData.daily || [])
        if (compareData.previous) setPrevMetrics(compareData.previous)
      } else {
        setConnected(false)
        setMetrics(DEMO_METRICS)
        setPrevMetrics(DEMO_PREV)
        setDailyData([])
      }

      const metaCampaigns = (campaignsResM.ok ? await campaignsResM.json() : { campaigns: [] }).campaigns || []
      const googleCampaigns = (campaignsResG.ok ? await campaignsResG.json() : { campaigns: [] }).campaigns || []
      const all = [...metaCampaigns, ...googleCampaigns]
        .sort((a: { spend: number }, b: { spend: number }) => b.spend - a.spend)
        .slice(0, 4)

      setTopCampaigns(all.length > 0 ? all : DEMO_CAMPAIGNS)
    } catch {
      setConnected(false)
      setMetrics(DEMO_METRICS)
      setPrevMetrics(DEMO_PREV)
    } finally {
      setLoading(false)
    }
  }, [period, filterParam])

  useEffect(() => { fetchData() }, [fetchData])

  const m = metrics || DEMO_METRICS
  const p = prevMetrics

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white">Dashboard</h1>
          <p className="text-sm text-[#71717a] mt-0.5">Visão geral consolidada — Meta Ads + Google Ads</p>
        </div>
        <div className="flex items-center gap-2">
          <div className={cn(
            "flex items-center gap-1.5 px-3 h-7 rounded-full border",
            connected ? "bg-emerald-500/10 border-emerald-500/20" : "bg-amber-500/10 border-amber-500/20"
          )}>
            <div className={cn("w-1.5 h-1.5 rounded-full", connected ? "bg-emerald-400 animate-pulse" : "bg-amber-400")} />
            <span className={cn("text-xs font-medium", connected ? "text-emerald-400" : "text-amber-400")}>
              {connected ? "Dados reais" : "Demo"}
            </span>
          </div>
          <PlatformPills value={platformFilter} onChange={setPlatformFilter} />
          <BmCampaignFilter />
          <button onClick={fetchData}
            className="w-9 h-9 flex items-center justify-center rounded-lg border border-[var(--border)] bg-[#111118] hover:bg-[#1e1e2e] transition-colors">
            <RefreshCw className={cn("w-3.5 h-3.5 text-[#71717a]", loading && "animate-spin")} />
          </button>
          <select value={period} onChange={(e) => setPeriod(e.target.value)}
            className="h-9 px-3 rounded-lg border border-[var(--border)] bg-[#111118] text-sm text-[#f4f4f5] outline-none cursor-pointer">
            {PERIOD_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
      </div>

      {/* KPI Cards com comparativo */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <MetricCard label="Investimento" value={formatCurrency(m.spend)} change={pct(m.spend, p?.spend ?? 0)} icon={DollarSign} color="#6366f1" loading={loading} />
        <MetricCard label="Impressões" value={formatNumber(m.impressions)} change={pct(m.impressions, p?.impressions ?? 0)} icon={Eye} color="#8b5cf6" loading={loading} />
        <MetricCard label="Cliques" value={formatNumber(m.clicks)} change={pct(m.clicks, p?.clicks ?? 0)} icon={MousePointer} color="#06b6d4" loading={loading} />
        <MetricCard label="CTR Médio" value={formatPercent(m.ctr)} change={pct(m.ctr, p?.ctr ?? 0)} icon={TrendingUp} color="#10b981" loading={loading} />
        <MetricCard label="CPC Médio" value={formatCurrency(m.cpc)} change={p?.cpc ? pct(m.cpc, p.cpc) : null} icon={BarChart3} color="#f59e0b" loading={loading} />
        <MetricCard label="Conversões" value={formatNumber(m.conversions)} change={pct(m.conversions, p?.conversions ?? 0)} icon={Target} color="#ef4444" loading={loading} />
      </div>

      {/* Gráfico */}
      <Card>
        <CardHeader><CardTitle>Performance ao Longo do Tempo</CardTitle></CardHeader>
        <CardContent>
          <PerformanceChart externalData={dailyData.length > 0 ? dailyData : undefined} />
        </CardContent>
      </Card>

      {/* Distribuição + Top Campanhas */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader><CardTitle>Investimento por Plataforma</CardTitle></CardHeader>
          <CardContent className="flex flex-col gap-3">
            {[
              { label: "Meta Ads", value: m.meta_spend, color: "#1877f2" },
              { label: "Google Ads", value: m.google_spend, color: "#34a853" },
            ].map((p) => {
              const pct = m.spend > 0 ? (p.value / m.spend) * 100 : 50
              return (
                <div key={p.label}>
                  <div className="flex justify-between text-sm mb-1.5">
                    <span className="font-medium text-white">{p.label}</span>
                    <span className="text-[#a1a1aa]">{formatCurrency(p.value)} · {pct.toFixed(0)}%</span>
                  </div>
                  <div className="h-2.5 bg-[#1e1e2e] rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, backgroundColor: p.color }} />
                  </div>
                </div>
              )
            })}
            {/* CPA por plataforma */}
            <div className="mt-2 pt-3 border-t border-[var(--border)] grid grid-cols-2 gap-3">
              {[
                { label: "CPC Médio", value: formatCurrency(m.cpc) },
                { label: "CPA Médio", value: formatCurrency(m.cpa) },
              ].map((s) => (
                <div key={s.label} className="rounded-lg bg-[#0d0d14] p-3">
                  <p className="text-xs text-[#71717a]">{s.label}</p>
                  <p className="text-base font-bold text-white mt-0.5">{loading ? "—" : s.value}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Top Campanhas</CardTitle>
              <a href="/dashboard/campanhas" className="text-xs text-[#6366f1] hover:underline">Ver todas →</a>
            </div>
          </CardHeader>
          <CardContent className="flex flex-col gap-0">
            {loading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="py-2.5 border-b border-[var(--border)] last:border-0">
                  <div className="h-4 bg-[#1e1e2e] rounded animate-pulse" />
                </div>
              ))
            ) : (
              topCampaigns.map((c, i) => (
                <div key={i} className="flex items-center gap-3 py-2.5 border-b border-[var(--border)] last:border-0">
                  <div className={cn("w-1.5 h-1.5 rounded-full flex-shrink-0", c.platform === "meta" ? "bg-blue-500" : "bg-green-500")} />
                  <span className="flex-1 text-xs text-[#a1a1aa] truncate">{c.name}</span>
                  <span className="text-xs text-white font-medium">{formatCurrency(c.spend)}</span>
                  <span className={cn("text-xs font-bold w-8 text-right",
                    c.roas >= 3 ? "text-emerald-400" : c.roas >= 2 ? "text-amber-400" : "text-red-400")}>
                    {c.roas > 0 ? `${c.roas.toFixed(1)}x` : "—"}
                  </span>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      {/* Banner conectar */}
      {!connected && (
        <div className="rounded-xl border border-dashed border-[#27272a] bg-[#111118]/40 p-5 flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-[#6366f1]/10 flex items-center justify-center flex-shrink-0">
            <BarChart3 className="w-5 h-5 text-[#6366f1]" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-white">Conecte suas contas para dados reais</p>
            <p className="text-xs text-[#71717a] mt-0.5">Dados demonstrativos com comparativo fictício. Conecte Meta Ads e Google Ads nas configurações.</p>
          </div>
          <a href="/dashboard/configuracoes"
            className="flex-shrink-0 px-3 py-2 rounded-lg bg-[#6366f1] text-white text-xs font-medium hover:bg-[#4f52d1] transition-colors">
            Conectar agora
          </a>
        </div>
      )}
    </div>
  )
}
