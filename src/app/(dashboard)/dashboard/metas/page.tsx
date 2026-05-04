"use client"

import { useState, useEffect, useCallback } from "react"
import {
  Flag, Plus, Trash2, RefreshCw, CheckCircle2,
  TrendingUp, TrendingDown, DollarSign, MousePointer,
  Target, BarChart3, Eye, X, Edit2, Check
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { formatCurrency, formatNumber, formatPercent, cn } from "@/lib/utils"

// ─── Types ────────────────────────────────────────────────────────────────────
type MetricKey = "spend" | "clicks" | "impressions" | "conversions" | "ctr" | "cpc" | "cpa" | "roas"
type Period     = "month" | "week" | "quarter"

interface Goal {
  id: string
  label: string
  metric: MetricKey
  target: number
  period: Period
  createdAt: string
}

interface LiveMetrics {
  spend: number; clicks: number; impressions: number
  conversions: number; ctr: number; cpc: number; cpa: number; roas: number
}

// ─── Config ───────────────────────────────────────────────────────────────────
const METRIC_CONFIG: Record<MetricKey, {
  label: string
  icon: React.ElementType
  format: (v: number) => string
  unit: string
  higherIsBetter: boolean
}> = {
  spend:       { label: "Investimento",  icon: DollarSign,  format: formatCurrency,        unit: "R$", higherIsBetter: false },
  clicks:      { label: "Cliques",       icon: MousePointer,format: formatNumber,           unit: "",   higherIsBetter: true  },
  impressions: { label: "Impressões",    icon: Eye,         format: formatNumber,           unit: "",   higherIsBetter: true  },
  conversions: { label: "Conversões",    icon: Target,      format: formatNumber,           unit: "",   higherIsBetter: true  },
  ctr:         { label: "CTR",           icon: TrendingUp,  format: (v) => `${v.toFixed(2)}%`, unit: "%", higherIsBetter: true },
  cpc:         { label: "CPC",           icon: BarChart3,   format: formatCurrency,        unit: "R$", higherIsBetter: false },
  cpa:         { label: "CPA",           icon: Target,      format: formatCurrency,        unit: "R$", higherIsBetter: false },
  roas:        { label: "ROAS",          icon: TrendingUp,  format: (v) => `${v.toFixed(2)}x`, unit: "x", higherIsBetter: true },
}

const PERIOD_LABELS: Record<Period, string> = {
  week:    "Esta semana",
  month:   "Este mês",
  quarter: "Este trimestre",
}

const DEMO_METRICS: LiveMetrics = {
  spend: 12480, clicks: 4721, impressions: 248932,
  conversions: 312, ctr: 1.89, cpc: 2.64, cpa: 39.99, roas: 3.8,
}

const DEMO_GOALS: Goal[] = [
  { id: "1", label: "Investimento mensal",  metric: "spend",       target: 15000, period: "month",   createdAt: "2025-01-01" },
  { id: "2", label: "Meta de conversões",   metric: "conversions", target: 400,   period: "month",   createdAt: "2025-01-01" },
  { id: "3", label: "ROAS mínimo",          metric: "roas",        target: 4,     period: "month",   createdAt: "2025-01-01" },
  { id: "4", label: "CPA máximo",           metric: "cpa",         target: 35,    period: "month",   createdAt: "2025-01-01" },
  { id: "5", label: "Cliques semanais",     metric: "clicks",      target: 1200,  period: "week",    createdAt: "2025-01-05" },
]

function generateId() { return Math.random().toString(36).slice(2, 10) }

function calcProgress(metric: MetricKey, current: number, target: number): number {
  if (target === 0) return 0
  const cfg = METRIC_CONFIG[metric]
  if (cfg.higherIsBetter) {
    return Math.min((current / target) * 100, 100)
  } else {
    // For spend/cpc/cpa: full bar when current <= target, shrinks when over
    return Math.min((target / Math.max(current, 0.01)) * 100, 100)
  }
}

function getStatus(metric: MetricKey, current: number, target: number): "on-track" | "at-risk" | "exceeded" | "missed" {
  const pct = (current / Math.max(target, 0.01)) * 100
  const cfg = METRIC_CONFIG[metric]
  if (cfg.higherIsBetter) {
    if (pct >= 100) return "exceeded"
    if (pct >= 70)  return "on-track"
    return "at-risk"
  } else {
    // Lower is better: exceeded means we beat target (current < target)
    if (pct <= 100) return "exceeded"
    if (pct <= 130) return "at-risk"
    return "missed"
  }
}

const STATUS_CONFIG = {
  "exceeded": { label: "Meta atingida", color: "text-emerald-400", bg: "bg-emerald-500/15", bar: "#10b981" },
  "on-track": { label: "No caminho",    color: "text-blue-400",    bg: "bg-blue-500/15",    bar: "#3b82f6" },
  "at-risk":  { label: "Em risco",      color: "text-amber-400",   bg: "bg-amber-500/15",   bar: "#f59e0b" },
  "missed":   { label: "Fora da meta",  color: "text-red-400",     bg: "bg-red-500/15",     bar: "#ef4444" },
}

// ─── Add Goal Modal ───────────────────────────────────────────────────────────
function AddGoalModal({ onClose, onAdd }: { onClose: () => void; onAdd: (g: Goal) => void }) {
  const [label, setLabel]     = useState("")
  const [metric, setMetric]   = useState<MetricKey>("spend")
  const [target, setTarget]   = useState("")
  const [period, setPeriod]   = useState<Period>("month")
  const [error, setError]     = useState("")

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!label.trim()) { setError("Nome é obrigatório"); return }
    const num = parseFloat(target)
    if (isNaN(num) || num <= 0) { setError("Defina um valor-alvo maior que zero"); return }
    onAdd({ id: generateId(), label: label.trim(), metric, target: num, period, createdAt: new Date().toISOString().split("T")[0] })
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-[#0d0d14] border border-[var(--border)] rounded-xl shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border)]">
          <h2 className="text-base font-semibold text-white">Nova Meta</h2>
          <button onClick={onClose} className="text-[#71717a] hover:text-white transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 flex flex-col gap-4">
          <div>
            <label className="block text-xs font-medium text-[#a1a1aa] mb-1.5">Nome da meta</label>
            <input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Ex: Conversões mensais"
              className="w-full h-9 px-3 rounded-lg border border-[var(--border)] bg-[#111118] text-sm text-[#f4f4f5] placeholder:text-[#52525b] outline-none focus:border-[#6366f1] transition-colors"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-[#a1a1aa] mb-1.5">Métrica</label>
              <select
                value={metric}
                onChange={(e) => setMetric(e.target.value as MetricKey)}
                className="w-full h-9 px-3 rounded-lg border border-[var(--border)] bg-[#111118] text-sm text-[#f4f4f5] outline-none focus:border-[#6366f1] cursor-pointer"
              >
                {(Object.keys(METRIC_CONFIG) as MetricKey[]).map((k) => (
                  <option key={k} value={k}>{METRIC_CONFIG[k].label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-[#a1a1aa] mb-1.5">Período</label>
              <select
                value={period}
                onChange={(e) => setPeriod(e.target.value as Period)}
                className="w-full h-9 px-3 rounded-lg border border-[var(--border)] bg-[#111118] text-sm text-[#f4f4f5] outline-none focus:border-[#6366f1] cursor-pointer"
              >
                {(Object.entries(PERIOD_LABELS) as [Period, string][]).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-[#a1a1aa] mb-1.5">
              Valor-alvo {METRIC_CONFIG[metric].unit ? `(${METRIC_CONFIG[metric].unit})` : ""}
            </label>
            <input
              type="number"
              step="any"
              min="0"
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              placeholder="0"
              className="w-full h-9 px-3 rounded-lg border border-[var(--border)] bg-[#111118] text-sm text-[#f4f4f5] placeholder:text-[#52525b] outline-none focus:border-[#6366f1] transition-colors"
            />
          </div>
          {error && <p className="text-xs text-red-400">{error}</p>}
          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 h-9 rounded-lg border border-[var(--border)] text-sm text-[#a1a1aa] hover:text-white hover:border-[#3f3f46] transition-colors">
              Cancelar
            </button>
            <button type="submit"
              className="flex-1 h-9 rounded-lg bg-[#6366f1] text-white text-sm font-medium hover:bg-[#4f52d1] transition-colors">
              Criar meta
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Goal Card ────────────────────────────────────────────────────────────────
function GoalCard({
  goal, metrics, onDelete,
}: {
  goal: Goal; metrics: LiveMetrics; onDelete: (id: string) => void
}) {
  const cfg   = METRIC_CONFIG[goal.metric]
  const Icon  = cfg.icon
  const curr  = metrics[goal.metric]
  const pct   = calcProgress(goal.metric, curr, goal.target)
  const stat  = getStatus(goal.metric, curr, goal.target)
  const sCfg  = STATUS_CONFIG[stat]
  const diff  = curr - goal.target
  const diffFmt = cfg.format(Math.abs(diff))

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[#0d0d14] p-4 hover:border-[#3f3f46] transition-colors group">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-[#1e1e2e] flex items-center justify-center flex-shrink-0">
            <Icon className="w-4 h-4 text-[#818cf8]" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-white truncate">{goal.label}</p>
            <p className="text-xs text-[#71717a]">{cfg.label} · {PERIOD_LABELS[goal.period]}</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <span className={cn("text-[10px] font-bold px-1.5 py-0.5 rounded-full uppercase tracking-wider", sCfg.bg, sCfg.color)}>
            {sCfg.label}
          </span>
          <button
            onClick={() => onDelete(goal.id)}
            className="opacity-0 group-hover:opacity-100 w-6 h-6 flex items-center justify-center rounded text-[#71717a] hover:text-red-400 hover:bg-red-500/10 transition-all"
          >
            <Trash2 className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Progress bar */}
      <div className="mb-2.5">
        <div className="flex justify-between text-xs mb-1.5">
          <span className="text-[#a1a1aa]">
            Atual: <span className="font-semibold text-white">{cfg.format(curr)}</span>
          </span>
          <span className="text-[#71717a]">
            Meta: <span className="font-medium text-[#a1a1aa]">{cfg.format(goal.target)}</span>
          </span>
        </div>
        <div className="h-2 bg-[#1e1e2e] rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-700"
            style={{ width: `${pct}%`, backgroundColor: sCfg.bar }}
          />
        </div>
        <div className="flex justify-between items-center mt-1.5">
          <span className="text-xs font-bold" style={{ color: sCfg.bar }}>{pct.toFixed(0)}%</span>
          <span className={cn("text-xs", cfg.higherIsBetter ? (diff >= 0 ? "text-emerald-400" : "text-red-400") : (diff <= 0 ? "text-emerald-400" : "text-red-400"))}>
            {cfg.higherIsBetter
              ? diff >= 0
                ? `+${diffFmt} acima da meta`
                : `${diffFmt} abaixo da meta`
              : diff <= 0
                ? `${diffFmt} melhor que a meta`
                : `${diffFmt} acima da meta`
            }
          </span>
        </div>
      </div>
    </div>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function MetasPage() {
  const [goals, setGoals]         = useState<Goal[]>([])
  const [metrics, setMetrics]     = useState<LiveMetrics>(DEMO_METRICS)
  const [connected, setConnected] = useState(false)
  const [loading, setLoading]     = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [filterPeriod, setFilterPeriod] = useState<Period | "all">("all")
  const [usingDemo, setUsingDemo] = useState(false)

  const fetchAll = useCallback(async () => {
    setLoading(true)
    try {
      const today = new Date().toISOString().split("T")[0]
      const since = new Date(Date.now() - 30 * 86400000).toISOString().split("T")[0]

      const [metricsRes, goalsRes] = await Promise.all([
        fetch(`/api/dashboard/metrics?since=${since}&until=${today}`),
        fetch("/api/goals"),
      ])

      if (metricsRes.ok) {
        const data = await metricsRes.json()
        if (data.connected && data.metrics) {
          setConnected(true)
          const m = data.metrics
          setMetrics({
            spend:       m.spend       ?? 0,
            clicks:      m.clicks      ?? 0,
            impressions: m.impressions ?? 0,
            conversions: m.conversions ?? 0,
            ctr:         m.ctr         ?? 0,
            cpc:         m.cpc         ?? 0,
            cpa:         m.cpa         ?? 0,
            roas:        m.roas        ?? (m.spend > 0 && m.conversions > 0 ? (m.conversions * 50) / m.spend : 0),
          })
        } else {
          setConnected(false); setMetrics(DEMO_METRICS)
        }
      }

      if (goalsRes.ok) {
        const data = await goalsRes.json()
        const fetched: Goal[] = (data.goals ?? []).map((g: {
          id: string; label: string; metric: string; target: number; period: string; created_at: string
        }) => ({
          id:        g.id,
          label:     g.label,
          metric:    g.metric as MetricKey,
          target:    g.target,
          period:    g.period as Period,
          createdAt: g.created_at,
        }))
        if (fetched.length > 0) {
          setGoals(fetched)
          setUsingDemo(false)
        } else {
          setGoals(DEMO_GOALS)
          setUsingDemo(true)
        }
      } else {
        setGoals(DEMO_GOALS)
        setUsingDemo(true)
      }
    } catch {
      setConnected(false); setMetrics(DEMO_METRICS)
      setGoals(DEMO_GOALS); setUsingDemo(true)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchAll() }, [fetchAll])

  async function handleAdd(goal: Goal) {
    try {
      const res = await fetch("/api/goals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label: goal.label, metric: goal.metric, target: goal.target, period: goal.period }),
      })
      if (res.ok) {
        setUsingDemo(false)
        await fetchAll()
        return
      }
    } catch { /* fall through */ }
    setGoals((prev) => [goal, ...prev])
  }

  async function handleDelete(id: string) {
    setGoals((prev) => prev.filter((g) => g.id !== id))
    if (!usingDemo) {
      await fetch(`/api/goals/${id}`, { method: "DELETE" }).catch(() => {})
    }
  }

  const filtered = filterPeriod === "all" ? goals : goals.filter((g) => g.period === filterPeriod)

  // Summary counts
  const exceeded  = goals.filter((g) => getStatus(g.metric, metrics[g.metric], g.target) === "exceeded").length
  const onTrack   = goals.filter((g) => getStatus(g.metric, metrics[g.metric], g.target) === "on-track").length
  const atRisk    = goals.filter((g) => getStatus(g.metric, metrics[g.metric], g.target) === "at-risk").length
  const missed    = goals.filter((g) => getStatus(g.metric, metrics[g.metric], g.target) === "missed").length

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white">Metas</h1>
          <p className="text-sm text-[#71717a] mt-0.5">Acompanhe o progresso das suas metas de performance</p>
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
          <button onClick={fetchAll}
            className="w-9 h-9 flex items-center justify-center rounded-lg border border-[var(--border)] bg-[#111118] hover:bg-[#1e1e2e] transition-colors">
            <RefreshCw className={cn("w-3.5 h-3.5 text-[#71717a]", loading && "animate-spin")} />
          </button>
          <button onClick={() => setShowModal(true)}
            className="flex items-center gap-2 px-3 h-9 rounded-lg bg-[#6366f1] text-white text-sm font-medium hover:bg-[#4f52d1] transition-colors">
            <Plus className="w-4 h-4" />
            Nova meta
          </button>
        </div>
      </div>

      {/* Summary strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: "Metas atingidas",  value: exceeded, color: "#10b981", icon: CheckCircle2  },
          { label: "No caminho",       value: onTrack,  color: "#3b82f6", icon: TrendingUp    },
          { label: "Em risco",         value: atRisk,   color: "#f59e0b", icon: TrendingDown  },
          { label: "Fora da meta",     value: missed,   color: "#ef4444", icon: Flag          },
        ].map((s) => {
          const Icon = s.icon
          return (
            <Card key={s.label} className="relative overflow-hidden">
              <div className="absolute inset-0 opacity-5" style={{ background: `radial-gradient(circle at top right, ${s.color}, transparent 60%)` }} />
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium text-[#71717a] uppercase tracking-wide">{s.label}</p>
                    <p className="text-2xl font-bold text-white mt-1">{loading ? "—" : s.value}</p>
                  </div>
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${s.color}20` }}>
                    <Icon className="w-5 h-5" style={{ color: s.color }} />
                  </div>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Goals grid */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-3">
            <CardTitle>Progresso das Metas</CardTitle>
            <div className="flex gap-1">
              {([["all", "Todas"], ["week", "Semana"], ["month", "Mês"], ["quarter", "Trimestre"]] as [Period | "all", string][]).map(([k, v]) => (
                <button
                  key={k}
                  onClick={() => setFilterPeriod(k)}
                  className={cn(
                    "px-3 h-7 rounded-lg text-xs font-medium transition-colors",
                    filterPeriod === k
                      ? "bg-[#6366f1] text-white"
                      : "bg-[#1e1e2e] text-[#71717a] hover:text-white"
                  )}
                >
                  {v}
                </button>
              ))}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {filtered.length === 0 ? (
            <div className="py-12 flex flex-col items-center gap-3 text-center">
              <div className="w-12 h-12 rounded-xl bg-[#1e1e2e] flex items-center justify-center">
                <Flag className="w-6 h-6 text-[#3f3f46]" />
              </div>
              <p className="text-sm font-medium text-[#71717a]">Nenhuma meta criada ainda</p>
              <button
                onClick={() => setShowModal(true)}
                className="flex items-center gap-1.5 text-xs text-[#6366f1] hover:underline"
              >
                <Plus className="w-3.5 h-3.5" />
                Criar primeira meta
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {filtered.map((goal) => (
                <GoalCard key={goal.id} goal={goal} metrics={metrics} onDelete={handleDelete} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Overview table */}
      {goals.length > 0 && (
        <Card>
          <CardHeader><CardTitle>Resumo Detalhado</CardTitle></CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--border)]">
                    {["Meta", "Métrica", "Período", "Atual", "Alvo", "Progresso", "Status"].map((h) => (
                      <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-[#71717a] uppercase tracking-wider whitespace-nowrap">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {goals.map((goal, i) => {
                    const cfg  = METRIC_CONFIG[goal.metric]
                    const curr = metrics[goal.metric]
                    const pct  = calcProgress(goal.metric, curr, goal.target)
                    const stat = getStatus(goal.metric, curr, goal.target)
                    const sCfg = STATUS_CONFIG[stat]
                    return (
                      <tr key={goal.id} className={cn("border-b border-[var(--border)] last:border-0 hover:bg-[#111118] transition-colors", loading && "opacity-50")}>
                        <td className="px-4 py-3 font-medium text-white">{goal.label}</td>
                        <td className="px-4 py-3 text-[#a1a1aa]">{cfg.label}</td>
                        <td className="px-4 py-3 text-[#71717a]">{PERIOD_LABELS[goal.period]}</td>
                        <td className="px-4 py-3 font-semibold text-white">{cfg.format(curr)}</td>
                        <td className="px-4 py-3 text-[#a1a1aa]">{cfg.format(goal.target)}</td>
                        <td className="px-4 py-3 w-32">
                          <div className="flex items-center gap-2">
                            <div className="flex-1 h-1.5 bg-[#1e1e2e] rounded-full overflow-hidden">
                              <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: sCfg.bar }} />
                            </div>
                            <span className="text-xs font-bold" style={{ color: sCfg.bar }}>{pct.toFixed(0)}%</span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className={cn("text-[10px] font-bold px-1.5 py-0.5 rounded-full uppercase tracking-wider", sCfg.bg, sCfg.color)}>
                            {sCfg.label}
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Info banner */}
      {!connected && (
        <div className="rounded-xl border border-dashed border-[#27272a] bg-[#111118]/40 p-5 flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-[#6366f1]/10 flex items-center justify-center flex-shrink-0">
            <Flag className="w-5 h-5 text-[#6366f1]" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-white">Metas com dados reais</p>
            <p className="text-xs text-[#71717a] mt-0.5">
              Conecte suas contas para comparar as metas com o desempenho real das campanhas.
            </p>
          </div>
          <a href="/dashboard/configuracoes"
            className="flex-shrink-0 px-3 py-2 rounded-lg bg-[#6366f1] text-white text-xs font-medium hover:bg-[#4f52d1] transition-colors">
            Conectar agora
          </a>
        </div>
      )}

      {showModal && <AddGoalModal onClose={() => setShowModal(false)} onAdd={handleAdd} />}
    </div>
  )
}
