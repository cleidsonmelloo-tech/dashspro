"use client"

import { useState, useEffect, useCallback } from "react"
import {
  Bot, Play, Pause, Settings2, Activity, FileText,
  RefreshCw, Save, CheckCircle2, XCircle, AlertCircle,
  TrendingUp, TrendingDown, MinusCircle, ChevronRight,
  Clock, Zap, Target, DollarSign, BarChart2, Info,
} from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { cn, formatCurrency } from "@/lib/utils"

// ─── Types ────────────────────────────────────────────────────────────────────
interface OptConfig {
  is_enabled: boolean; goal: string; min_roas: number; max_cpa: number
  min_ctr: number; budget_increase_pct: number; max_budget_per_campaign: number
  min_days_running: number; auto_resume: boolean; notes: string
}
interface LogEntry {
  id: string; campaign_id: string; campaign_name: string; platform: string
  account_name: string; action: string; reason: string; reasoning: string
  old_value: Record<string, unknown> | null; new_value: Record<string, unknown> | null
  executed: boolean; error_message: string | null; created_at: string
}
interface Report {
  report_date: string; summary: string; actions_count: number
  campaigns_paused: number; campaigns_resumed: number; budgets_increased: number
  highlights: Array<{ action: string; campaign: string; reason: string }>
  created_at: string
}

// ─── Defaults ─────────────────────────────────────────────────────────────────
const DEFAULT_CONFIG: OptConfig = {
  is_enabled: false, goal: "leads", min_roas: 2.0, max_cpa: 100,
  min_ctr: 1.0, budget_increase_pct: 20, max_budget_per_campaign: 500,
  min_days_running: 3, auto_resume: false, notes: "",
}

// ─── Action styling ───────────────────────────────────────────────────────────
const ACTION_META: Record<string, { label: string; icon: React.ElementType; color: string; bg: string }> = {
  pause:           { label: "Pausada",          icon: Pause,        color: "text-amber-400",  bg: "bg-amber-500/10" },
  resume:          { label: "Reativada",         icon: Play,         color: "text-emerald-400",bg: "bg-emerald-500/10" },
  increase_budget: { label: "Verba aumentada",   icon: TrendingUp,   color: "text-blue-400",   bg: "bg-blue-500/10" },
  decrease_budget: { label: "Verba reduzida",    icon: TrendingDown, color: "text-orange-400", bg: "bg-orange-500/10" },
  no_action:       { label: "Sem alteração",     icon: MinusCircle,  color: "text-[#52525b]",  bg: "bg-[#1e1e2e]" },
}

const GOAL_OPTIONS = [
  { value: "leads",     label: "Geração de Leads" },
  { value: "purchases", label: "Vendas / Compras" },
  { value: "roas",      label: "Maximizar ROAS" },
]

// ─── Helper ───────────────────────────────────────────────────────────────────
function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return "agora"
  if (m < 60) return `há ${m}min`
  const h = Math.floor(m / 60)
  if (h < 24) return `há ${h}h`
  return `há ${Math.floor(h / 24)}d`
}

