"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { BarChart3, TrendingUp, TrendingDown, DollarSign, MousePointer, Eye, Target, RefreshCw, Settings2, Check, X } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { PerformanceChart } from "@/components/dashboard/performance-chart"
import { FunnelCone, FunnelType } from "@/components/dashboard/funnel-cone"
import { formatCurrency, formatNumber, formatPercent, cn } from "@/lib/utils"
import { BmCampaignFilter } from "@/components/ui/bm-campaign-filter"
import { PlatformPills } from "@/components/ui/platform-pills"
import { DateRangePicker } from "@/components/ui/date-range-picker"
import { useFilter } from "@/lib/filter-context"

interface DashMetrics {
  spend: number; impressions: number; clicks: number; conversions: number
  ctr: number; cpc: number; cpa: number; meta_spend: number; google_spend: number
  roas?: number; cpm?: number; reach?: number; frequency?: number
}

// ── All available KPI metrics ────────────────────────────────────────────────
type MetricKey = "spend" | "impressions" | "clicks" | "ctr" | "cpc" | "cpa" | "conversions" | "roas" | "revenue" | "cpm" | "reach" | "frequency" | "kiwify_sales" | "kiwify_revenue" | "kiwify_ticket"

interface MetricDef {
  key: MetricKey
  label: string
  icon: React.ElementType
  color: string
  format: (v: number) => string
  description: string
  invertChange?: boolean  // lower is better (CPA, CPC, CPM)
}

const ALL_METRICS: MetricDef[] = [
  { key: "spend",       label: "Investimento",        icon: DollarSign,   color: "#FF5F1A", format: formatCurrency, description: "Total gasto no período" },
  { key: "conversions", label: "Resultado",            icon: Target,       color: "#10b981", format: formatNumber,   description: "Total de conversões / resultados" },
  { key: "cpa",         label: "Custo por Resultado",  icon: Target,       color: "#ef4444", format: formatCurrency, description: "Custo por conversão (CPA)", invertChange: true },
  { key: "revenue",     label: "Retorno R$",           icon: DollarSign,   color: "#22d3ee", format: formatCurrency, description: "Receita atribuída (ROAS × Investimento)" },
  { key: "roas",        label: "ROAS",                 icon: TrendingUp,   color: "#34d399", format: (v) => `${v.toFixed(2)}x`, description: "Retorno sobre investimento (multiplicador)" },
  { key: "impressions", label: "Impressões",           icon: Eye,          color: "#FF7A33", format: formatNumber,   description: "Total de impressões" },
  { key: "clicks",      label: "Cliques",              icon: MousePointer, color: "#06b6d4", format: formatNumber,   description: "Total de cliques" },
  { key: "ctr",         label: "CTR",                  icon: TrendingUp,   color: "#10b981", format: (v) => `${v.toFixed(2)}%`, description: "Taxa de cliques" },
  { key: "cpc",         label: "CPC Médio",            icon: BarChart3,    color: "#f59e0b", format: formatCurrency, description: "Custo por clique", invertChange: true },
  { key: "cpm",         label: "CPM",                  icon: Eye,          color: "#FFA66B", format: formatCurrency, description: "Custo por mil impressões", invertChange: true },
  { key: "reach",          label: "Alcance",              icon: Eye,          color: "#fb923c", format: formatNumber,   description: "Pessoas alcançadas" },
  { key: "frequency",      label: "Frequência",           icon: BarChart3,    color: "#94a3b8", format: (v) => v.toFixed(2), description: "Média de vezes que cada pessoa viu" },
  // ── Kiwify ──
  { key: "kiwify_sales",   label: "Compras (Kiwify)",     icon: Target,       color: "#10b981", format: formatNumber,   description: "Vendas aprovadas na Kiwify" },
  { key: "kiwify_revenue", label: "Receita Kiwify",       icon: DollarSign,   color: "#059669", format: formatCurrency, description: "Receita total aprovada na Kiwify" },
  { key: "kiwify_ticket",  label: "Ticket Médio Kiwify",  icon: BarChart3,    color: "#34d399", format: formatCurrency, description: "Ticket médio por venda Kiwify" },
]

