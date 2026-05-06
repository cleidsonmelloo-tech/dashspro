"use client"

import { useState, useEffect, useCallback } from "react"
import {
  Bell, Plus, Trash2, RefreshCw, AlertTriangle,
  CheckCircle2, TrendingUp, TrendingDown, DollarSign,
  MousePointer, Eye, Target, BarChart3, X
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { formatCurrency, formatNumber, formatPercent, cn } from "@/lib/utils"
import { BmCampaignFilter } from "@/components/ui/bm-campaign-filter"
import { useFilter } from "@/lib/filter-context"

// ─── Types ────────────────────────────────────────────────────────────────────
type MetricKey = "spend" | "ctr" | "cpc" | "cpa" | "impressions" | "clicks" | "conversions" | "roas"
type Operator  = "gt" | "lt" | "gte" | "lte"
type Severity  = "info" | "warning" | "critical"

interface Alert {
  id: string
  name: string
  metric: MetricKey
  operator: Operator
  threshold: number
  severity: Severity
  active: boolean
  createdAt: string
}

interface LiveMetrics {
  spend: number
  ctr: number
  cpc: number
  cpa: number
  impressions: number
  clicks: number
  conversions: number
  roas: number
}

interface AlertTriggered {
  alertId: string
  currentValue: number
  threshold: number
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const METRIC_META: Record<MetricKey, { label: string; icon: React.ElementType; format: (v: number) => string; unit: string }> = {
  spend:       { label: "Investimento (R$)",  icon: DollarSign,  format: formatCurrency,  unit: "R$"  },
  ctr:         { label: "CTR (%)",            icon: TrendingUp,  format: (v) => `${v.toFixed(2)}%`, unit: "%"   },
  cpc:         { label: "CPC (R$)",           icon: MousePointer,format: formatCurrency,  unit: "R$"  },
  cpa:         { label: "CPA (R$)",           icon: Target,      format: formatCurrency,  unit: "R$"  },
  impressions: { label: "Impressões",         icon: Eye,         format: formatNumber,    unit: ""    },
  clicks:      { label: "Cliques",            icon: MousePointer,format: formatNumber,    unit: ""    },
  conversions: { label: "Conversões",         icon: Target,      format: formatNumber,    unit: ""    },
  roas:        { label: "ROAS",               icon: BarChart3,   format: (v) => `${v.toFixed(2)}x`, unit: "x"   },
}

const OPERATOR_LABELS: Record<Operator, string> = {
  gt:  "maior que",
  lt:  "menor que",
  gte: "maior ou igual a",
  lte: "menor ou igual a",
}

const SEVERITY_CONFIG: Record<Severity, { label: string; color: string; bg: string; border: string }> = {
  info:     { label: "Informativo", color: "text-blue-400",    bg: "bg-blue-500/10",    border: "border-blue-500/30"    },
  warning:  { label: "Atenção",     color: "text-amber-400",   bg: "bg-amber-500/10",   border: "border-amber-500/30"   },
  critical: { label: "Crítico",     color: "text-red-400",     bg: "bg-red-500/10",     border: "border-red-500/30"     },
}

const DEMO_METRICS: LiveMetrics = {
  spend: 12480, ctr: 1.89, cpc: 2.64, cpa: 39.99,
  impressions: 248932, clicks: 4721, conversions: 312, roas: 3.8,
}

const DEMO_ALERTS: Alert[] = [
  { id: "1", name: "Gasto diário alto",      metric: "spend",       operator: "gt",  threshold: 500,   severity: "warning",  active: true,  createdAt: "2025-01-15" },
  { id: "2", name: "CTR abaixo do mínimo",   metric: "ctr",         operator: "lt",  threshold: 1.5,   severity: "critical", active: true,  createdAt: "2025-01-15" },
  { id: "3", name: "CPA muito alto",         metric: "cpa",         operator: "gt",  threshold: 50,    severity: "critical", active: true,  createdAt: "2025-01-16" },
  { id: "4", name: "Impressões satisfatórias", metric: "impressions", operator: "gte", threshold: 100000, severity: "info",    active: false, createdAt: "2025-01-17" },
]

function isTriggered(alert: Alert, metrics: LiveMetrics): boolean {
  const value = metrics[alert.metric]
  switch (alert.operator) {
    case "gt":  return value > alert.threshold
    case "lt":  return value < alert.threshold
    case "gte": return value >= alert.threshold
    case "lte": return value <= alert.threshold
  }
}

function generateId() {
  return Math.random().toString(36).slice(2, 10)
}

// ─── Add Alert Modal ──────────────────────────────────────────────────────────
function AddAlertModal({
  onClose,
  onAdd,
}: {
  onClose: () => void
  onAdd: (alert: Alert) => void
}) {
  const [name, setName]           = useState("")
  const [metric, setMetric]       = useState<MetricKey>("spend")
  const [operator, setOperator]   = useState<Operator>("gt")
  const [threshold, setThreshold] = useState("")
  const [severity, setSeverity]   = useState<Severity>("warning")
  const [error, setError]         = useState("")

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) { setError("Nome é obrigatório"); return }
    const num = parseFloat(threshold)
    if (isNaN(num) || num < 0) { setError("Limite inválido"); return }

    onAdd({
      id: generateId(),
      name: name.trim(),
      metric,
      operator,
      threshold: num,
      severity,
      active: true,
      createdAt: new Date().toISOString().split("T")[0],
    })
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-[#0d0d14] border border-[var(--border)] rounded-xl shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border)]">
          <h2 className="text-base font-semibold text-white">Novo Alerta</h2>
          <button onClick={onClose} className="text-[#71717a] hover:text-white transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 flex flex-col gap-4">
          {/* Nome */}
          <div>
            <label className="block text-xs font-medium text-[#a1a1aa] mb-1.5">Nome do alerta</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: CPA alto demais"
              className="w-full h-9 px-3 rounded-lg border border-[var(--border)] bg-[#111118] text-sm text-[#f4f4f5] placeholder:text-[#52525b] outline-none focus:border-[#6366f1] transition-colors"
            />
          </div>

          {/* Métrica */}
          <div>
            <label className="block text-xs font-medium text-[#a1a1aa] mb-1.5">Métrica</label>
            <select
              value={metric}
              onChange={(e) => setMetric(e.target.value as MetricKey)}
              className="w-full h-9 px-3 rounded-lg border border-[var(--border)] bg-[#111118] text-sm text-[#f4f4f5] outline-none focus:border-[#6366f1] cursor-pointer"
            >
              {(Object.keys(METRIC_META) as MetricKey[]).map((k) => (
                <option key={k} value={k}>{METRIC_META[k].label}</option>
              ))}
            </select>
          </div>

          {/* Operador + Threshold */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-[#a1a1aa] mb-1.5">Condição</label>
              <select
                value={operator}
                onChange={(e) => setOperator(e.target.value as Operator)}
                className="w-full h-9 px-3 rounded-lg border border-[var(--border)] bg-[#111118] text-sm text-[#f4f4f5] outline-none focus:border-[#6366f1] cursor-pointer"
              >
                {(Object.entries(OPERATOR_LABELS) as [Operator, string][]).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-[#a1a1aa] mb-1.5">
                Limite {METRIC_META[metric].unit ? `(${METRIC_META[metric].unit})` : ""}
              </label>
              <input
                type="number"
                step="any"
                min="0"
                value={threshold}
                onChange={(e) => setThreshold(e.target.value)}
                placeholder="0"
                className="w-full h-9 px-3 rounded-lg border border-[var(--border)] bg-[#111118] text-sm text-[#f4f4f5] placeholder:text-[#52525b] outline-none focus:border-[#6366f1] transition-colors"
              />
            </div>
          </div>

          {/* Severidade */}
          <div>
            <label className="block text-xs font-medium text-[#a1a1aa] mb-1.5">Severidade</label>
            <div className="flex gap-2">
              {(Object.entries(SEVERITY_CONFIG) as [Severity, typeof SEVERITY_CONFIG[Severity]][]).map(([k, cfg]) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setSeverity(k)}
                  className={cn(
                    "flex-1 py-2 rounded-lg border text-xs font-medium transition-all",
                    severity === k
                      ? `${cfg.bg} ${cfg.border} ${cfg.color}`
                      : "border-[var(--border)] text-[#71717a] hover:border-[#3f3f46]"
                  )}
                >
                  {cfg.label}
                </button>
              ))}
            </div>
          </div>

          {error && <p className="text-xs text-red-400">{error}</p>}

          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 h-9 rounded-lg border border-[var(--border)] text-sm text-[#a1a1aa] hover:text-white hover:border-[#3f3f46] transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="flex-1 h-9 rounded-lg bg-[#6366f1] text-white text-sm font-medium hover:bg-[#4f52d1] transition-colors"
            >
              Criar alerta
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Alert Card ───────────────────────────────────────────────────────────────
function AlertCard({
  alert,
  metrics,
  onDelete,
  onToggle,
}: {
  alert: Alert
  metrics: LiveMetrics
  onDelete: (id: string) => void
  onToggle: (id: string) => void
}) {
  const triggered = alert.active && isTriggered(alert, metrics)
  const cfg = SEVERITY_CONFIG[alert.severity]
  const meta = METRIC_META[alert.metric]
  const Icon = meta.icon
  const currentValue = metrics[alert.metric]

  return (
    <div className={cn(
      "rounded-xl border p-4 transition-all",
      triggered
        ? `${cfg.bg} ${cfg.border}`
        : "bg-[#0d0d14] border-[var(--border)]",
      !alert.active && "opacity-50"
    )}>
      <div className="flex items-start gap-3">
        {/* Status icon */}
        <div className={cn(
          "flex items-center justify-center w-8 h-8 rounded-lg flex-shrink-0 mt-0.5",
          triggered ? cfg.bg : "bg-[#1e1e2e]"
        )}>
          {triggered
            ? <AlertTriangle className={cn("w-4 h-4", cfg.color)} />
            : <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          }
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold text-white truncate">{alert.name}</span>
            <span className={cn(
              "text-[10px] font-bold px-1.5 py-0.5 rounded-full uppercase tracking-wider",
              cfg.bg, cfg.color
            )}>
              {cfg.label}
            </span>
            {!alert.active && (
              <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-[#27272a] text-[#71717a] uppercase tracking-wider">
                Pausado
              </span>
            )}
          </div>

          <p className="text-xs text-[#71717a] mt-1">
            <span className="font-medium text-[#a1a1aa]">{meta.label}</span>
            {" "}{OPERATOR_LABELS[alert.operator]}{" "}
            <span className="font-semibold text-white">{meta.format(alert.threshold)}</span>
          </p>

          {/* Current value bar */}
          <div className="mt-3 flex items-center gap-3">
            <div className="flex items-center gap-1.5 text-xs">
              <Icon className="w-3 h-3 text-[#71717a]" />
              <span className="text-[#71717a]">Atual:</span>
              <span className={cn("font-bold", triggered ? cfg.color : "text-white")}>
                {meta.format(currentValue)}
              </span>
            </div>

            {triggered && (
              <div className={cn("flex items-center gap-0.5 text-xs font-semibold", cfg.color)}>
                <AlertTriangle className="w-3 h-3" />
                Alerta disparado!
              </div>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            onClick={() => onToggle(alert.id)}
            className={cn(
              "text-xs px-2 py-1 rounded-md border transition-colors",
              alert.active
                ? "border-[var(--border)] text-[#71717a] hover:text-white hover:border-[#3f3f46]"
                : "border-emerald-500/30 text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20"
            )}
          >
            {alert.active ? "Pausar" : "Ativar"}
          </button>
          <button
            onClick={() => onDelete(alert.id)}
            className="w-7 h-7 flex items-center justify-center rounded-md text-[#71717a] hover:text-red-400 hover:bg-red-500/10 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function AlertasPage() {
  const { filterParam } = useFilter()
  const [alerts, setAlerts]       = useState<Alert[]>([])
  const [metrics, setMetrics]     = useState<LiveMetrics>(DEMO_METRICS)
  const [connected, setConnected] = useState(false)
  const [loading, setLoading]     = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [filter, setFilter]       = useState<"all" | "active" | "triggered">("all")
  const [usingDemo, setUsingDemo] = useState(false)

  const fetchAll = useCallback(async () => {
    setLoading(true)
    try {
      const today = new Date().toISOString().split("T")[0]
      const since30 = new Date(Date.now() - 30 * 86400000).toISOString().split("T")[0]

      const [metricsRes, alertsRes] = await Promise.all([
        fetch(`/api/dashboard/metrics?since=${since30}&until=${today}${filterParam}`),
        fetch("/api/alerts"),
      ])

      // Metrics
      if (metricsRes.ok) {
        const data = await metricsRes.json()
        if (data.connected && data.metrics) {
          setConnected(true)
          const m = data.metrics
          setMetrics({
            spend:       m.spend       ?? 0,
            ctr:         m.ctr         ?? 0,
            cpc:         m.cpc         ?? 0,
            cpa:         m.cpa         ?? 0,
            impressions: m.impressions ?? 0,
            clicks:      m.clicks      ?? 0,
            conversions: m.conversions ?? 0,
            roas:        m.roas        ?? (m.spend > 0 && m.conversions > 0 ? (m.conversions * 50) / m.spend : 0),
          })
        } else {
          setConnected(false)
          setMetrics(DEMO_METRICS)
        }
      }

      // Alerts — if API returns empty (new user), show demo alerts
      if (alertsRes.ok) {
        const data = await alertsRes.json()
        const fetched: Alert[] = (data.alerts ?? []).map((a: {
          id: string; name: string; metric: string; operator: string;
          threshold: number; severity: string; active: boolean; created_at: string
        }) => ({
          id:        a.id,
          name:      a.name,
          metric:    a.metric as MetricKey,
          operator:  a.operator as Operator,
          threshold: a.threshold,
          severity:  a.severity as Severity,
          active:    a.active,
          createdAt: a.created_at,
        }))
        if (fetched.length > 0) {
          setAlerts(fetched)
          setUsingDemo(false)
        } else {
          setAlerts(DEMO_ALERTS)
          setUsingDemo(true)
        }
      } else {
        setAlerts(DEMO_ALERTS)
        setUsingDemo(true)
      }
    } catch {
      setConnected(false)
      setMetrics(DEMO_METRICS)
      setAlerts(DEMO_ALERTS)
      setUsingDemo(true)
    } finally {
      setLoading(false)
    }
  }, [filterParam])

  useEffect(() => { fetchAll() }, [fetchAll])

  async function handleAdd(alert: Alert) {
    if (usingDemo) {
      // Save to DB — it's a real new alert
      try {
        const res = await fetch("/api/alerts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: alert.name, metric: alert.metric, operator: alert.operator,
            threshold: alert.threshold, severity: alert.severity,
          }),
        })
        if (res.ok) {
          setUsingDemo(false)
          await fetchAll()
          return
        }
      } catch { /* fall through to local */ }
    } else {
      try {
        const res = await fetch("/api/alerts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: alert.name, metric: alert.metric, operator: alert.operator,
            threshold: alert.threshold, severity: alert.severity,
          }),
        })
        if (res.ok) {
          await fetchAll()
          return
        }
      } catch { /* fall through */ }
    }
    setAlerts((prev) => [alert, ...prev])
  }

  async function handleDelete(id: string) {
    setAlerts((prev) => prev.filter((a) => a.id !== id))
    if (!usingDemo) {
      await fetch(`/api/alerts/${id}`, { method: "DELETE" }).catch(() => {})
    }
  }

  async function handleToggle(id: string) {
    const target = alerts.find((a) => a.id === id)
    if (!target) return
    const newActive = !target.active
    setAlerts((prev) => prev.map((a) => a.id === id ? { ...a, active: newActive } : a))
    if (!usingDemo) {
      await fetch(`/api/alerts/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: newActive }),
      }).catch(() => {})
    }
  }

  const triggeredAlerts  = alerts.filter((a) => a.active && isTriggered(a, metrics))
  const filteredAlerts = alerts.filter((a) => {
    if (filter === "active")    return a.active
    if (filter === "triggered") return a.active && isTriggered(a, metrics)
    return true
  })

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white">Alertas</h1>
          <p className="text-sm text-[#71717a] mt-0.5">Monitore métricas e receba avisos automáticos</p>
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
          <BmCampaignFilter />
          <button
            onClick={fetchAll}
            className="w-9 h-9 flex items-center justify-center rounded-lg border border-[var(--border)] bg-[#111118] hover:bg-[#1e1e2e] transition-colors"
          >
            <RefreshCw className={cn("w-3.5 h-3.5 text-[#71717a]", loading && "animate-spin")} />
          </button>
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 px-3 h-9 rounded-lg bg-[#6366f1] text-white text-sm font-medium hover:bg-[#4f52d1] transition-colors"
          >
            <Plus className="w-4 h-4" />
            Novo alerta
          </button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: "Total de alertas",   value: alerts.length,                           color: "#6366f1", icon: Bell          },
          { label: "Alertas ativos",     value: alerts.filter((a) => a.active).length,   color: "#10b981", icon: CheckCircle2  },
          { label: "Disparados agora",   value: triggeredAlerts.length,                  color: "#ef4444", icon: AlertTriangle },
          { label: "Pausados",           value: alerts.filter((a) => !a.active).length,  color: "#f59e0b", icon: TrendingDown  },
        ].map((s) => {
          const Icon = s.icon
          return (
            <Card key={s.label} className="relative overflow-hidden">
              <div className="absolute inset-0 opacity-5" style={{ background: `radial-gradient(circle at top right, ${s.color}, transparent 60%)` }} />
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium text-[#71717a] uppercase tracking-wide">{s.label}</p>
                    <p className="text-2xl font-bold text-white mt-1">{s.value}</p>
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

      {/* Triggered banner */}
      {triggeredAlerts.length > 0 && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-red-500/20 flex items-center justify-center flex-shrink-0">
            <AlertTriangle className="w-4 h-4 text-red-400" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-red-300">
              {triggeredAlerts.length} {triggeredAlerts.length === 1 ? "alerta disparado" : "alertas disparados"} com os dados atuais
            </p>
            <p className="text-xs text-red-400/70 mt-0.5">
              {triggeredAlerts.map((a) => a.name).join(" · ")}
            </p>
          </div>
        </div>
      )}

      {/* Metrics snapshot */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Snapshot de Métricas Atuais</CardTitle>
            <span className="text-xs text-[#52525b]">Últimos 30 dias</span>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {(Object.entries(METRIC_META) as [MetricKey, typeof METRIC_META[MetricKey]][]).map(([key, meta]) => {
              const Icon = meta.icon
              const value = metrics[key]
              const triggeredHere = alerts.some((a) => a.active && a.metric === key && isTriggered(a, metrics))
              return (
                <div key={key} className={cn(
                  "rounded-lg p-3 border",
                  triggeredHere
                    ? "bg-red-500/10 border-red-500/30"
                    : "bg-[#0d0d14] border-[var(--border)]"
                )}>
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <Icon className={cn("w-3.5 h-3.5", triggeredHere ? "text-red-400" : "text-[#71717a]")} />
                    <p className="text-[10px] font-medium text-[#71717a] uppercase tracking-wide truncate">{meta.label}</p>
                  </div>
                  <p className={cn(
                    "text-lg font-bold",
                    loading ? "text-[#71717a]" : triggeredHere ? "text-red-300" : "text-white"
                  )}>
                    {loading ? "—" : meta.format(value)}
                  </p>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {/* Alerts list */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-3">
            <CardTitle>Seus Alertas</CardTitle>
            <div className="flex gap-1">
              {(["all", "active", "triggered"] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={cn(
                    "px-3 h-7 rounded-lg text-xs font-medium transition-colors",
                    filter === f
                      ? "bg-[#6366f1] text-white"
                      : "bg-[#1e1e2e] text-[#71717a] hover:text-white"
                  )}
                >
                  {f === "all" ? "Todos" : f === "active" ? "Ativos" : "Disparados"}
                </button>
              ))}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {filteredAlerts.length === 0 ? (
            <div className="py-12 flex flex-col items-center gap-3 text-center">
              <div className="w-12 h-12 rounded-xl bg-[#1e1e2e] flex items-center justify-center">
                <Bell className="w-6 h-6 text-[#3f3f46]" />
              </div>
              <p className="text-sm font-medium text-[#71717a]">
                {filter === "triggered"
                  ? "Nenhum alerta disparado no momento"
                  : "Nenhum alerta criado ainda"}
              </p>
              {filter === "all" && (
                <button
                  onClick={() => setShowModal(true)}
                  className="flex items-center gap-1.5 text-xs text-[#6366f1] hover:underline"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Criar primeiro alerta
                </button>
              )}
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {filteredAlerts.map((alert) => (
                <AlertCard
                  key={alert.id}
                  alert={alert}
                  metrics={metrics}
                  onDelete={handleDelete}
                  onToggle={handleToggle}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Info banner */}
      {!connected && (
        <div className="rounded-xl border border-dashed border-[#27272a] bg-[#111118]/40 p-5 flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-[#6366f1]/10 flex items-center justify-center flex-shrink-0">
            <Bell className="w-5 h-5 text-[#6366f1]" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-white">Alertas com dados reais</p>
            <p className="text-xs text-[#71717a] mt-0.5">
              Conecte Meta Ads e Google Ads para que os alertas monitorem métricas reais das suas campanhas.
            </p>
          </div>
          <a
            href="/dashboard/configuracoes"
            className="flex-shrink-0 px-3 py-2 rounded-lg bg-[#6366f1] text-white text-xs font-medium hover:bg-[#4f52d1] transition-colors"
          >
            Conectar agora
          </a>
        </div>
      )}

      {/* Add alert modal */}
      {showModal && (
        <AddAlertModal onClose={() => setShowModal(false)} onAdd={handleAdd} />
      )}
    </div>
  )
}
