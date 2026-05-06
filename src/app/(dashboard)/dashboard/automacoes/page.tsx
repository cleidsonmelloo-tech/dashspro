"use client"

import { useState, useEffect, useCallback } from "react"
import {
  Zap, Plus, Trash2, RefreshCw, PlayCircle, PauseCircle,
  TrendingUp, TrendingDown, DollarSign, MousePointer,
  Target, BarChart3, Eye, X, ChevronRight, Clock
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { formatCurrency, formatNumber, cn } from "@/lib/utils"

// ─── Types ────────────────────────────────────────────────────────────────────
type MetricKey = "spend" | "ctr" | "cpc" | "cpa" | "impressions" | "clicks" | "conversions" | "roas"
type Operator  = "gt" | "lt" | "gte" | "lte"
type Action    = "pause_campaign" | "increase_budget" | "decrease_budget" | "notify"
type Platform  = "meta" | "google" | "all"

interface Automation {
  id: string
  name: string
  metric: MetricKey
  operator: Operator
  threshold: number
  action: Action
  action_value?: number
  platform: Platform
  active: boolean
  last_triggered_at?: string | null
  created_at: string
}

// ─── Config ───────────────────────────────────────────────────────────────────
const METRIC_CONFIG: Record<MetricKey, { label: string; icon: React.ElementType; format: (v: number) => string; unit: string }> = {
  spend:       { label: "Investimento",  icon: DollarSign,  format: formatCurrency,         unit: "R$" },
  ctr:         { label: "CTR",           icon: TrendingUp,  format: (v) => `${v.toFixed(2)}%`, unit: "%" },
  cpc:         { label: "CPC",           icon: BarChart3,   format: formatCurrency,         unit: "R$" },
  cpa:         { label: "CPA",           icon: Target,      format: formatCurrency,         unit: "R$" },
  impressions: { label: "Impressões",    icon: Eye,         format: formatNumber,           unit: ""   },
  clicks:      { label: "Cliques",       icon: MousePointer,format: formatNumber,           unit: ""   },
  conversions: { label: "Conversões",    icon: Target,      format: formatNumber,           unit: ""   },
  roas:        { label: "ROAS",          icon: TrendingUp,  format: (v) => `${v.toFixed(2)}x`, unit: "x" },
}

const OPERATOR_LABELS: Record<Operator, string> = {
  gt: "maior que", lt: "menor que", gte: "maior ou igual a", lte: "menor ou igual a",
}

const ACTION_CONFIG: Record<Action, {
  label: string; description: string; color: string; bg: string; hasValue: boolean; valueLabel?: string
}> = {
  pause_campaign:   { label: "Pausar campanha",       description: "Para a campanha automaticamente",             color: "text-red-400",    bg: "bg-red-500/10",    hasValue: false },
  increase_budget:  { label: "Aumentar orçamento",    description: "Incrementa o budget em % definido",          color: "text-emerald-400",bg: "bg-emerald-500/10",hasValue: true,  valueLabel: "% de aumento" },
  decrease_budget:  { label: "Reduzir orçamento",     description: "Diminui o budget em % definido",             color: "text-amber-400",  bg: "bg-amber-500/10",  hasValue: true,  valueLabel: "% de redução"  },
  notify:           { label: "Enviar notificação",    description: "Registra um aviso no painel de alertas",     color: "text-blue-400",   bg: "bg-blue-500/10",   hasValue: false },
}

const PLATFORM_LABELS: Record<Platform, string> = {
  meta: "Meta Ads", google: "Google Ads", all: "Ambas",
}

const DEMO_AUTOMATIONS: Automation[] = [
  {
    id: "1", name: "Pausar se CPA > R$60",
    metric: "cpa", operator: "gt", threshold: 60, action: "pause_campaign",
    platform: "all", active: true, last_triggered_at: null, created_at: "2025-01-10",
  },
  {
    id: "2", name: "Aumentar budget se ROAS > 5x",
    metric: "roas", operator: "gt", threshold: 5, action: "increase_budget", action_value: 20,
    platform: "meta", active: true, last_triggered_at: "2025-01-14", created_at: "2025-01-10",
  },
  {
    id: "3", name: "Alerta CTR baixo",
    metric: "ctr", operator: "lt", threshold: 1.0, action: "notify",
    platform: "google", active: false, last_triggered_at: null, created_at: "2025-01-12",
  },
]

function generateId() { return Math.random().toString(36).slice(2, 10) }

// ─── Condition builder text ───────────────────────────────────────────────────
function conditionText(auto: Automation): string {
  const m = METRIC_CONFIG[auto.metric]
  return `Se ${m.label} ${OPERATOR_LABELS[auto.operator]} ${m.format(auto.threshold)} em ${PLATFORM_LABELS[auto.platform]}`
}

function actionText(auto: Automation): string {
  const a = ACTION_CONFIG[auto.action]
  if (auto.action_value && ACTION_CONFIG[auto.action].hasValue) {
    return `${a.label} em ${auto.action_value}%`
  }
  return a.label
}

// ─── Add Automation Modal ─────────────────────────────────────────────────────
function AddModal({ onClose, onAdd }: { onClose: () => void; onAdd: (a: Automation) => void }) {
  const [name, setName]               = useState("")
  const [metric, setMetric]           = useState<MetricKey>("cpa")
  const [operator, setOperator]       = useState<Operator>("gt")
  const [threshold, setThreshold]     = useState("")
  const [action, setAction]           = useState<Action>("notify")
  const [actionValue, setActionValue] = useState("")
  const [platform, setPlatform]       = useState<Platform>("all")
  const [error, setError]             = useState("")
  const [step, setStep]               = useState<1 | 2>(1)

  function handleNext() {
    if (!name.trim()) { setError("Nome é obrigatório"); return }
    const num = parseFloat(threshold)
    if (isNaN(num) || num < 0) { setError("Limite inválido"); return }
    setError("")
    setStep(2)
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const num = parseFloat(threshold)
    const avNum = actionValue ? parseFloat(actionValue) : undefined
    if (ACTION_CONFIG[action].hasValue && (!avNum || avNum <= 0)) {
      setError("Defina o valor da ação"); return
    }
    onAdd({
      id: generateId(), name: name.trim(),
      metric, operator, threshold: num, action,
      action_value: avNum,
      platform, active: true,
      last_triggered_at: null, created_at: new Date().toISOString().split("T")[0],
    })
    onClose()
  }

  const aCfg = ACTION_CONFIG[action]

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="w-full max-w-lg bg-[#0f0f0f] border border-[var(--border)] rounded-xl shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border)]">
          <div>
            <h2 className="text-base font-semibold text-white">Nova Automação</h2>
            <p className="text-xs text-[#71717a] mt-0.5">
              Etapa {step} de 2 — {step === 1 ? "Condição" : "Ação"}
            </p>
          </div>
          <button onClick={onClose} className="text-[#71717a] hover:text-white transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 flex flex-col gap-4">
          {step === 1 ? (
            <>
              {/* Step 1: Condition */}
              <div>
                <label className="block text-xs font-medium text-[#a1a1aa] mb-1.5">Nome da automação</label>
                <input
                  value={name} onChange={(e) => setName(e.target.value)}
                  placeholder="Ex: Pausar campanha se CPA alto"
                  className="w-full h-9 px-3 rounded-lg border border-[var(--border)] bg-[#131313] text-sm text-[#f4f4f5] placeholder:text-[#52525b] outline-none focus:border-[#FF5F1A] transition-colors"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-[#a1a1aa] mb-1.5">Métrica</label>
                  <select value={metric} onChange={(e) => setMetric(e.target.value as MetricKey)}
                    className="w-full h-9 px-3 rounded-lg border border-[var(--border)] bg-[#131313] text-sm text-[#f4f4f5] outline-none focus:border-[#FF5F1A] cursor-pointer">
                    {(Object.keys(METRIC_CONFIG) as MetricKey[]).map((k) => (
                      <option key={k} value={k}>{METRIC_CONFIG[k].label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#a1a1aa] mb-1.5">Plataforma</label>
                  <select value={platform} onChange={(e) => setPlatform(e.target.value as Platform)}
                    className="w-full h-9 px-3 rounded-lg border border-[var(--border)] bg-[#131313] text-sm text-[#f4f4f5] outline-none focus:border-[#FF5F1A] cursor-pointer">
                    {(Object.entries(PLATFORM_LABELS) as [Platform, string][]).map(([k, v]) => (
                      <option key={k} value={k}>{v}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-[#a1a1aa] mb-1.5">Condição</label>
                  <select value={operator} onChange={(e) => setOperator(e.target.value as Operator)}
                    className="w-full h-9 px-3 rounded-lg border border-[var(--border)] bg-[#131313] text-sm text-[#f4f4f5] outline-none focus:border-[#FF5F1A] cursor-pointer">
                    {(Object.entries(OPERATOR_LABELS) as [Operator, string][]).map(([k, v]) => (
                      <option key={k} value={k}>{v}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#a1a1aa] mb-1.5">
                    Limite {METRIC_CONFIG[metric].unit ? `(${METRIC_CONFIG[metric].unit})` : ""}
                  </label>
                  <input type="number" step="any" min="0" value={threshold}
                    onChange={(e) => setThreshold(e.target.value)}
                    placeholder="0"
                    className="w-full h-9 px-3 rounded-lg border border-[var(--border)] bg-[#131313] text-sm text-[#f4f4f5] placeholder:text-[#52525b] outline-none focus:border-[#FF5F1A] transition-colors"
                  />
                </div>
              </div>
              {/* Preview */}
              {name && threshold && (
                <div className="rounded-lg bg-[#131313] border border-[var(--border)] p-3 text-xs text-[#a1a1aa]">
                  <span className="text-[#71717a]">Condição: </span>
                  <span className="text-white font-medium">
                    {`Se ${METRIC_CONFIG[metric].label} ${OPERATOR_LABELS[operator]} ${METRIC_CONFIG[metric].format(parseFloat(threshold) || 0)} em ${PLATFORM_LABELS[platform]}`}
                  </span>
                </div>
              )}
            </>
          ) : (
            <>
              {/* Step 2: Action */}
              <div>
                <label className="block text-xs font-medium text-[#a1a1aa] mb-2">Ação a executar</label>
                <div className="grid grid-cols-2 gap-2">
                  {(Object.entries(ACTION_CONFIG) as [Action, typeof ACTION_CONFIG[Action]][]).map(([k, cfg]) => (
                    <button
                      key={k} type="button" onClick={() => setAction(k)}
                      className={cn(
                        "text-left p-3 rounded-lg border transition-all",
                        action === k
                          ? `${cfg.bg} border-current ${cfg.color}`
                          : "border-[var(--border)] text-[#71717a] hover:border-[#3f3f46] hover:text-[#a1a1aa]"
                      )}
                    >
                      <p className="text-xs font-semibold">{cfg.label}</p>
                      <p className="text-[10px] mt-0.5 opacity-70">{cfg.description}</p>
                    </button>
                  ))}
                </div>
              </div>

              {aCfg.hasValue && (
                <div>
                  <label className="block text-xs font-medium text-[#a1a1aa] mb-1.5">{aCfg.valueLabel}</label>
                  <input type="number" step="1" min="1" max="100" value={actionValue}
                    onChange={(e) => setActionValue(e.target.value)}
                    placeholder="Ex: 20"
                    className="w-full h-9 px-3 rounded-lg border border-[var(--border)] bg-[#131313] text-sm text-[#f4f4f5] placeholder:text-[#52525b] outline-none focus:border-[#FF5F1A] transition-colors"
                  />
                </div>
              )}

              {/* Full rule preview */}
              <div className="rounded-lg bg-[#131313] border border-[var(--border)] p-3 text-xs space-y-1">
                <p className="text-[#71717a]">Regra completa:</p>
                <p className="text-white font-medium">
                  {`Se ${METRIC_CONFIG[metric].label} ${OPERATOR_LABELS[operator]} ${METRIC_CONFIG[metric].format(parseFloat(threshold) || 0)}`}
                </p>
                <div className="flex items-center gap-1 text-[#71717a]">
                  <ChevronRight className="w-3 h-3" />
                  <span className={cn("font-semibold", aCfg.color)}>
                    {actionText({
                      id: "", name, metric, operator, threshold: parseFloat(threshold) || 0,
                      action, action_value: actionValue ? parseFloat(actionValue) : undefined,
                      platform, active: true, last_triggered_at: null, created_at: "",
                    })}
                  </span>
                </div>
              </div>
            </>
          )}

          {error && <p className="text-xs text-red-400">{error}</p>}

          <div className="flex gap-2 pt-1">
            <button type="button"
              onClick={step === 1 ? onClose : () => setStep(1)}
              className="flex-1 h-9 rounded-lg border border-[var(--border)] text-sm text-[#a1a1aa] hover:text-white hover:border-[#3f3f46] transition-colors">
              {step === 1 ? "Cancelar" : "← Voltar"}
            </button>
            {step === 1 ? (
              <button type="button" onClick={handleNext}
                className="flex-1 h-9 rounded-lg bg-[#FF5F1A] text-white text-sm font-medium hover:bg-[#4f52d1] transition-colors">
                Próximo →
              </button>
            ) : (
              <button type="submit"
                className="flex-1 h-9 rounded-lg bg-[#FF5F1A] text-white text-sm font-medium hover:bg-[#4f52d1] transition-colors">
                Criar automação
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Automation Card ──────────────────────────────────────────────────────────
function AutoCard({
  auto, onDelete, onToggle,
}: {
  auto: Automation; onDelete: (id: string) => void; onToggle: (id: string) => void
}) {
  const aCfg = ACTION_CONFIG[auto.action]
  const mCfg = METRIC_CONFIG[auto.metric]
  const Icon = mCfg.icon

  return (
    <div className={cn(
      "rounded-xl border p-4 transition-all",
      auto.active ? "bg-[#0f0f0f] border-[var(--border)]" : "bg-[#0f0f0f] border-[var(--border)] opacity-50"
    )}>
      <div className="flex items-start gap-3">
        {/* Icon */}
        <div className={cn("w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5", aCfg.bg)}>
          <Zap className={cn("w-4 h-4", aCfg.color)} />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className="text-sm font-semibold text-white truncate">{auto.name}</span>
            {!auto.active && (
              <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-[#2a1f15] text-[#71717a] uppercase tracking-wider">
                Pausada
              </span>
            )}
          </div>

          {/* Condition → Action */}
          <div className="flex items-start gap-2 mt-1.5">
            <div className="flex-1 min-w-0 space-y-1">
              <div className="flex items-center gap-1.5 text-xs">
                <span className="text-[#52525b] uppercase tracking-wider font-bold">SE</span>
                <Icon className="w-3 h-3 text-[#71717a]" />
                <span className="text-[#a1a1aa]">
                  {mCfg.label} <span className="text-[#71717a]">{OPERATOR_LABELS[auto.operator]}</span>{" "}
                  <span className="font-semibold text-white">{mCfg.format(auto.threshold)}</span>
                  {" "}em <span className="text-white font-medium">{PLATFORM_LABELS[auto.platform]}</span>
                </span>
              </div>
              <div className="flex items-center gap-1.5 text-xs">
                <ChevronRight className="w-3 h-3 text-[#52525b]" />
                <span className="text-[#52525b] uppercase tracking-wider font-bold">ENTÃO</span>
                <span className={cn("font-semibold", aCfg.color)}>{actionText(auto)}</span>
              </div>
            </div>
          </div>

          {/* Last triggered */}
          {auto.last_triggered_at && (
            <div className="flex items-center gap-1 mt-2 text-[10px] text-[#52525b]">
              <Clock className="w-3 h-3" />
              Última execução: {new Date(auto.last_triggered_at).toLocaleDateString("pt-BR")}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 flex-shrink-0">
          <button onClick={() => onToggle(auto.id)}
            className="w-7 h-7 flex items-center justify-center rounded-md text-[#71717a] hover:text-white transition-colors"
            title={auto.active ? "Pausar" : "Ativar"}>
            {auto.active
              ? <PauseCircle className="w-4 h-4 text-amber-400" />
              : <PlayCircle className="w-4 h-4 text-emerald-400" />
            }
          </button>
          <button onClick={() => onDelete(auto.id)}
            className="w-7 h-7 flex items-center justify-center rounded-md text-[#71717a] hover:text-red-400 hover:bg-red-500/10 transition-colors">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function AutomacoesPage() {
  const [automations, setAutomations] = useState<Automation[]>([])
  const [loading, setLoading]         = useState(true)
  const [showModal, setShowModal]     = useState(false)
  const [usingDemo, setUsingDemo]     = useState(false)
  const [filterAction, setFilterAction] = useState<Action | "all">("all")

  const fetchAll = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/automations")
      if (res.ok) {
        const data = await res.json()
        const fetched: Automation[] = (data.automations ?? [])
        if (fetched.length > 0) {
          setAutomations(fetched)
          setUsingDemo(false)
        } else {
          setAutomations(DEMO_AUTOMATIONS)
          setUsingDemo(true)
        }
      } else {
        setAutomations(DEMO_AUTOMATIONS)
        setUsingDemo(true)
      }
    } catch {
      setAutomations(DEMO_AUTOMATIONS)
      setUsingDemo(true)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchAll() }, [fetchAll])

  async function handleAdd(auto: Automation) {
    try {
      const res = await fetch("/api/automations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: auto.name, metric: auto.metric, operator: auto.operator,
          threshold: auto.threshold, action: auto.action,
          action_value: auto.action_value ?? null, platform: auto.platform,
        }),
      })
      if (res.ok) {
        setUsingDemo(false)
        await fetchAll()
        return
      }
    } catch { /* fall through */ }
    setAutomations((prev) => [auto, ...prev])
  }

  async function handleDelete(id: string) {
    setAutomations((prev) => prev.filter((a) => a.id !== id))
    if (!usingDemo) {
      await fetch(`/api/automations/${id}`, { method: "DELETE" }).catch(() => {})
    }
  }

  async function handleToggle(id: string) {
    const target = automations.find((a) => a.id === id)
    if (!target) return
    const newActive = !target.active
    setAutomations((prev) => prev.map((a) => a.id === id ? { ...a, active: newActive } : a))
    if (!usingDemo) {
      await fetch(`/api/automations/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: newActive }),
      }).catch(() => {})
    }
  }

  const filtered = filterAction === "all"
    ? automations
    : automations.filter((a) => a.action === filterAction)

  const active   = automations.filter((a) => a.active).length
  const paused   = automations.filter((a) => !a.active).length
  const triggered = automations.filter((a) => a.last_triggered_at).length

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white">Automações</h1>
          <p className="text-sm text-[#71717a] mt-0.5">Regras automáticas SE → ENTÃO para suas campanhas</p>
        </div>
        <div className="flex items-center gap-2">
          {usingDemo && (
            <div className="flex items-center gap-1.5 px-3 h-7 rounded-full border bg-amber-500/10 border-amber-500/20">
              <div className="w-1.5 h-1.5 rounded-full bg-amber-400" />
              <span className="text-xs font-medium text-amber-400">Demo</span>
            </div>
          )}
          <button onClick={fetchAll}
            className="w-9 h-9 flex items-center justify-center rounded-lg border border-[var(--border)] bg-[#131313] hover:bg-[#1a1410] transition-colors">
            <RefreshCw className={cn("w-3.5 h-3.5 text-[#71717a]", loading && "animate-spin")} />
          </button>
          <button onClick={() => setShowModal(true)}
            className="flex items-center gap-2 px-3 h-9 rounded-lg bg-[#FF5F1A] text-white text-sm font-medium hover:bg-[#4f52d1] transition-colors">
            <Plus className="w-4 h-4" />
            Nova automação
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: "Total",      value: automations.length, color: "#FF5F1A", Icon: Zap           },
          { label: "Ativas",     value: active,             color: "#10b981", Icon: PlayCircle     },
          { label: "Pausadas",   value: paused,             color: "#f59e0b", Icon: PauseCircle    },
          { label: "Já ativadas",value: triggered,          color: "#FF7A33", Icon: Clock          },
        ].map(({ label, value, color, Icon }) => (
          <Card key={label} className="relative overflow-hidden">
            <div className="absolute inset-0 opacity-5" style={{ background: `radial-gradient(circle at top right, ${color}, transparent 60%)` }} />
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-[#71717a] uppercase tracking-wide">{label}</p>
                  <p className="text-2xl font-bold text-white mt-1">{loading ? "—" : value}</p>
                </div>
                <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${color}20` }}>
                  <Icon className="w-5 h-5" style={{ color }} />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* How it works */}
      <Card>
        <CardContent className="p-4">
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            {[
              { step: "1", title: "Defina a condição",  desc: "Ex: se CPA > R$60",               icon: BarChart3,    color: "#FF5F1A" },
              { step: "2", title: "Escolha a ação",     desc: "Pausar, ajustar budget ou avisar", icon: Zap,          color: "#FF7A33" },
              { step: "3", title: "Escolha a plataforma",desc: "Meta, Google ou ambas",           icon: Target,       color: "#06b6d4" },
              { step: "4", title: "Ative e monitore",   desc: "O sistema aplica automaticamente", icon: PlayCircle,   color: "#10b981" },
            ].map((s) => {
              const Icon = s.icon
              return (
                <div key={s.step} className="flex items-start gap-3">
                  <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
                    style={{ backgroundColor: s.color }}>
                    {s.step}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-white">{s.title}</p>
                    <p className="text-xs text-[#71717a] mt-0.5">{s.desc}</p>
                  </div>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {/* Automations list */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-3">
            <CardTitle>Suas Automações</CardTitle>
            <div className="flex gap-1 flex-wrap">
              <button onClick={() => setFilterAction("all")}
                className={cn("px-3 h-7 rounded-lg text-xs font-medium transition-colors",
                  filterAction === "all" ? "bg-[#FF5F1A] text-white" : "bg-[#1a1410] text-[#71717a] hover:text-white")}>
                Todas
              </button>
              {(Object.keys(ACTION_CONFIG) as Action[]).map((k) => (
                <button key={k} onClick={() => setFilterAction(k)}
                  className={cn("px-3 h-7 rounded-lg text-xs font-medium transition-colors",
                    filterAction === k ? "bg-[#FF5F1A] text-white" : "bg-[#1a1410] text-[#71717a] hover:text-white")}>
                  {ACTION_CONFIG[k].label}
                </button>
              ))}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex flex-col gap-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-20 rounded-xl bg-[#1a1410] animate-pulse" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-12 flex flex-col items-center gap-3 text-center">
              <div className="w-12 h-12 rounded-xl bg-[#1a1410] flex items-center justify-center">
                <Zap className="w-6 h-6 text-[#3f3f46]" />
              </div>
              <p className="text-sm font-medium text-[#71717a]">Nenhuma automação criada ainda</p>
              <button onClick={() => setShowModal(true)}
                className="flex items-center gap-1.5 text-xs text-[#FF5F1A] hover:underline">
                <Plus className="w-3.5 h-3.5" />
                Criar primeira automação
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {filtered.map((auto) => (
                <AutoCard key={auto.id} auto={auto} onDelete={handleDelete} onToggle={handleToggle} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Info banner */}
      <div className="rounded-xl border border-dashed border-[#2a1f15] bg-[#131313]/40 p-5 flex items-start gap-4">
        <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center flex-shrink-0">
          <Zap className="w-5 h-5 text-amber-400" />
        </div>
        <div>
          <p className="text-sm font-semibold text-white">Como as automações funcionam</p>
          <p className="text-xs text-[#71717a] mt-1 leading-relaxed">
            As regras são avaliadas a cada atualização de dados. Quando a condição é satisfeita,
            a ação é registrada e — quando as contas estão conectadas — executada via API do Meta Ads ou Google Ads.
            As automações de <span className="text-amber-400">pausar campanha</span> e{" "}
            <span className="text-emerald-400">ajustar budget</span> requerem contas conectadas com permissão de escrita.
          </p>
        </div>
      </div>

      {showModal && <AddModal onClose={() => setShowModal(false)} onAdd={handleAdd} />}
    </div>
  )
}