const DEFAULT_METRICS: MetricKey[] = ["spend", "conversions", "cpa", "revenue", "ctr", "cpc"]
const LS_KEY = "dashboard_kpi_selection"
interface DailyPoint {
  date: string; meta_spend: number; google_spend: number
  clicks: number; impressions: number; conversions: number
}

function pct(current: number, previous: number): number | null {
  if (!previous || previous === 0) return null
  return ((current - previous) / previous) * 100
}

function MetricCard({
  label, value, change, icon: Icon, color = "#FF5F1A", loading, invertChange
}: {
  label: string; value: string; change?: number | null
  icon: React.ElementType; color?: string; loading?: boolean; invertChange?: boolean
}) {
  const raw = change ?? 0
  const isGood = invertChange ? raw <= 0 : raw >= 0
  return (
    <Card className="relative overflow-hidden">
      <div className="absolute inset-0 opacity-5" style={{ background: `radial-gradient(circle at top right, ${color}, transparent 60%)` }} />
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div className="flex flex-col gap-1">
            <p className="text-xs font-medium text-[#71717a] uppercase tracking-wide">{label}</p>
            {loading
              ? <div className="h-8 w-20 bg-[#1a1410] rounded animate-pulse" />
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
              isGood ? "bg-emerald-500/15 text-emerald-400" : "bg-red-500/15 text-red-400"
            )}>
              {isGood ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
              {raw >= 0 ? "+" : ""}{raw.toFixed(1)}%
            </div>
            <span className="text-xs text-[#52525b]">vs período anterior</span>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// ── KPI Selector dropdown ─────────────────────────────────────────────────────
function KpiSelector({ selected, onChange }: { selected: MetricKey[]; onChange: (v: MetricKey[]) => void }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function h(e: MouseEvent) { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener("mousedown", h)
    return () => document.removeEventListener("mousedown", h)
  }, [])

  function toggle(key: MetricKey) {
    if (selected.includes(key)) {
      if (selected.length > 1) onChange(selected.filter(k => k !== key))
    } else {
      if (selected.length < 6) onChange([...selected, key])
    }
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(v => !v)}
        title="Personalizar métricas"
        className={cn(
          "w-9 h-9 flex items-center justify-center rounded-lg border transition-colors",
          open ? "border-[#FF5F1A] bg-[#FF5F1A]/10 text-[#FF8C42]" : "border-[var(--border)] bg-[#131313] text-[#71717a] hover:text-white hover:border-[#FF5F1A]/40"
        )}
      >
        <Settings2 className="w-3.5 h-3.5" />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1.5 w-72 bg-[#0f0f18] border border-[var(--border)] rounded-xl shadow-2xl z-50 overflow-hidden">
          <div className="px-4 py-3 border-b border-[var(--border)] flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-white uppercase tracking-wider">Personalizar métricas</p>
              <p className="text-[10px] text-[#52525b] mt-0.5">Selecione até 6 para exibir</p>
            </div>
            <span className="text-[10px] text-[#FF5F1A] font-semibold">{selected.length}/6</span>
          </div>
          <div className="p-2 max-h-72 overflow-y-auto">
            {ALL_METRICS.map(m => {
              const isSelected = selected.includes(m.key)
              const disabled = !isSelected && selected.length >= 6
              return (
                <button
                  key={m.key}
                  onClick={() => toggle(m.key)}
                  disabled={disabled}
                  className={cn(
                    "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors text-left",
                    isSelected ? "bg-[#FF5F1A]/10" : disabled ? "opacity-40 cursor-not-allowed" : "hover:bg-[#1a1a27]"
                  )}
                >
                  <div className={cn(
                    "w-4 h-4 rounded flex items-center justify-center border flex-shrink-0 transition-colors",
                    isSelected ? "bg-[#FF5F1A] border-[#FF5F1A]" : "border-[#3f3f46]"
                  )}>
                    {isSelected && <Check className="w-2.5 h-2.5 text-white" />}
                  </div>
                  <div className="w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: `${m.color}20` }}>
                    <m.icon className="w-3.5 h-3.5" style={{ color: m.color }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-[#e4e4e7]">{m.label}</p>
                    <p className="text-[10px] text-[#52525b] truncate">{m.description}</p>
                  </div>
                </button>
              )
            })}
          </div>
          <div className="px-3 py-2.5 border-t border-[var(--border)]">
            <button
              onClick={() => onChange(DEFAULT_METRICS)}
              className="w-full h-7 text-[10px] text-[#71717a] hover:text-white transition-colors"
            >
              Restaurar padrão
            </button>
          </div>
        </div>
      )}
    </div>
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

const FUNNEL_TYPES: { value: FunnelType; label: string; emoji: string }[] = [
  { value: "ecommerce",   label: "E-commerce",       emoji: "🛒" },
  { value: "mensagens",   label: "Mensagens",        emoji: "💬" },
  { value: "infoproduto", label: "Infoproduto",      emoji: "🎓" },
  { value: "cadastro",    label: "Captação Leads",   emoji: "📋" },
  { value: "delivery",    label: "Delivery / Local", emoji: "🍕" },
]

export default function DashboardPage() {
  const { filterParam, dateRange, setDateRange, platformFilter, setPlatformFilter } = useFilter()
  const [activeFunnel, setActiveFunnel] = useState<FunnelType>("ecommerce")
  const [loading, setLoading] = useState(true)
  const [connected, setConnected] = useState(false)
  const [metrics, setMetrics] = useState<DashMetrics | null>(null)
  const [prevMetrics, setPrevMetrics] = useState<Partial<DashMetrics> | null>(null)
  const [dailyData, setDailyData] = useState<DailyPoint[]>([])
  const [topCampaigns, setTopCampaigns] = useState(DEMO_CAMPAIGNS)
  const [kiwifyStats, setKiwifyStats] = useState<{ total_sales: number; total_revenue: number; avg_ticket: number } | null>(null)
  const [selectedKpis, setSelectedKpis] = useState<MetricKey[]>(() => {
    if (typeof window === "undefined") return DEFAULT_METRICS
    try {
      const saved = localStorage.getItem(LS_KEY)
      return saved ? JSON.parse(saved) : DEFAULT_METRICS
    } catch { return DEFAULT_METRICS }
  })

  useEffect(() => {
    localStorage.setItem(LS_KEY, JSON.stringify(selectedKpis))
  }, [selectedKpis])

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const { since, until } = dateRange
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

      // Kiwify stats
      const kiwifyRes = await fetch(`/api/kiwify/stats?since=${since}&until=${until}`)
      if (kiwifyRes.ok) {
        const kd = await kiwifyRes.json()
        setKiwifyStats(kd.stats || null)
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
  }, [dateRange, filterParam])

  useEffect(() => { fetchData() }, [fetchData])

  const m = metrics || DEMO_METRICS
  const p = prevMetrics

  // Compute derived metrics not directly in API
  const fullMetrics: Record<MetricKey, number> = {
    spend:       m.spend,
    impressions: m.impressions,
    clicks:      m.clicks,
    ctr:         m.ctr,
    cpc:         m.cpc,
    cpa:         m.cpa,
    conversions: m.conversions,
    roas:        m.roas ?? (m.spend > 0 ? (m.conversions * m.cpa) / m.spend : 0),
    revenue:     m.roas ? m.roas * m.spend : (m.conversions * m.cpa),
    cpm:         m.cpm ?? (m.impressions > 0 ? (m.spend / m.impressions) * 1000 : 0),
    reach:          m.reach ?? 0,
    frequency:      m.frequency ?? 0,
    kiwify_sales:   kiwifyStats?.total_sales ?? 0,
    kiwify_revenue: kiwifyStats?.total_revenue ?? 0,
    kiwify_ticket:  kiwifyStats?.avg_ticket ?? 0,
  }
  const fullPrev: Partial<Record<MetricKey, number>> = {
    spend:       p?.spend,
    impressions: p?.impressions,
    clicks:      p?.clicks,
    ctr:         p?.ctr,
    cpc:         p?.cpc,
    conversions: p?.conversions,
  }

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
          <KpiSelector selected={selectedKpis} onChange={setSelectedKpis} />
          <button onClick={fetchData}
            className="w-9 h-9 flex items-center justify-center rounded-lg border border-[var(--border)] bg-[#131313] hover:bg-[#1a1410] transition-colors">
            <RefreshCw className={cn("w-3.5 h-3.5 text-[#71717a]", loading && "animate-spin")} />
          </button>
          <DateRangePicker value={dateRange} onChange={setDateRange} />
        </div>
      </div>

      {/* KPI Cards — personalizáveis */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {selectedKpis.map(key => {
          const def = ALL_METRICS.find(d => d.key === key)!
          const val = fullMetrics[key]
          const prev = fullPrev[key]
          return (
            <MetricCard
              key={key}
              label={def.label}
              value={def.format(val)}
              change={prev ? pct(val, prev) : null}
              icon={def.icon}
              color={def.color}
              loading={loading}
              invertChange={def.invertChange}
            />
          )
        })}
      </div>

      {/* Gráfico */}
      <Card>
        <CardHeader><CardTitle>Performance ao Longo do Tempo</CardTitle></CardHeader>
        <CardContent>
          <PerformanceChart externalData={dailyData.length > 0 ? dailyData : undefined} />
        </CardContent>
      </Card>

      {/* Funil de Conversão */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <CardTitle>Funil de Conversão</CardTitle>
              <p className="text-xs text-[#71717a] mt-1">Da impressão até o resultado final — calculado com seus dados reais</p>
            </div>
            <div className="flex items-center gap-1 p-1 rounded-lg bg-[#1a1410] border border-[var(--border)]">
              {FUNNEL_TYPES.map((t) => (
                <button
                  key={t.value}
                  onClick={() => setActiveFunnel(t.value)}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium transition-all cursor-pointer ${
                    activeFunnel === t.value
                      ? "bg-gradient-to-r from-[#FF5F1A] to-[#E54E0B] text-white shadow"
                      : "text-[#71717a] hover:text-white"
                  }`}
                >
                  <span>{t.emoji}</span>
                  <span>{t.label}</span>
                </button>
              ))}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <FunnelCone
            type={activeFunnel}
            impressions={m.impressions}
            clicks={m.clicks}
            conversions={m.conversions}
            spend={m.spend}
          />
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
                  <div className="h-2.5 bg-[#1a1410] rounded-full overflow-hidden">
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
                <div key={s.label} className="rounded-lg bg-[#0f0f0f] p-3">
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
              <a href="/dashboard/campanhas" className="text-xs text-[#FF5F1A] hover:underline">Ver todas →</a>
            </div>
          </CardHeader>
          <CardContent className="flex flex-col gap-0">
            {loading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="py-2.5 border-b border-[var(--border)] last:border-0">
                  <div className="h-4 bg-[#1a1410] rounded animate-pulse" />
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
        <div className="rounded-xl border border-dashed border-[#2a1f15] bg-[#131313]/40 p-5 flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-[#FF5F1A]/10 flex items-center justify-center flex-shrink-0">
            <BarChart3 className="w-5 h-5 text-[#FF5F1A]" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-white">Conecte suas contas para dados reais</p>
            <p className="text-xs text-[#71717a] mt-0.5">Dados demonstrativos com comparativo fictício. Conecte Meta Ads e Google Ads nas configurações.</p>
          </div>
          <a href="/dashboard/configuracoes"
            className="flex-shrink-0 px-3 py-2 rounded-lg bg-[#FF5F1A] text-white text-xs font-medium hover:bg-[#4f52d1] transition-colors">
            Conectar agora
          </a>
        </div>
      )}
    </div>
  )
}