function nextHour() {
  const now = new Date()
  const next = new Date(now)
  next.setHours(now.getHours() + 1, 0, 0, 0)
  const diff = next.getTime() - now.getTime()
  const m = Math.floor(diff / 60000)
  const s = Math.floor((diff % 60000) / 1000)
  return `${m}m ${s}s`
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function OtimizacaoPage() {
  const [tab, setTab] = useState<"config" | "activity" | "report">("config")
  const [config, setConfig] = useState<OptConfig>(DEFAULT_CONFIG)
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [report, setReport] = useState<Report | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [running, setRunning] = useState(false)
  const [saveMsg, setSaveMsg] = useState<"ok" | "err" | null>(null)
  const [runResult, setRunResult] = useState<{ campaigns_analyzed: number; actions_executed: number } | null>(null)
  const [countdown, setCountdown] = useState(nextHour())

  // Countdown timer
  useEffect(() => {
    const t = setInterval(() => setCountdown(nextHour()), 1000)
    return () => clearInterval(t)
  }, [])

  const loadAll = useCallback(async () => {
    setLoading(true)
    try {
      const [cfgRes, logsRes, repRes] = await Promise.all([
        fetch("/api/optimization/config"),
        fetch("/api/optimization/logs?limit=100"),
        fetch("/api/optimization/run"),
      ])
      if (cfgRes.ok) {
        const d = await cfgRes.json()
        if (d.config) setConfig({ ...DEFAULT_CONFIG, ...d.config })
      }
      if (logsRes.ok) {
        const d = await logsRes.json()
        setLogs(d.logs || [])
      }
      if (repRes.ok) {
        const d = await repRes.json()
        setReport(d.report || null)
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadAll() }, [loadAll])

  async function saveConfig() {
    setSaving(true); setSaveMsg(null)
    try {
      const res = await fetch("/api/optimization/config", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      })
      setSaveMsg(res.ok ? "ok" : "err")
    } catch { setSaveMsg("err") }
    setSaving(false)
    setTimeout(() => setSaveMsg(null), 3000)
  }

  async function runNow() {
    setRunning(true); setRunResult(null)
    try {
      const res = await fetch("/api/optimization/run", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: "{}",
      })
      if (res.ok) {
        const d = await res.json()
        setRunResult({ campaigns_analyzed: d.campaigns_analyzed || 0, actions_executed: d.actions_executed || 0 })
        await loadAll()
      }
    } catch { /* silent */ }
    setRunning(false)
  }

  const todayLogs = logs.filter(l => {
    const d = new Date(l.created_at).toISOString().split("T")[0]
    return d === new Date().toISOString().split("T")[0]
  })
  const actionsToday = todayLogs.filter(l => l.action !== "no_action" && l.executed).length
  const pausedToday = todayLogs.filter(l => l.action === "pause" && l.executed).length
  const budgetToday = todayLogs.filter(l => (l.action === "increase_budget" || l.action === "decrease_budget") && l.executed).length

  return (
    <div className="flex flex-col gap-6">
      {/* ── Header ── */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <div className={cn(
            "w-12 h-12 rounded-xl flex items-center justify-center relative",
            config.is_enabled ? "bg-[#6366f1]/20" : "bg-[#1e1e2e]"
          )}>
            <Bot className={cn("w-6 h-6", config.is_enabled ? "text-[#818cf8]" : "text-[#52525b]")} />
            {config.is_enabled && (
              <span className="absolute top-0.5 right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-400 border-2 border-[#0d0d14] animate-pulse" />
            )}
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Piloto Automático</h1>
            <p className="text-sm text-[#71717a] mt-0.5">Agente de IA que otimiza suas campanhas 24h por dia</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className={cn(
            "flex items-center gap-1.5 px-3 h-7 rounded-full border text-xs font-medium",
            config.is_enabled
              ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
              : "bg-[#1e1e2e] border-[var(--border)] text-[#71717a]"
          )}>
            <span className={cn("w-1.5 h-1.5 rounded-full", config.is_enabled ? "bg-emerald-400 animate-pulse" : "bg-[#52525b]")} />
            {config.is_enabled ? "Agente Ativo" : "Agente Inativo"}
          </div>
          <button
            onClick={runNow}
            disabled={running || loading}
            className={cn(
              "flex items-center gap-2 px-4 h-9 rounded-lg text-sm font-medium transition-all cursor-pointer",
              running ? "bg-[#1e1e2e] text-[#71717a]" : "bg-[#6366f1] text-white hover:bg-[#4f46e5]"
            )}
          >
            {running ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
            {running ? "Analisando..." : "Executar Agora"}
          </button>
        </div>
      </div>

      {/* ── Run result banner ── */}
      {runResult && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm">
          <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
          <span>
            Análise concluída! <strong>{runResult.campaigns_analyzed} campanhas</strong> analisadas —{" "}
            <strong>{runResult.actions_executed} ações</strong> executadas.
          </span>
        </div>
      )}

      {/* ── KPI cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Ações hoje",        value: actionsToday,   icon: Zap,       color: "#6366f1" },
          { label: "Campanhas pausadas",value: pausedToday,    icon: Pause,     color: "#f59e0b" },
          { label: "Verbas ajustadas",  value: budgetToday,    icon: DollarSign,color: "#06b6d4" },
          { label: "Próx. análise",     value: config.is_enabled ? countdown : "—", icon: Clock, color: "#10b981", raw: true },
        ].map((kpi) => (
          <Card key={kpi.label}>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: `${kpi.color}20` }}>
                <kpi.icon className="w-4 h-4" style={{ color: kpi.color }} />
              </div>
              <div>
                <p className="text-xs text-[#71717a]">{kpi.label}</p>
                {loading
                  ? <div className="h-5 w-12 bg-[#1e1e2e] rounded animate-pulse mt-1" />
                  : <p className={cn("font-bold", (kpi as { raw?: boolean }).raw ? "text-sm text-white mt-0.5" : "text-lg text-white")}>
                      {kpi.value}
                    </p>
                }
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* ── Tabs ── */}
      <div className="flex gap-1 p-1 bg-[#111118] border border-[var(--border)] rounded-lg w-fit">
        {([
          { key: "config",   label: "Configurações", icon: Settings2 },
          { key: "activity", label: "Atividade",     icon: Activity },
          { key: "report",   label: "Relatório Diário", icon: FileText },
        ] as const).map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={cn("flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all cursor-pointer",
              tab === t.key ? "bg-[#6366f1] text-white" : "text-[#71717a] hover:text-white")}>
            <t.icon className="w-3.5 h-3.5" />
            {t.label}
          </button>
        ))}
      </div>

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* TAB: CONFIGURAÇÕES                                                     */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      {tab === "config" && (
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Left column: main settings */}
          <div className="lg:col-span-2 flex flex-col gap-5">
            {/* Master switch */}
            <Card>
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-white font-semibold text-base">Ativar Piloto Automático</p>
                    <p className="text-xs text-[#71717a] mt-1">O agente analisará suas campanhas a cada hora e tomará ações automaticamente</p>
                  </div>
                  <button
                    onClick={() => setConfig(c => ({ ...c, is_enabled: !c.is_enabled }))}
                    className={cn(
                      "relative w-12 h-6 rounded-full transition-all cursor-pointer flex-shrink-0",
                      config.is_enabled ? "bg-[#6366f1]" : "bg-[#3f3f46]"
                    )}
                  >
                    <span className={cn(
                      "absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all shadow",
                      config.is_enabled ? "left-6.5" : "left-0.5"
                    )} style={{ left: config.is_enabled ? "calc(100% - 22px)" : "2px" }} />
                  </button>
                </div>
              </CardContent>
            </Card>

            {/* Goal & thresholds */}
            <Card>
              <CardContent className="p-5 flex flex-col gap-5">
                <p className="text-white font-semibold">Objetivo e Limites</p>
                {/* Goal */}
                <div>
                  <label className="text-xs text-[#71717a] font-medium mb-2 block">Objetivo Principal</label>
                  <div className="flex gap-2 flex-wrap">
                    {GOAL_OPTIONS.map(g => (
                      <button key={g.value} onClick={() => setConfig(c => ({ ...c, goal: g.value }))}
                        className={cn("px-4 py-2 rounded-lg text-sm font-medium border transition-all cursor-pointer",
                          config.goal === g.value
                            ? "bg-[#6366f1] border-[#6366f1] text-white"
                            : "bg-[#111118] border-[var(--border)] text-[#71717a] hover:text-white")}>
                        {g.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs text-[#71717a] font-medium mb-1.5 block flex items-center gap-1">
                      <Target className="w-3 h-3" /> ROAS Mínimo
                    </label>
                    <div className="relative">
                      <input type="number" min="0" step="0.1" value={config.min_roas}
                        onChange={e => setConfig(c => ({ ...c, min_roas: parseFloat(e.target.value) || 0 }))}
                        className="w-full h-9 px-3 pr-8 rounded-lg border border-[var(--border)] bg-[#111118] text-white text-sm outline-none focus:border-[#6366f1]" />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[#52525b] text-xs">x</span>
                    </div>
                    <p className="text-[10px] text-[#52525b] mt-1">Pausar campanhas abaixo deste ROAS</p>
                  </div>
                  <div>
                    <label className="text-xs text-[#71717a] font-medium mb-1.5 block flex items-center gap-1">
                      <DollarSign className="w-3 h-3" /> CPA Máximo
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#52525b] text-xs">R$</span>
                      <input type="number" min="0" step="1" value={config.max_cpa}
                        onChange={e => setConfig(c => ({ ...c, max_cpa: parseFloat(e.target.value) || 0 }))}
                        className="w-full h-9 pl-8 pr-3 rounded-lg border border-[var(--border)] bg-[#111118] text-white text-sm outline-none focus:border-[#6366f1]" />
                    </div>
                    <p className="text-[10px] text-[#52525b] mt-1">Pausar campanhas com CPA acima deste valor</p>
                  </div>
                  <div>
                    <label className="text-xs text-[#71717a] font-medium mb-1.5 block flex items-center gap-1">
                      <BarChart2 className="w-3 h-3" /> CTR Mínimo
                    </label>
                    <div className="relative">
                      <input type="number" min="0" step="0.1" value={config.min_ctr}
                        onChange={e => setConfig(c => ({ ...c, min_ctr: parseFloat(e.target.value) || 0 }))}
                        className="w-full h-9 px-3 pr-8 rounded-lg border border-[var(--border)] bg-[#111118] text-white text-sm outline-none focus:border-[#6366f1]" />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[#52525b] text-xs">%</span>
                    </div>
                    <p className="text-[10px] text-[#52525b] mt-1">Monitorar campanhas abaixo desta taxa</p>
                  </div>
                  <div>
                    <label className="text-xs text-[#71717a] font-medium mb-1.5 block flex items-center gap-1">
                      <Clock className="w-3 h-3" /> Dias mínimos antes de pausar
                    </label>
                    <input type="number" min="1" step="1" value={config.min_days_running}
                      onChange={e => setConfig(c => ({ ...c, min_days_running: parseInt(e.target.value) || 1 }))}
                      className="w-full h-9 px-3 rounded-lg border border-[var(--border)] bg-[#111118] text-white text-sm outline-none focus:border-[#6366f1]" />
                    <p className="text-[10px] text-[#52525b] mt-1">Aguardar este período antes de qualquer pausa</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Budget controls */}
            <Card>
              <CardContent className="p-5 flex flex-col gap-5">
                <p className="text-white font-semibold">Controle de Verba</p>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs text-[#71717a] font-medium mb-1.5 block flex items-center gap-1">
                      <TrendingUp className="w-3 h-3" /> Aumento máximo por ciclo
                    </label>
                    <div className="relative">
                      <input type="number" min="1" max="100" step="1" value={config.budget_increase_pct}
                        onChange={e => setConfig(c => ({ ...c, budget_increase_pct: parseFloat(e.target.value) || 0 }))}
                        className="w-full h-9 px-3 pr-8 rounded-lg border border-[var(--border)] bg-[#111118] text-white text-sm outline-none focus:border-[#6366f1]" />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[#52525b] text-xs">%</span>
                    </div>
                    <p className="text-[10px] text-[#52525b] mt-1">% máximo de aumento de verba por ação</p>
                  </div>
                  <div>
                    <label className="text-xs text-[#71717a] font-medium mb-1.5 block flex items-center gap-1">
                      <DollarSign className="w-3 h-3" /> Teto de verba por campanha/dia
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#52525b] text-xs">R$</span>
                      <input type="number" min="10" step="10" value={config.max_budget_per_campaign}
                        onChange={e => setConfig(c => ({ ...c, max_budget_per_campaign: parseFloat(e.target.value) || 0 }))}
                        className="w-full h-9 pl-8 pr-3 rounded-lg border border-[var(--border)] bg-[#111118] text-white text-sm outline-none focus:border-[#6366f1]" />
                    </div>
                    <p className="text-[10px] text-[#52525b] mt-1">Nunca ultrapassar este valor diário por campanha</p>
                  </div>
                </div>
                <div className="flex items-center justify-between p-3 rounded-lg bg-[#111118] border border-[var(--border)]">
                  <div>
                    <p className="text-sm text-white font-medium">Reativar campanhas pausadas automaticamente</p>
                    <p className="text-xs text-[#71717a] mt-0.5">O agente pode reativar campanhas que melhoraram após pausa</p>
                  </div>
                  <button onClick={() => setConfig(c => ({ ...c, auto_resume: !c.auto_resume }))}
                    className={cn("relative w-10 h-5 rounded-full transition-all cursor-pointer flex-shrink-0",
                      config.auto_resume ? "bg-[#6366f1]" : "bg-[#3f3f46]")}>
                    <span className="absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all shadow"
                      style={{ left: config.auto_resume ? "calc(100% - 18px)" : "2px" }} />
                  </button>
                </div>
              </CardContent>
            </Card>

            {/* Extra context */}
            <Card>
              <CardContent className="p-5 flex flex-col gap-3">
                <div>
                  <p className="text-white font-semibold">Instruções Extras para o Agente</p>
                  <p className="text-xs text-[#71717a] mt-1">Contexto adicional que o agente considerará ao tomar decisões</p>
                </div>
                <textarea
                  value={config.notes}
                  onChange={e => setConfig(c => ({ ...c, notes: e.target.value }))}
                  placeholder="Ex: Não pausar campanhas de remarketing. Priorizar campanhas com leads de WhatsApp. Mês de Black Friday — mais tolerância com CPA..."
                  rows={4}
                  className="w-full px-3 py-2.5 rounded-lg border border-[var(--border)] bg-[#111118] text-white text-sm outline-none focus:border-[#6366f1] resize-none placeholder:text-[#52525b]"
                />
              </CardContent>
            </Card>

            {/* Save button */}
            <div className="flex items-center gap-3">
              <button onClick={saveConfig} disabled={saving}
                className={cn("flex items-center gap-2 px-6 h-10 rounded-lg text-sm font-medium transition-all cursor-pointer",
                  saving ? "bg-[#1e1e2e] text-[#71717a]" : "bg-[#6366f1] text-white hover:bg-[#4f46e5]")}>
                {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                {saving ? "Salvando..." : "Salvar Configurações"}
              </button>
              {saveMsg === "ok" && (
                <div className="flex items-center gap-1.5 text-emerald-400 text-sm">
                  <CheckCircle2 className="w-4 h-4" /> Configurações salvas!
                </div>
              )}
              {saveMsg === "err" && (
                <div className="flex items-center gap-1.5 text-red-400 text-sm">
                  <XCircle className="w-4 h-4" /> Erro ao salvar
                </div>
              )}
            </div>
          </div>

          {/* Right column: info panel */}
          <div className="flex flex-col gap-4">
            <Card>
              <CardContent className="p-5 flex flex-col gap-4">
                <div className="flex items-center gap-2">
                  <Info className="w-4 h-4 text-[#818cf8]" />
                  <p className="text-white font-semibold text-sm">Como funciona</p>
                </div>
                <div className="flex flex-col gap-3 text-xs text-[#a1a1aa]">
                  {[
                    { step: "1", text: "A cada hora, o Piloto Automático busca os dados de todas as suas campanhas ativas" },
                    { step: "2", text: "A IA (Claude) analisa métricas como ROAS, CPA, CTR e volume de leads dos últimos 7 dias" },
                    { step: "3", text: "Com base nas suas configurações, o agente decide: pausar, reativar ou aumentar verba" },
                    { step: "4", text: "As ações são executadas diretamente na API do Meta Ads, sem precisar de acesso manual" },
                    { step: "5", text: "Ao final de cada dia, um relatório completo é gerado com todas as ações tomadas" },
                  ].map(item => (
                    <div key={item.step} className="flex gap-3">
                      <span className="w-5 h-5 rounded-full bg-[#6366f1]/20 text-[#818cf8] text-[10px] font-bold flex items-center justify-center flex-shrink-0">{item.step}</span>
                      <p>{item.text}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-5 flex flex-col gap-3">
                <p className="text-white font-semibold text-sm">Configuração da Chave de IA</p>
                <p className="text-xs text-[#71717a]">
                  Para usar a IA (Claude), configure a variável de ambiente no Netlify:
                </p>
                <div className="p-3 rounded-lg bg-[#111118] border border-[var(--border)] font-mono text-xs text-[#818cf8]">
                  ANTHROPIC_API_KEY=sk-ant-...
                </div>
                <p className="text-[10px] text-[#52525b]">
                  Sem esta chave, o agente usa regras automáticas (sem IA). Obtenha em console.anthropic.com
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-5 flex flex-col gap-3">
                <p className="text-white font-semibold text-sm">Cron Automático (Netlify)</p>
                <p className="text-xs text-[#71717a]">
                  Para análise automática a cada hora, configure no Netlify:
                </p>
                <div className="p-3 rounded-lg bg-[#111118] border border-[var(--border)] font-mono text-[10px] text-[#818cf8] break-all">
                  CRON_SECRET=sua_senha_secreta
                </div>
                <p className="text-[10px] text-[#52525b]">
                  Use um serviço de cron externo (ex: cron-job.org) para chamar{" "}
                  <code className="text-[#818cf8]">POST /api/optimization/run</code>{" "}
                  com header{" "}
                  <code className="text-[#818cf8]">x-cron-secret: sua_senha</code>
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* TAB: ATIVIDADE                                                          */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      {tab === "activity" && (
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <p className="text-white font-semibold">
              Atividade recente
              {logs.length > 0 && <span className="ml-2 text-xs text-[#71717a] font-normal">({logs.length} registros)</span>}
            </p>
            <button onClick={loadAll} className="flex items-center gap-1.5 text-xs text-[#71717a] hover:text-white transition-colors cursor-pointer">
              <RefreshCw className={cn("w-3.5 h-3.5", loading && "animate-spin")} />
              Atualizar
            </button>
          </div>

          {loading ? (
            <div className="flex flex-col gap-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-20 rounded-xl bg-[#111118] border border-[var(--border)] animate-pulse" />
              ))}
            </div>
          ) : logs.length === 0 ? (
            <Card>
              <CardContent className="py-16 flex flex-col items-center gap-3 text-center">
                <Activity className="w-10 h-10 text-[#3f3f46]" />
                <p className="text-[#71717a] text-sm">Nenhuma atividade ainda</p>
                <p className="text-[#52525b] text-xs">Clique em "Executar Agora" para iniciar a primeira análise</p>
              </CardContent>
            </Card>
          ) : (
            <div className="flex flex-col gap-2">
              {logs.map(log => {
                const meta = ACTION_META[log.action] || ACTION_META.no_action
                const Icon = meta.icon
                const isAction = log.action !== "no_action"
                return (
                  <div key={log.id} className={cn(
                    "rounded-xl border p-4 transition-all",
                    isAction
                      ? "bg-[#0d0d14] border-[var(--border)] hover:border-[#3f3f46]"
                      : "bg-[#0a0a0f] border-[var(--border)]/50 opacity-60"
                  )}>
                    <div className="flex items-start gap-3">
                      <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0", meta.bg)}>
                        <Icon className={cn("w-4 h-4", meta.color)} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-white text-sm font-medium truncate">{log.campaign_name}</span>
                          <Badge variant={
                            log.action === "pause" ? "warning" :
                            log.action === "resume" || log.action === "increase_budget" ? "success" :
                            "outline"
                          }>{meta.label}</Badge>
                          {!log.executed && log.action !== "no_action" && (
                            <Badge variant="danger">Falhou</Badge>
                          )}
                        </div>
                        <p className="text-xs text-[#a1a1aa] mt-1">{log.reason}</p>
                        {log.account_name && (
                          <p className="text-[10px] text-[#52525b] mt-0.5">{log.account_name}</p>
                        )}
                        {log.error_message && (
                          <p className="text-[10px] text-red-400 mt-1 flex items-center gap-1">
                            <AlertCircle className="w-3 h-3" />{log.error_message}
                          </p>
                        )}
                      </div>
                      <span className="text-[10px] text-[#52525b] flex-shrink-0 mt-0.5">{timeAgo(log.created_at)}</span>
                    </div>
                    {isAction && log.reasoning && (
                      <details className="mt-3">
                        <summary className="text-[10px] text-[#52525b] cursor-pointer hover:text-[#a1a1aa] flex items-center gap-1">
                          <ChevronRight className="w-3 h-3" /> Ver análise completa da IA
                        </summary>
                        <p className="text-xs text-[#71717a] mt-2 pl-4 border-l border-[var(--border)] leading-relaxed">{log.reasoning}</p>
                      </details>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* TAB: RELATÓRIO DIÁRIO                                                   */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      {tab === "report" && (
        <div className="flex flex-col gap-4">
          {loading ? (
            <div className="h-64 rounded-xl bg-[#111118] border border-[var(--border)] animate-pulse" />
          ) : !report ? (
            <Card>
              <CardContent className="py-16 flex flex-col items-center gap-3 text-center">
                <FileText className="w-10 h-10 text-[#3f3f46]" />
                <p className="text-[#71717a] text-sm">Nenhum relatório gerado ainda para hoje</p>
                <p className="text-[#52525b] text-xs">O relatório é atualizado automaticamente após cada ciclo de análise</p>
                <button onClick={runNow} disabled={running}
                  className="mt-2 flex items-center gap-2 px-4 h-9 rounded-lg bg-[#6366f1] text-white text-sm font-medium hover:bg-[#4f46e5] transition-all cursor-pointer">
                  <Zap className="w-4 h-4" /> Gerar primeiro relatório
                </button>
              </CardContent>
            </Card>
          ) : (
            <>
              {/* Report header */}
              <Card>
                <CardContent className="p-5">
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-xl bg-[#6366f1]/20 flex items-center justify-center flex-shrink-0">
                      <FileText className="w-5 h-5 text-[#818cf8]" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-3 flex-wrap">
                        <p className="text-white font-bold text-lg">Relatório do Piloto Automático</p>
                        <span className="text-xs text-[#71717a]">
                          {new Date(report.report_date).toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" })}
                        </span>
                      </div>
                      <p className="text-sm text-[#a1a1aa] mt-2 leading-relaxed">{report.summary}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Stats */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                  { label: "Total de ações",      value: report.actions_count,     color: "#6366f1", icon: Zap },
                  { label: "Campanhas pausadas",   value: report.campaigns_paused,  color: "#f59e0b", icon: Pause },
                  { label: "Campanhas reativadas", value: report.campaigns_resumed, color: "#10b981", icon: Play },
                  { label: "Verbas ajustadas",     value: report.budgets_increased, color: "#06b6d4", icon: TrendingUp },
                ].map(s => (
                  <Card key={s.label}>
                    <CardContent className="p-4 flex items-center gap-3">
                      <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: `${s.color}20` }}>
                        <s.icon className="w-4 h-4" style={{ color: s.color }} />
                      </div>
                      <div>
                        <p className="text-xs text-[#71717a]">{s.label}</p>
                        <p className="text-2xl font-bold text-white">{s.value}</p>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {/* Highlights */}
              {report.highlights && report.highlights.length > 0 && (
                <Card>
                  <CardContent className="p-5 flex flex-col gap-4">
                    <p className="text-white font-semibold">Principais ações do dia</p>
                    <div className="flex flex-col gap-2">
                      {report.highlights.map((h, i) => {
                        const meta = ACTION_META[h.action] || ACTION_META.no_action
                        const Icon = meta.icon
                        return (
                          <div key={i} className="flex items-start gap-3 p-3 rounded-lg bg-[#111118] border border-[var(--border)]">
                            <div className={cn("w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0", meta.bg)}>
                              <Icon className={cn("w-3.5 h-3.5", meta.color)} />
                            </div>
                            <div>
                              <p className="text-sm text-white font-medium">{h.campaign}</p>
                              <p className="text-xs text-[#71717a] mt-0.5">{h.reason}</p>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}
