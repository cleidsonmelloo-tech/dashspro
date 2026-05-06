"use client"

import { useState, useEffect, useCallback } from "react"
import {
  GitCompare, RefreshCw, TrendingUp, TrendingDown,
  DollarSign, MousePointer, Eye, Target, BarChart3,
  Minus
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { formatCurrency, formatNumber, cn } from "@/lib/utils"
import { BmCampaignFilter } from "@/components/ui/bm-campaign-filter"
import { PlatformPills } from "@/components/ui/platform-pills"
import { useFilter } from "@/lib/filter-context"

// ─── Types ────────────────────────────────────────────────────────────────────
interface PeriodMetrics {
  spend: number; impressions: number; clicks: number; conversions: number
  ctr: number; cpc: number; cpa: number; roas: number
}

const PRESET_OPTIONS = [
  { label: "Hoje vs Ontem",             a: "today",      b: "yesterday"   },
  { label: "Esta semana vs semana ant.", a: "this_week",  b: "last_week"   },
  { label: "Este mês vs mês anterior",  a: "this_month", b: "last_month"  },
  { label: "Últimos 7d vs 7d anteriores", a: "7d",       b: "prev_7d"     },
  { label: "Últimos 30d vs 30d anteriores", a: "30d",    b: "prev_30d"    },
]

const CUSTOM = "custom"

function getRange(key: string): { since: string; until: string } {
  const today = new Date()
  const fmt = (d: Date) => d.toISOString().split("T")[0]
  const ago = (n: number) => { const d = new Date(today); d.setDate(d.getDate() - n); return d }

  switch (key) {
    case "today":      return { since: fmt(today), until: fmt(today) }
    case "yesterday":  return { since: fmt(ago(1)), until: fmt(ago(1)) }
    case "this_week": {
      const dow = today.getDay() || 7
      return { since: fmt(ago(dow - 1)), until: fmt(today) }
    }
    case "last_week": {
      const dow = today.getDay() || 7
      const end   = ago(dow)
      const start = ago(dow + 6)
      return { since: fmt(start), until: fmt(end) }
    }
    case "this_month":  return { since: `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,"0")}-01`, until: fmt(today) }
    case "last_month": {
      const y = today.getMonth() === 0 ? today.getFullYear() - 1 : today.getFullYear()
      const m = today.getMonth() === 0 ? 12 : today.getMonth()
      const last = new Date(y, m, 0)
      const first = new Date(y, m - 1, 1)
      return { since: fmt(first), until: fmt(last) }
    }
    case "7d":      return { since: fmt(ago(7)),  until: fmt(today) }
    case "prev_7d": return { since: fmt(ago(14)), until: fmt(ago(8)) }
    case "30d":      return { since: fmt(ago(30)), until: fmt(today) }
    case "prev_30d": return { since: fmt(ago(60)), until: fmt(ago(31)) }
    default:         return { since: fmt(ago(30)), until: fmt(today) }
  }
}

function pct(a: number, b: number): number | null {
  if (!b || b === 0) return null
  return ((a - b) / b) * 100
}

const DEMO_A: PeriodMetrics = {
  spend: 12480, impressions: 248932, clicks: 4721, conversions: 312,
  ctr: 1.89, cpc: 2.64, cpa: 39.99, roas: 3.8,
}
const DEMO_B: PeriodMetrics = {
  spend: 11520, impressions: 221000, clicks: 4980, conversions: 263,
  ctr: 2.25, cpc: 2.31, cpa: 43.80, roas: 3.2,
}

interface MetricRow {
  key: keyof PeriodMetrics
  label: string
  icon: React.ElementType
  format: (v: number) => string
  higherIsBetter: boolean
}

const METRICS: MetricRow[] = [
  { key: "spend",       label: "Investimento",  icon: DollarSign,  format: formatCurrency,         higherIsBetter: false },
  { key: "impressions", label: "Impressões",    icon: Eye,         format: formatNumber,            higherIsBetter: true  },
  { key: "clicks",      label: "Cliques",       icon: MousePointer,format: formatNumber,            higherIsBetter: true  },
  { key: "conversions", label: "Conversões",    icon: Target,      format: formatNumber,            higherIsBetter: true  },
  { key: "ctr",         label: "CTR",           icon: TrendingUp,  format: (v) => `${v.toFixed(2)}%`, higherIsBetter: true },
  { key: "cpc",         label: "CPC",           icon: BarChart3,   format: formatCurrency,         higherIsBetter: false },
  { key: "cpa",         label: "CPA",           icon: Target,      format: formatCurrency,         higherIsBetter: false },
  { key: "roas",        label: "ROAS",          icon: TrendingUp,  format: (v) => `${v.toFixed(2)}x`, higherIsBetter: true },
]

// ─── Comparison bar ───────────────────────────────────────────────────────────
function CompareBar({ valA, valB, higherIsBetter }: { valA: number; valB: number; higherIsBetter: boolean }) {
  const total = valA + valB
  if (total === 0) return null
  const pctA = (valA / total) * 100
  const pctB = (valB / total) * 100

  const aBetter = higherIsBetter ? valA >= valB : valA <= valB

  return (
    <div className="flex h-1.5 rounded-full overflow-hidden gap-px bg-transparent">
      <div className="h-full rounded-l-full transition-all duration-700"
        style={{ width: `${pctA}%`, backgroundColor: aBetter ? "#6366f1" : "#ef4444" }} />
      <div className="h-full rounded-r-full transition-all duration-700"
        style={{ width: `${pctB}%`, backgroundColor: "#27272a" }} />
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function ComparativoPage() {
  const { filterParam } = useFilter()
  const [platformFilter, setPlatformFilter] = useState<"all" | "meta" | "google">("all")
  const [preset, setPreset]       = useState(0)
  const [useCustom, setUseCustom] = useState(false)
  const [customA, setCustomA]     = useState({ since: "", until: "" })
  const [customB, setCustomB]     = useState({ since: "", until: "" })

  const [metricsA, setMetricsA]   = useState<PeriodMetrics | null>(null)
  const [metricsB, setMetricsB]   = useState<PeriodMetrics | null>(null)
  const [connected, setConnected] = useState(false)
  const [loading, setLoading]     = useState(true)

  const [labelA, setLabelA] = useState("Período A")
  const [labelB, setLabelB] = useState("Período B")

  const fetchPeriod = useCallback(async (since: string, until: string): Promise<PeriodMetrics | null> => {
    try {
      const [metricsRes, compareRes] = await Promise.all([
        fetch(`/api/dashboard/metrics?since=${since}&until=${until}${filterParam}`),
        fetch(`/api/dashboard/compare?since=${since}&until=${until}${filterParam}`),
      ])
      if (!metricsRes.ok) return null
      const data = await metricsRes.json()
      if (!data.connected || !data.metrics) return null
      const m = data.metrics
      return {
        spend:       m.spend       ?? 0,
        impressions: m.impressions ?? 0,
        clicks:      m.clicks      ?? 0,
        conversions: m.conversions ?? 0,
        ctr:         m.ctr         ?? 0,
        cpc:         m.cpc         ?? 0,
        cpa:         m.cpa         ?? 0,
        roas:        m.roas        ?? (m.spend > 0 && m.conversions > 0 ? (m.conversions * 50) / m.spend : 0),
      }
    } catch { return null }
  }, [filterParam])

  const run = useCallback(async () => {
    setLoading(true)
    let rangeA: { since: string; until: string }
    let rangeB: { since: string; until: string }
    let lA = "Período A"
    let lB = "Período B"

    if (useCustom) {
      rangeA = customA
      rangeB = customB
      lA = `${customA.since} → ${customA.until}`
      lB = `${customB.since} → ${customB.until}`
    } else {
      const p = PRESET_OPTIONS[preset]
      rangeA = getRange(p.a)
      rangeB = getRange(p.b)
      lA = p.label.split(" vs ")[0]
      lB = p.label.split(" vs ")[1]
    }

    setLabelA(lA)
    setLabelB(lB)

    const [a, b] = await Promise.all([fetchPeriod(rangeA.since, rangeA.until), fetchPeriod(rangeB.since, rangeB.until)])

    if (a && b) {
      setConnected(true)
      setMetricsA(a)
      setMetricsB(b)
    } else {
      setConnected(false)
      setMetricsA(DEMO_A)
      setMetricsB(DEMO_B)
    }
    setLoading(false)
  }, [preset, useCustom, customA, customB, fetchPeriod])

  useEffect(() => { run() }, [run])

  const a = metricsA ?? DEMO_A
  const b = metricsB ?? DEMO_B

  // Overall score: how many metrics A won
  const aWins = METRICS.filter(m => {
    const va = a[m.key], vb = b[m.key]
    return m.higherIsBetter ? va > vb : va < vb
  }).length

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white">Comparativo de Períodos</h1>
          <p className="text-sm text-[#71717a] mt-0.5">Compare métricas entre dois períodos lado a lado</p>
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
          <button onClick={run}
            className="w-9 h-9 flex items-center justify-center rounded-lg border border-[var(--border)] bg-[#111118] hover:bg-[#1e1e2e] transition-colors">
            <RefreshCw className={cn("w-3.5 h-3.5 text-[#71717a]", loading && "animate-spin")} />
          </button>
        </div>
      </div>

      {/* Period selector */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={() => setUseCustom(false)}
                className={cn(
                  "px-3 h-7 rounded-lg text-xs font-medium transition-colors",
                  !useCustom ? "bg-[#6366f1] text-white" : "bg-[#1e1e2e] text-[#71717a] hover:text-white"
                )}
              >
                Predefinidos
              </button>
              <button
                onClick={() => setUseCustom(true)}
                className={cn(
                  "px-3 h-7 rounded-lg text-xs font-medium transition-colors",
                  useCustom ? "bg-[#6366f1] text-white" : "bg-[#1e1e2e] text-[#71717a] hover:text-white"
                )}
              >
                Personalizado
              </button>
            </div>

            {!useCustom ? (
              <div className="flex flex-wrap gap-2">
                {PRESET_OPTIONS.map((opt, i) => (
                  <button
                    key={i}
                    onClick={() => setPreset(i)}
                    className={cn(
                      "px-3 h-7 rounded-lg text-xs font-medium border transition-colors",
                      preset === i
                        ? "bg-[#6366f1]/15 border-[#6366f1]/40 text-[#818cf8]"
                        : "border-[var(--border)] text-[#71717a] hover:text-white hover:border-[#3f3f46]"
                    )}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {[
                  { label: "Período A", state: customA, setter: setCustomA },
                  { label: "Período B", state: customB, setter: setCustomB },
                ].map(({ label, state, setter }) => (
                  <div key={label} className="flex flex-col gap-2">
                    <p className="text-xs font-semibold text-[#a1a1aa]">{label}</p>
                    <div className="flex items-center gap-2">
                      <input type="date" value={state.since}
                        onChange={(e) => setter((prev) => ({ ...prev, since: e.target.value }))}
                        className="flex-1 h-9 px-3 rounded-lg border border-[var(--border)] bg-[#111118] text-sm text-[#f4f4f5] outline-none focus:border-[#6366f1] transition-colors cursor-pointer"
                      />
                      <span className="text-xs text-[#52525b]">até</span>
                      <input type="date" value={state.until}
                        onChange={(e) => setter((prev) => ({ ...prev, until: e.target.value }))}
                        className="flex-1 h-9 px-3 rounded-lg border border-[var(--border)] bg-[#111118] text-sm text-[#f4f4f5] outline-none focus:border-[#6366f1] transition-colors cursor-pointer"
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Score card */}
      <div className="grid grid-cols-3 gap-4">
        <Card className="col-span-1">
          <CardContent className="p-4 text-center">
            <p className="text-xs font-medium text-[#71717a] uppercase tracking-wide mb-1">{labelA}</p>
            <p className="text-3xl font-bold text-[#818cf8]">{loading ? "—" : aWins}</p>
            <p className="text-xs text-[#52525b] mt-1">métricas venceu</p>
          </CardContent>
        </Card>
        <Card className="col-span-1 relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-[#6366f1]/5 to-transparent" />
          <CardContent className="p-4 text-center">
            <p className="text-xs font-medium text-[#71717a] uppercase tracking-wide mb-1">Total métricas</p>
            <p className="text-3xl font-bold text-white">{METRICS.length}</p>
            <p className="text-xs text-[#52525b] mt-1">indicadores</p>
          </CardContent>
        </Card>
        <Card className="col-span-1">
          <CardContent className="p-4 text-center">
            <p className="text-xs font-medium text-[#71717a] uppercase tracking-wide mb-1">{labelB}</p>
            <p className="text-3xl font-bold text-[#71717a]">{loading ? "—" : METRICS.length - aWins}</p>
            <p className="text-xs text-[#52525b] mt-1">métricas venceu</p>
          </CardContent>
        </Card>
      </div>

      {/* Comparison table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Comparação Detalhada</CardTitle>
            <div className="flex items-center gap-4 text-xs">
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-full bg-[#6366f1]" />
                <span className="text-[#a1a1aa]">{labelA}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-full bg-[#27272a]" />
                <span className="text-[#a1a1aa]">{labelB}</span>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--border)]">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-[#71717a] uppercase tracking-wider">Métrica</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-[#6366f1] uppercase tracking-wider">{labelA}</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-[#71717a] uppercase tracking-wider">{labelB}</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-[#71717a] uppercase tracking-wider">Variação</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-[#71717a] uppercase tracking-wider w-32">Distribuição</th>
                </tr>
              </thead>
              <tbody>
                {METRICS.map((m) => {
                  const va   = a[m.key]
                  const vb   = b[m.key]
                  const diff = pct(va, vb)
                  const aBetter = m.higherIsBetter ? va >= vb : va <= vb
                  const Icon = m.icon
                  return (
                    <tr key={m.key} className="border-b border-[var(--border)] last:border-0 hover:bg-[#111118] transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-lg bg-[#1e1e2e] flex items-center justify-center flex-shrink-0">
                            <Icon className="w-3.5 h-3.5 text-[#818cf8]" />
                          </div>
                          <span className="font-medium text-white">{m.label}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className={cn(
                          "font-bold text-sm",
                          loading ? "text-[#71717a]" : aBetter ? "text-[#818cf8]" : "text-[#a1a1aa]"
                        )}>
                          {loading ? "—" : m.format(va)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="text-[#71717a] text-sm">{loading ? "—" : m.format(vb)}</span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        {loading || diff === null ? (
                          <span className="text-[#52525b] text-xs">—</span>
                        ) : (
                          <div className={cn(
                            "inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-xs font-semibold",
                            diff === 0
                              ? "bg-[#27272a] text-[#71717a]"
                              : aBetter
                                ? "bg-emerald-500/15 text-emerald-400"
                                : "bg-red-500/15 text-red-400"
                          )}>
                            {diff === 0 ? (
                              <Minus className="w-3 h-3" />
                            ) : aBetter ? (
                              <TrendingUp className="w-3 h-3" />
                            ) : (
                              <TrendingDown className="w-3 h-3" />
                            )}
                            {diff > 0 ? "+" : ""}{diff.toFixed(1)}%
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {!loading && <CompareBar valA={va} valB={vb} higherIsBetter={m.higherIsBetter} />}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Visual KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {METRICS.slice(0, 8).map((m) => {
          const va   = a[m.key]
          const vb   = b[m.key]
          const diff = pct(va, vb)
          const aBetter = m.higherIsBetter ? va >= vb : va <= vb
          const Icon = m.icon
          return (
            <Card key={m.key} className="overflow-hidden">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs font-medium text-[#71717a] uppercase tracking-wide">{m.label}</p>
                  <Icon className="w-4 h-4 text-[#52525b]" />
                </div>
                <div className="flex flex-col gap-2">
                  <div>
                    <p className="text-[10px] text-[#6366f1] font-semibold mb-0.5">{labelA}</p>
                    <p className="text-xl font-bold text-white">{loading ? "—" : m.format(va)}</p>
                  </div>
                  <div className="pt-2 border-t border-[var(--border)]">
                    <p className="text-[10px] text-[#52525b] font-semibold mb-0.5">{labelB}</p>
                    <p className="text-sm font-medium text-[#71717a]">{loading ? "—" : m.format(vb)}</p>
                  </div>
                  {!loading && diff !== null && (
                    <div className={cn(
                      "flex items-center gap-0.5 text-xs font-semibold",
                      aBetter ? "text-emerald-400" : "text-red-400"
                    )}>
                      {aBetter ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                      {diff > 0 ? "+" : ""}{diff.toFixed(1)}%
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Info banner */}
      {!connected && (
        <div className="rounded-xl border border-dashed border-[#27272a] bg-[#111118]/40 p-5 flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-[#6366f1]/10 flex items-center justify-center flex-shrink-0">
            <GitCompare className="w-5 h-5 text-[#6366f1]" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-white">Comparativo com dados reais</p>
            <p className="text-xs text-[#71717a] mt-0.5">
              Conecte suas contas para comparar períodos reais das suas campanhas.
            </p>
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
