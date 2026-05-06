"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import {
  Bot, Play, Pause, Settings2, Activity, FileText,
  RefreshCw, Save, CheckCircle2, XCircle, AlertCircle,
  TrendingUp, TrendingDown, MinusCircle, ChevronRight, ChevronDown,
  Clock, Zap, Target, DollarSign, BarChart2, Info, Building2,
  LayoutGrid, CheckSquare, Square, Cpu, Eye, Sparkles,
} from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

// ─── Types ─────────────────────────────────────────────────────────────────
interface OptConfig {
  is_enabled: boolean; goal: string; min_roas: number; max_cpa: number
  min_ctr: number; budget_increase_pct: number; max_budget_per_campaign: number
  min_days_running: number; auto_resume: boolean; notes: string
  selected_account_ids: string[]; excluded_campaign_ids: string[]
}
interface BMAccount { account_id: string; account_name: string; expired: boolean }
interface Campaign { id: string; name: string; status: string }
interface LogEntry {
  id: string; campaign_id: string; campaign_name: string; platform: string
  account_name: string; action: string; reason: string; reasoning: string
  old_value: Record<string, unknown> | null; new_value: Record<string, unknown> | null
  executed: boolean; error_message: string | null; created_at: string
}
interface LiveResult {
  campaign_id: string; campaign_name: string; account_name?: string
  action: string; reason: string; reasoning: string
  executed: boolean; error?: string | null
}
interface Report {
  report_date: string; summary: string; actions_count: number
  campaigns_paused: number; campaigns_resumed: number; budgets_increased: number
  highlights: Array<{ action: string; campaign: string; reason: string }>
  created_at: string
}

// ─── Constants ──────────────────────────────────────────────────────────────
const DEFAULT_CONFIG: OptConfig = {
  is_enabled: false, goal: "leads", min_roas: 2.0, max_cpa: 100,
  min_ctr: 1.0, budget_increase_pct: 20, max_budget_per_campaign: 500,
  min_days_running: 3, auto_resume: false, notes: "",
  selected_account_ids: [], excluded_campaign_ids: [],
}

const ACTION_META: Record<string, { label: string; icon: React.ElementType; color: string; bg: string; border: string }> = {
  pause:           { label: "Pausada",        icon: Pause,        color: "text-amber-400",   bg: "bg-amber-500/10",   border: "border-amber-500/20" },
  resume:          { label: "Reativada",       icon: Play,         color: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/20" },
  increase_budget: { label: "Verba ↑",         icon: TrendingUp,   color: "text-blue-400",    bg: "bg-blue-500/10",    border: "border-blue-500/20" },
  decrease_budget: { label: "Verba ↓",         icon: TrendingDown, color: "text-orange-400",  bg: "bg-orange-500/10",  border: "border-orange-500/20" },
  no_action:       { label: "Dentro do limite",icon: CheckCircle2, color: "text-[#52525b]",   bg: "bg-[#131313]",      border: "border-[var(--border)]" },
}

const GOAL_OPTIONS = [
  { value: "leads",     label: "Geração de Leads" },
  { value: "purchases", label: "Vendas / Compras" },
  { value: "roas",      label: "Maximizar ROAS" },
]

// ─── Helpers ────────────────────────────────────────────────────────────────
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

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
}

// Group logs by hour
function groupLogsByRun(logs: LogEntry[]) {
  const groups: { hour: string; logs: LogEntry[] }[] = []
  for (const log of logs) {
    const hour = new Date(log.created_at).toISOString().substring(0, 13)
    const existing = groups.find(g => g.hour === hour)
    if (existing) existing.logs.push(log)
    else groups.push({ hour, logs: [log] })
  }
  return groups
}

// ─── ScopeSelector ──────────────────────────────────────────────────────────
function ScopeSelector({
  config, setConfig, accounts, campaignsByAccount, loadingScope,
}: {
  config: OptConfig
  setConfig: React.Dispatch<React.SetStateAction<OptConfig>>
  accounts: BMAccount[]
  campaignsByAccount: Record<string, Campaign[]>
  loadingScope: boolean
}) {
  const [expandedBM, setExpandedBM] = useState<string | null>(null)
  const allSelected = config.selected_account_ids.length === 0

  function toggleAccount(accountId: string) {
    setConfig(c => {
      const current = c.selected_account_ids
      if (current.includes(accountId)) {
        const camps = campaignsByAccount[accountId]?.map(x => x.id) || []
        return { ...c, selected_account_ids: current.filter(id => id !== accountId), excluded_campaign_ids: c.excluded_campaign_ids.filter(id => !camps.includes(id)) }
      }
      return { ...c, selected_account_ids: [...current, accountId] }
    })
  }

  function toggleCampaign(campaignId: string) {
    setConfig(c => {
      const excluded = c.excluded_campaign_ids
      if (excluded.includes(campaignId)) return { ...c, excluded_campaign_ids: excluded.filter(id => id !== campaignId) }
      return { ...c, excluded_campaign_ids: [...excluded, campaignId] }
    })
  }

  const isAccountActive = (id: string) => allSelected || config.selected_account_ids.includes(id)
  const isCampaignActive = (id: string) => !config.excluded_campaign_ids.includes(id)

  if (loadingScope) return (
    <div className="flex flex-col gap-2">
      {[1, 2, 3].map(i => <div key={i} className="h-12 rounded-lg bg-[#131313] border border-[var(--border)] animate-pulse" />)}
    </div>
  )

  if (accounts.length === 0) return (
    <div className="flex items-center gap-2 p-4 rounded-lg bg-[#131313] border border-[var(--border)] text-[#71717a] text-sm">
      <AlertCircle className="w-4 h-4" />
      Nenhuma conta Meta conectada. Conecte em Configurações primeiro.
    </div>
  )

  return (
    <div className="flex flex-col gap-2">
      <button onClick={() => setConfig(c => ({ ...c, selected_account_ids: [], excluded_campaign_ids: [] }))}
        className={cn("flex items-center gap-3 p-3 rounded-lg border text-sm font-medium transition-all cursor-pointer",
          allSelected ? "bg-[#FF5F1A]/15 border-[#FF5F1A]/30 text-white" : "bg-[#131313] border-[var(--border)] text-[#71717a] hover:text-white")}>
        <LayoutGrid className="w-4 h-4 flex-shrink-0" />
        <span className="flex-1 text-left">Todas as BMs e campanhas</span>
        {allSelected && <CheckCircle2 className="w-4 h-4 text-[#FF8C42]" />}
      </button>

      {accounts.map(account => {
        const active = isAccountActive(account.account_id)
        const campaigns = campaignsByAccount[account.account_id] || []
        const isExpanded = expandedBM === account.account_id
        const excludedCount = campaigns.filter(c => config.excluded_campaign_ids.includes(c.id)).length
        return (
          <div key={account.account_id} className={cn("rounded-lg border overflow-hidden transition-all", active ? "border-[#FF5F1A]/30 bg-[#0f0f0f]" : "border-[var(--border)] bg-[#131313]/50 opacity-60")}>
            <div className="flex items-center gap-3 p-3">
              <button onClick={() => toggleAccount(account.account_id)} className="flex-shrink-0 cursor-pointer">
                {active ? <CheckSquare className="w-5 h-5 text-[#FF5F1A]" /> : <Square className="w-5 h-5 text-[#52525b]" />}
              </button>
              <div className="w-7 h-7 rounded-md bg-blue-500/20 flex items-center justify-center flex-shrink-0">
                <Building2 className="w-3.5 h-3.5 text-blue-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className={cn("text-sm font-medium truncate", active ? "text-white" : "text-[#71717a]")}>{account.account_name}</p>
                <p className="text-[10px] text-[#52525b]">
                  {campaigns.length} campanha{campaigns.length !== 1 ? "s" : ""}
                  {excludedCount > 0 && ` · ${excludedCount} excluída${excludedCount !== 1 ? "s" : ""}`}
                  {account.expired && " · Token expirado"}
                </p>
              </div>
              {active && campaigns.length > 0 && (
                <button onClick={() => setExpandedBM(isExpanded ? null : account.account_id)}
                  className="flex items-center gap-1 text-[10px] text-[#71717a] hover:text-white transition-colors cursor-pointer flex-shrink-0">
                  {isExpanded ? "Recolher" : "Ver campanhas"}
                  {isExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                </button>
              )}
            </div>
            {active && isExpanded && campaigns.length > 0 && (
              <div className="border-t border-[var(--border)] bg-[#0a0a0a]">
                <div className="px-4 py-2">
                  <p className="text-[10px] text-[#52525b] uppercase tracking-wide font-semibold">Campanhas — desmarque para excluir</p>
                </div>
                <div className="flex flex-col divide-y divide-[var(--border)]">
                  {campaigns.map(camp => {
                    const campActive = isCampaignActive(camp.id)
                    return (
                      <button key={camp.id} onClick={() => toggleCampaign(camp.id)}
                        className="flex items-center gap-3 px-4 py-2.5 hover:bg-[#131313] transition-colors cursor-pointer text-left">
                        {campActive ? <CheckSquare className="w-4 h-4 text-[#FF5F1A] flex-shrink-0" /> : <Square className="w-4 h-4 text-[#52525b] flex-shrink-0" />}
                        <span className={cn("text-xs flex-1 truncate", campActive ? "text-white" : "text-[#52525b] line-through")}>{camp.name}</span>
                        <span className={cn("text-[10px] flex-shrink-0", camp.status === "ACTIVE" ? "text-emerald-400" : "text-amber-400")}>
                          {camp.status === "ACTIVE" ? "Ativa" : "Pausada"}
                        </span>
                      </button>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        )
      })}
      {!allSelected && (
        <p className="text-xs text-[#71717a] mt-1 px-1">
          ✓ {config.selected_account_ids.length} BM{config.selected_account_ids.length !== 1 ? "s" : ""} selecionada{config.selected_account_ids.length !== 1 ? "s" : ""}
          {config.excluded_campaign_ids.length > 0 && ` · ${config.excluded_campaign_ids.length} campanha${config.excluded_campaign_ids.length !== 1 ? "s" : ""} excluída${config.excluded_campaign_ids.length !== 1 ? "s" : ""}`}
        </p>
      )}
    </div>
  )
}

// ─── LiveExecutionPanel ──────────────────────────────────────────────────────
function LiveExecutionPanel({
  phase, results, onClose,
}: {
  phase: "idle" | "fetching" | "analyzing" | "done"
  results: LiveResult[]
  onClose: () => void
}) {
  const endRef = useRef<HTMLDivElement>(null)
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }) }, [results.length])

  if (phase === "idle") return null

  const actionCount = results.filter(r => r.action !== "no_action" && r.executed).length

  return (
    <div className="rounded-2xl border border-[#FF5F1A]/30 bg-[#0a0a0a] overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border)] bg-[#0f0f0f]">
        <div className="flex items-center gap-3">
          <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center", phase === "done" ? "bg-emerald-500/10" : "bg-[#FF5F1A]/20")}>
            {phase === "done"
              ? <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              : <Cpu className="w-4 h-4 text-[#FF8C42] animate-pulse" />}
          </div>
          <div>
            <p className="text-white font-semibold text-sm">
              {phase === "fetching" && "Buscando campanhas..."}
              {phase === "analyzing" && "Analisando com IA..."}
              {phase === "done" && `Análise concluída — ${results.length} campanhas · ${actionCount} ação${actionCount !== 1 ? "ões" : ""}`}
            </p>
            <p className="text-[10px] text-[#52525b]">
              {phase !== "done" ? "Aguarde enquanto o agente processa cada campanha" : "Todas as decisões foram executadas"}
            </p>
          </div>
        </div>
        {phase === "done" && (
          <button onClick={onClose} className="text-[#52525b] hover:text-white transition-colors text-xs cursor-pointer">Fechar</button>
        )}
      </div>

      {/* Phase animations */}
      {phase !== "done" && (
        <div className="flex items-center gap-3 px-5 py-4">
          <div className="flex gap-1">
            {[0, 1, 2].map(i => (
              <div key={i} className="w-2 h-2 rounded-full bg-[#FF5F1A] animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
            ))}
          </div>
          <span className="text-sm text-[#71717a]">
            {phase === "fetching" ? "Conectando à API do Meta Ads..." : "Claude está analisando métricas de cada campanha..."}
          </span>
        </div>
      )}

      {/* Results feed */}
      {results.length > 0 && (
        <div className="flex flex-col divide-y divide-[var(--border)] max-h-[480px] overflow-y-auto">
          {results.map((r, i) => {
            const meta = ACTION_META[r.action] || ACTION_META.no_action
            const Icon = meta.icon
            const isAction = r.action !== "no_action"
            return (
              <div key={i}
                className={cn(
                  "flex items-start gap-4 px-5 py-3.5 transition-all",
                  "animate-in fade-in slide-in-from-left-2 duration-300",
                  isAction ? "bg-[#0f0f0f]" : "bg-transparent"
                )}
                style={{ animationDelay: `${i * 50}ms` }}
              >
                {/* Step number */}
                <span className="text-[10px] text-[#3f3f46] font-mono w-5 flex-shrink-0 pt-0.5">{String(i + 1).padStart(2, "0")}</span>

                {/* Action icon */}
                <div className={cn("w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0", meta.bg)}>
                  <Icon className={cn("w-3.5 h-3.5", meta.color)} />
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm text-white font-medium truncate">{r.campaign_name}</span>
                    <span className={cn("text-[10px] font-medium px-2 py-0.5 rounded-full border", meta.bg, meta.color, meta.border)}>
                      {meta.label}
                    </span>
                    {r.error && <span className="text-[10px] text-red-400">Falha na execução</span>}
                  </div>
                  <p className="text-xs text-[#71717a] mt-0.5 leading-relaxed">{r.reason}</p>
                  {r.account_name && <p className="text-[10px] text-[#3f3f46] mt-0.5">{r.account_name}</p>}
                </div>

                {/* Status dot */}
                <div className={cn("w-2 h-2 rounded-full mt-1.5 flex-shrink-0",
                  r.action === "no_action" ? "bg-[#3f3f46]"
                  : r.executed ? "bg-emerald-400"
                  : "bg-red-400"
                )} />
              </div>
            )
          })}
          <div ref={endRef} />
        </div>
      )}

      {/* Analyzing indicator at bottom when still running */}
      {phase === "analyzing" && results.length === 0 && (
        <div className="px-5 py-8 flex flex-col items-center gap-3 text-center">
          <Sparkles className="w-8 h-8 text-[#FF5F1A] animate-pulse" />
          <p className="text-sm text-[#71717a]">Claude está analisando todas as campanhas...</p>
          <p className="text-xs text-[#52525b]">Isso pode levar alguns segundos</p>
        </div>
      )}
    </div>
  )
}

// ─── Main Page ───────────────────────────────────────────────────────────────
export default function OtimizacaoPage() {
  const [tab, setTab] = useState<"config" | "activity" | "report">("activity")
  const [config, setConfig] = useState<OptConfig>(DEFAULT_CONFIG)
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [report, setReport] = useState<Report | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [running, setRunning] = useState(false)
  const [saveMsg, setSaveMsg] = useState<"ok" | "err" | null>(null)
  const [countdown, setCountdown] = useState(nextHour())

  // Live execution
  const [livePhase, setLivePhase] = useState<"idle" | "fetching" | "analyzing" | "done">("idle")
  const [liveResults, setLiveResults] = useState<LiveResult[]>([])
  const [expandedRuns, setExpandedRuns] = useState<Set<string>>(new Set())

  // Scope data
  const [accounts, setAccounts] = useState<BMAccount[]>([])
  const [campaignsByAccount, setCampaignsByAccount] = useState<Record<string, Campaign[]>>({})
  const [loadingScope, setLoadingScope] = useState(false)

  useEffect(() => {
    const t = setInterval(() => setCountdown(nextHour()), 1000)
    return () => clearInterval(t)
  }, [])

  const loadAll = useCallback(async () => {
    setLoading(true)
    try {
      const [cfgRes, logsRes, repRes] = await Promise.all([
        fetch("/api/optimization/config"),
        fetch("/api/optimization/logs?limit=200"),
        fetch("/api/optimization/run"),
      ])
      if (cfgRes.ok) {
        const d = await cfgRes.json()
        if (d.config) setConfig({ ...DEFAULT_CONFIG, ...d.config, selected_account_ids: d.config.selected_account_ids || [], excluded_campaign_ids: d.config.excluded_campaign_ids || [] })
      }
      if (logsRes.ok) { const d = await logsRes.json(); setLogs(d.logs || []) }
      if (repRes.ok)  { const d = await repRes.json();  setReport(d.report || null) }
    } finally { setLoading(false) }
  }, [])

  const loadScope = useCallback(async () => {
    setLoadingScope(true)
    try {
      const res = await fetch("/api/optimization/accounts")
      if (res.ok) {
        const d = await res.json()
        setAccounts(d.accounts || [])
        setCampaignsByAccount(d.campaignsByAccount || {})
      }
    } finally { setLoadingScope(false) }
  }, [])

  useEffect(() => { loadAll() }, [loadAll])
  useEffect(() => { if (tab === "config") loadScope() }, [tab, loadScope])

  async function saveConfig() {
    setSaving(true); setSaveMsg(null)
    try {
      const res = await fetch("/api/optimization/config", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(config),
      })
      setSaveMsg(res.ok ? "ok" : "err")
    } catch { setSaveMsg("err") }
    setSaving(false)
    setTimeout(() => setSaveMsg(null), 3000)
  }

  async function runNow() {
    setRunning(true)
    setLiveResults([])
    setLivePhase("fetching")
    setTab("activity")

    // Short delay so UI shows "fetching" phase
    await new Promise(r => setTimeout(r, 600))
    setLivePhase("analyzing")

    try {
      const res = await fetch("/api/optimization/run", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: "{}",
      })
      if (res.ok) {
        const d = await res.json()
        const rawResults: LiveResult[] = (d.results || []).map((r: {
          campaign_id: string; campaign_name: string; action: string
          reason: string; reasoning: string; executed: boolean; error?: string | null
        }, idx: number) => {
          const camp = (d.decisions || []).find((dc: { campaign_id: string }) => dc.campaign_id === r.campaign_id)
          return {
            campaign_id: r.campaign_id,
            campaign_name: r.campaign_name,
            account_name: camp?.account_name,
            action: r.action,
            reason: r.reason || "",
            reasoning: r.reasoning || "",
            executed: r.executed ?? true,
            error: r.error || null,
            _idx: idx,
          }
        })

        // Animate results in one by one
        setLivePhase("done")
        for (const result of rawResults) {
          await new Promise(r => setTimeout(r, 120))
          setLiveResults(prev => [...prev, result])
        }
        await loadAll()
      }
    } catch { /* silent */ }
    setRunning(false)
  }

  const todayLogs = logs.filter(l => new Date(l.created_at).toISOString().split("T")[0] === new Date().toISOString().split("T")[0])
  const actionsToday = todayLogs.filter(l => l.action !== "no_action" && l.executed).length
  const pausedToday  = todayLogs.filter(l => l.action === "pause" && l.executed).length
  const budgetToday  = todayLogs.filter(l => (l.action === "increase_budget" || l.action === "decrease_budget") && l.executed).length

  const logGroups = groupLogsByRun(logs)

  return (
    <div className="flex flex-col gap-6">
      {/* ── Header ── */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center relative", config.is_enabled ? "bg-[#FF5F1A]/20" : "bg-[#1a1410]")}>
            <Bot className={cn("w-6 h-6", config.is_enabled ? "text-[#FF8C42]" : "text-[#52525b]")} />
            {config.is_enabled && <span className="absolute top-0.5 right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-400 border-2 border-[#0f0f0f] animate-pulse" />}
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Otimizador de Campanha</h1>
            <p className="text-sm text-[#71717a] mt-0.5">IA analisa cada campanha a cada 1 hora — pause, escala ou mantém automaticamente</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className={cn("flex items-center gap-1.5 px-3 h-7 rounded-full border text-xs font-medium",
            config.is_enabled ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400" : "bg-[#1a1410] border-[var(--border)] text-[#71717a]")}>
            <span className={cn("w-1.5 h-1.5 rounded-full", config.is_enabled ? "bg-emerald-400 animate-pulse" : "bg-[#52525b]")} />
            {config.is_enabled ? "Agente Ativo" : "Agente Inativo"}
          </div>
          <button onClick={runNow} disabled={running || loading}
            className={cn("flex items-center gap-2 px-4 h-9 rounded-lg text-sm font-medium transition-all cursor-pointer",
              running ? "bg-[#1a1410] text-[#71717a]" : "bg-[#FF5F1A] text-white hover:bg-[#E54E0B]")}>
            {running ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
            {running ? "Analisando..." : "Executar Agora"}
          </button>
        </div>
      </div>

      {/* ── KPIs ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Ações hoje",          value: actionsToday, icon: Zap,        color: "#FF5F1A" },
          { label: "Campanhas pausadas",  value: pausedToday,  icon: Pause,      color: "#f59e0b" },
          { label: "Verbas ajustadas",    value: budgetToday,  icon: DollarSign, color: "#06b6d4" },
          { label: "Próx. análise automática", value: config.is_enabled ? countdown : "—", icon: Clock, color: "#10b981", raw: true },
        ].map((kpi) => (
          <Card key={kpi.label}>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: `${kpi.color}20` }}>
                <kpi.icon className="w-4 h-4" style={{ color: kpi.color }} />
              </div>
              <div>
                <p className="text-xs text-[#71717a]">{kpi.label}</p>
                {loading ? <div className="h-5 w-12 bg-[#1a1410] rounded animate-pulse mt-1" />
                  : <p className={cn("font-bold", (kpi as { raw?: boolean }).raw ? "text-sm text-white mt-0.5" : "text-lg text-white")}>{kpi.value}</p>}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* ── Tabs ── */}
      <div className="flex gap-1 p-1 bg-[#131313] border border-[var(--border)] rounded-lg w-fit">
        {([
          { key: "activity", label: "Atividade",        icon: Activity },
          { key: "config",   label: "Configurações",    icon: Settings2 },
          { key: "report",   label: "Relatório Diário", icon: FileText },
        ] as const).map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={cn("flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all cursor-pointer",
              tab === t.key ? "bg-[#FF5F1A] text-white" : "text-[#71717a] hover:text-white")}>
            <t.icon className="w-3.5 h-3.5" />
            {t.label}
          </button>
        ))}
      </div>

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* TAB: ATIVIDADE                                                          */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      {tab === "activity" && (
        <div className="flex flex-col gap-4">
          {/* Live execution panel */}
          <LiveExecutionPanel
            phase={livePhase}
            results={liveResults}
            onClose={() => setLivePhase("idle")}
          />

          {/* Past runs header */}
          <div className="flex items-center justify-between">
            <p className="text-white font-semibold">
              Histórico de execuções
              {logGroups.length > 0 && <span className="ml-2 text-xs text-[#71717a] font-normal">({logGroups.length} ciclo{logGroups.length !== 1 ? "s" : ""})</span>}
            </p>
            <button onClick={loadAll} className="flex items-center gap-1.5 text-xs text-[#71717a] hover:text-white transition-colors cursor-pointer">
              <RefreshCw className={cn("w-3.5 h-3.5", loading && "animate-spin")} /> Atualizar
            </button>
          </div>

          {loading ? (
            <div className="flex flex-col gap-3">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-16 rounded-xl bg-[#131313] border border-[var(--border)] animate-pulse" />)}</div>
          ) : logGroups.length === 0 ? (
            <Card>
              <CardContent className="py-16 flex flex-col items-center gap-4 text-center">
                <div className="w-16 h-16 rounded-2xl bg-[#FF5F1A]/10 border border-[#FF5F1A]/20 flex items-center justify-center">
                  <Bot className="w-8 h-8 text-[#FF8C42]" />
                </div>
                <div>
                  <p className="text-white font-semibold">Nenhuma análise executada ainda</p>
                  <p className="text-[#71717a] text-sm mt-1">Clique em "Executar Agora" para ver o agente em ação</p>
                </div>
                <button onClick={runNow} disabled={running}
                  className="flex items-center gap-2 px-5 h-10 rounded-lg bg-[#FF5F1A] text-white text-sm font-medium hover:bg-[#E54E0B] transition-all cursor-pointer">
                  <Zap className="w-4 h-4" /> Executar primeira análise
                </button>
              </CardContent>
            </Card>
          ) : (
            <div className="flex flex-col gap-3">
              {logGroups.map((group) => {
                const actions = group.logs.filter(l => l.action !== "no_action" && l.executed)
                const noActions = group.logs.filter(l => l.action === "no_action")
                const isExpanded = expandedRuns.has(group.hour)
                const runTime = new Date(group.logs[0].created_at)
                const isToday = runTime.toISOString().split("T")[0] === new Date().toISOString().split("T")[0]

                return (
                  <div key={group.hour} className="rounded-xl border border-[var(--border)] bg-[#0f0f0f] overflow-hidden">
                    {/* Run header */}
                    <button
                      onClick={() => setExpandedRuns(prev => {
                        const next = new Set(prev)
                        if (next.has(group.hour)) next.delete(group.hour)
                        else next.add(group.hour)
                        return next
                      })}
                      className="w-full flex items-center gap-4 p-4 hover:bg-[#131313] transition-colors cursor-pointer text-left"
                    >
                      {/* Icon */}
                      <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0",
                        actions.length > 0 ? "bg-[#FF5F1A]/20" : "bg-[#1a1410]")}>
                        {actions.length > 0
                          ? <Zap className="w-4 h-4 text-[#FF8C42]" />
                          : <Eye className="w-4 h-4 text-[#52525b]" />}
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-semibold text-white">
                            {isToday ? "Hoje" : runTime.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })} às {fmtTime(group.logs[0].created_at)}
                          </span>
                          {actions.length > 0 ? (
                            <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-[#FF5F1A]/15 text-[#FF8C42] border border-[#FF5F1A]/20">
                              {actions.length} ação{actions.length !== 1 ? "ões" : ""}
                            </span>
                          ) : (
                            <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-[#1a1410] text-[#52525b] border border-[var(--border)]">
                              Sem alterações
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-[#52525b] mt-0.5">
                          {group.logs.length} campanha{group.logs.length !== 1 ? "s" : ""} analisada{group.logs.length !== 1 ? "s" : ""}
                          {actions.filter(a => a.action === "pause").length > 0 && ` · ${actions.filter(a => a.action === "pause").length} pausada${actions.filter(a => a.action === "pause").length !== 1 ? "s" : ""}`}
                          {actions.filter(a => a.action === "increase_budget").length > 0 && ` · ${actions.filter(a => a.action === "increase_budget").length} verba↑`}
                        </p>
                      </div>

                      {/* Action badges preview */}
                      <div className="hidden sm:flex items-center gap-1 flex-wrap">
                        {actions.slice(0, 3).map((a, i) => {
                          const m = ACTION_META[a.action]
                          if (!m) return null
                          const Icon = m.icon
                          return (
                            <span key={i} className={cn("flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-md border", m.bg, m.color, m.border)}>
                              <Icon className="w-2.5 h-2.5" />
                            </span>
                          )
                        })}
                        {actions.length > 3 && <span className="text-[10px] text-[#52525b]">+{actions.length - 3}</span>}
                      </div>

                      <ChevronDown className={cn("w-4 h-4 text-[#52525b] transition-transform flex-shrink-0", isExpanded && "rotate-180")} />
                    </button>

                    {/* Expanded campaign list */}
                    {isExpanded && (
                      <div className="border-t border-[var(--border)]">
                        {/* Actions first */}
                        {actions.length > 0 && (
                          <>
                            <div className="px-4 py-2 bg-[#0a0a0a]">
                              <p className="text-[10px] text-[#52525b] uppercase tracking-wide font-semibold">Ações executadas</p>
                            </div>
                            {actions.map(log => {
                              const meta = ACTION_META[log.action] || ACTION_META.no_action
                              const Icon = meta.icon
                              return (
                                <div key={log.id} className={cn("flex items-start gap-4 px-4 py-3.5 border-b border-[var(--border)] last:border-0", meta.bg + "/30")}>
                                  <div className={cn("w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0", meta.bg)}>
                                    <Icon className={cn("w-3.5 h-3.5", meta.color)} />
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <span className="text-sm text-white font-medium">{log.campaign_name}</span>
                                      <span className={cn("text-[10px] font-medium px-2 py-0.5 rounded-full border", meta.bg, meta.color, meta.border)}>{meta.label}</span>
                                      {!log.executed && <Badge variant="danger">Falhou</Badge>}
                                    </div>
                                    <p className="text-xs text-[#a1a1aa] mt-0.5">{log.reason}</p>
                                    {log.account_name && <p className="text-[10px] text-[#52525b] mt-0.5">{log.account_name}</p>}
                                    {log.error_message && <p className="text-[10px] text-red-400 mt-1 flex items-center gap-1"><AlertCircle className="w-3 h-3" />{log.error_message}</p>}
                                    {log.reasoning && (
                                      <details className="mt-2">
                                        <summary className="text-[10px] text-[#52525b] cursor-pointer hover:text-[#a1a1aa] flex items-center gap-1">
                                          <ChevronRight className="w-3 h-3" /> Análise completa da IA
                                        </summary>
                                        <p className="text-xs text-[#71717a] mt-2 pl-3 border-l border-[var(--border)] leading-relaxed">{log.reasoning}</p>
                                      </details>
                                    )}
                                  </div>
                                  <span className="text-[10px] text-[#52525b] flex-shrink-0">{timeAgo(log.created_at)}</span>
                                </div>
                              )
                            })}
                          </>
                        )}

                        {/* No-action campaigns collapsed */}
                        {noActions.length > 0 && (
                          <details>
                            <summary className="flex items-center gap-2 px-4 py-3 bg-[#0a0a0a] text-[#52525b] text-xs cursor-pointer hover:text-white transition-colors border-t border-[var(--border)]">
                              <MinusCircle className="w-3.5 h-3.5" />
                              {noActions.length} campanha{noActions.length !== 1 ? "s" : ""} dentro do limite — sem alteração
                              <ChevronRight className="w-3 h-3 ml-auto" />
                            </summary>
                            <div className="flex flex-col divide-y divide-[var(--border)]">
                              {noActions.map(log => (
                                <div key={log.id} className="flex items-center gap-4 px-4 py-2.5 opacity-50">
                                  <div className="w-6 h-6 rounded flex items-center justify-center flex-shrink-0 bg-[#1a1410]">
                                    <CheckCircle2 className="w-3 h-3 text-[#52525b]" />
                                  </div>
                                  <span className="text-xs text-[#71717a] truncate">{log.campaign_name}</span>
                                  <span className="text-[10px] text-[#3f3f46] ml-auto">{log.reason}</span>
                                </div>
                              ))}
                            </div>
                          </details>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* TAB: CONFIGURAÇÕES                                                      */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      {tab === "config" && (
        <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 flex flex-col gap-5">
            {/* Master switch */}
            <Card>
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-white font-semibold text-base">Ativar Otimizador Automático</p>
                    <p className="text-xs text-[#71717a] mt-1">O agente analisará suas campanhas a cada hora automaticamente</p>
                  </div>
                  <button onClick={() => setConfig(c => ({ ...c, is_enabled: !c.is_enabled }))}
                    className={cn("relative w-12 h-6 rounded-full transition-all cursor-pointer flex-shrink-0", config.is_enabled ? "bg-[#FF5F1A]" : "bg-[#3f3f46]")}>
                    <span className="absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all shadow"
                      style={{ left: config.is_enabled ? "calc(100% - 22px)" : "2px" }} />
                  </button>
                </div>
              </CardContent>
            </Card>

            {/* Escopo */}
            <Card>
              <CardContent className="p-5 flex flex-col gap-4">
                <div className="flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-[#FF8C42]" />
                  <p className="text-white font-semibold">Escopo de Otimização</p>
                </div>
                <p className="text-xs text-[#71717a] -mt-2">Selecione quais BMs e campanhas o agente deve gerenciar.</p>
                <ScopeSelector config={config} setConfig={setConfig} accounts={accounts} campaignsByAccount={campaignsByAccount} loadingScope={loadingScope} />
              </CardContent>
            </Card>

            {/* Goal */}
            <Card>
              <CardContent className="p-5 flex flex-col gap-5">
                <p className="text-white font-semibold">Objetivo e Limites</p>
                <div>
                  <label className="text-xs text-[#71717a] font-medium mb-2 block">Objetivo Principal</label>
                  <div className="flex gap-2 flex-wrap">
                    {GOAL_OPTIONS.map(g => (
                      <button key={g.value} onClick={() => setConfig(c => ({ ...c, goal: g.value }))}
                        className={cn("px-4 py-2 rounded-lg text-sm font-medium border transition-all cursor-pointer",
                          config.goal === g.value ? "bg-[#FF5F1A] border-[#FF5F1A] text-white" : "bg-[#131313] border-[var(--border)] text-[#71717a] hover:text-white")}>
                        {g.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs text-[#71717a] font-medium mb-1.5 flex items-center gap-1"><Target className="w-3 h-3" /> ROAS Mínimo</label>
                    <div className="relative">
                      <input type="number" min="0" step="0.1" value={config.min_roas}
                        onChange={e => setConfig(c => ({ ...c, min_roas: parseFloat(e.target.value) || 0 }))}
                        className="w-full h-9 px-3 pr-8 rounded-lg border border-[var(--border)] bg-[#131313] text-white text-sm outline-none focus:border-[#FF5F1A]" />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[#52525b] text-xs">x</span>
                    </div>
                    <p className="text-[10px] text-[#52525b] mt-1">Pausar campanhas abaixo deste ROAS</p>
                  </div>
                  <div>
                    <label className="text-xs text-[#71717a] font-medium mb-1.5 flex items-center gap-1"><DollarSign className="w-3 h-3" /> CPA Máximo</label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#52525b] text-xs">R$</span>
                      <input type="number" min="0" step="1" value={config.max_cpa}
                        onChange={e => setConfig(c => ({ ...c, max_cpa: parseFloat(e.target.value) || 0 }))}
                        className="w-full h-9 pl-8 pr-3 rounded-lg border border-[var(--border)] bg-[#131313] text-white text-sm outline-none focus:border-[#FF5F1A]" />
                    </div>
                    <p className="text-[10px] text-[#52525b] mt-1">Pausar campanhas com CPA acima deste valor</p>
                  </div>
                  <div>
                    <label className="text-xs text-[#71717a] font-medium mb-1.5 flex items-center gap-1"><BarChart2 className="w-3 h-3" /> CTR Mínimo</label>
                    <div className="relative">
                      <input type="number" min="0" step="0.1" value={config.min_ctr}
                        onChange={e => setConfig(c => ({ ...c, min_ctr: parseFloat(e.target.value) || 0 }))}
                        className="w-full h-9 px-3 pr-8 rounded-lg border border-[var(--border)] bg-[#131313] text-white text-sm outline-none focus:border-[#FF5F1A]" />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[#52525b] text-xs">%</span>
                    </div>
                  </div>
                  <div>
                    <label className="text-xs text-[#71717a] font-medium mb-1.5 flex items-center gap-1"><Clock className="w-3 h-3" /> Dias mínimos antes de pausar</label>
                    <input type="number" min="1" step="1" value={config.min_days_running}
                      onChange={e => setConfig(c => ({ ...c, min_days_running: parseInt(e.target.value) || 1 }))}
                      className="w-full h-9 px-3 rounded-lg border border-[var(--border)] bg-[#131313] text-white text-sm outline-none focus:border-[#FF5F1A]" />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Budget */}
            <Card>
              <CardContent className="p-5 flex flex-col gap-5">
                <p className="text-white font-semibold">Controle de Verba</p>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs text-[#71717a] font-medium mb-1.5 flex items-center gap-1"><TrendingUp className="w-3 h-3" /> Aumento máximo por ciclo</label>
                    <div className="relative">
                      <input type="number" min="1" max="100" step="1" value={config.budget_increase_pct}
                        onChange={e => setConfig(c => ({ ...c, budget_increase_pct: parseFloat(e.target.value) || 0 }))}
                        className="w-full h-9 px-3 pr-8 rounded-lg border border-[var(--border)] bg-[#131313] text-white text-sm outline-none focus:border-[#FF5F1A]" />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[#52525b] text-xs">%</span>
                    </div>
                  </div>
                  <div>
                    <label className="text-xs text-[#71717a] font-medium mb-1.5 flex items-center gap-1"><DollarSign className="w-3 h-3" /> Teto de verba por campanha/dia</label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#52525b] text-xs">R$</span>
                      <input type="number" min="10" step="10" value={config.max_budget_per_campaign}
                        onChange={e => setConfig(c => ({ ...c, max_budget_per_campaign: parseFloat(e.target.value) || 0 }))}
                        className="w-full h-9 pl-8 pr-3 rounded-lg border border-[var(--border)] bg-[#131313] text-white text-sm outline-none focus:border-[#FF5F1A]" />
                    </div>
                  </div>
                </div>
                <div className="flex items-center justify-between p-3 rounded-lg bg-[#131313] border border-[var(--border)]">
                  <div>
                    <p className="text-sm text-white font-medium">Reativar campanhas pausadas automaticamente</p>
                    <p className="text-xs text-[#71717a] mt-0.5">O agente pode reativar campanhas que melhoraram</p>
                  </div>
                  <button onClick={() => setConfig(c => ({ ...c, auto_resume: !c.auto_resume }))}
                    className={cn("relative w-10 h-5 rounded-full transition-all cursor-pointer flex-shrink-0", config.auto_resume ? "bg-[#FF5F1A]" : "bg-[#3f3f46]")}>
                    <span className="absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all shadow"
                      style={{ left: config.auto_resume ? "calc(100% - 18px)" : "2px" }} />
                  </button>
                </div>
              </CardContent>
            </Card>

            {/* Notes */}
            <Card>
              <CardContent className="p-5 flex flex-col gap-3">
                <div>
                  <p className="text-white font-semibold">Instruções Extras para o Agente</p>
                  <p className="text-xs text-[#71717a] mt-1">Contexto que o agente considerará ao decidir</p>
                </div>
                <textarea value={config.notes} onChange={e => setConfig(c => ({ ...c, notes: e.target.value }))}
                  placeholder="Ex: Não pausar campanhas de remarketing. Priorizar leads WhatsApp. Tolerância maior em Black Friday..."
                  rows={3}
                  className="w-full px-3 py-2.5 rounded-lg border border-[var(--border)] bg-[#131313] text-white text-sm outline-none focus:border-[#FF5F1A] resize-none placeholder:text-[#52525b]" />
              </CardContent>
            </Card>

            {/* Save */}
            <div className="flex items-center gap-3">
              <button onClick={saveConfig} disabled={saving}
                className={cn("flex items-center gap-2 px-6 h-10 rounded-lg text-sm font-medium transition-all cursor-pointer",
                  saving ? "bg-[#1a1410] text-[#71717a]" : "bg-[#FF5F1A] text-white hover:bg-[#E54E0B]")}>
                {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                {saving ? "Salvando..." : "Salvar Configurações"}
              </button>
              {saveMsg === "ok" && <div className="flex items-center gap-1.5 text-emerald-400 text-sm"><CheckCircle2 className="w-4 h-4" /> Salvo!</div>}
              {saveMsg === "err" && <div className="flex items-center gap-1.5 text-red-400 text-sm"><XCircle className="w-4 h-4" /> Erro ao salvar</div>}
            </div>
          </div>

          {/* Right column */}
          <div className="flex flex-col gap-4">
            <Card>
              <CardContent className="p-5 flex flex-col gap-4">
                <div className="flex items-center gap-2">
                  <Info className="w-4 h-4 text-[#FF8C42]" />
                  <p className="text-white font-semibold text-sm">Como funciona</p>
                </div>
                <div className="flex flex-col gap-3 text-xs text-[#a1a1aa]">
                  {[
                    { step: "1", text: "Selecione quais BMs e campanhas o agente deve gerenciar" },
                    { step: "2", text: "Configure os limites: ROAS mínimo, CPA máximo, teto de verba" },
                    { step: "3", text: "A cada hora o agente analisa métricas dos últimos 7 dias" },
                    { step: "4", text: "Claude decide: pausar, reativar ou aumentar verba automaticamente" },
                    { step: "5", text: "Você vê em tempo real o que cada campanha recebeu na aba Atividade" },
                  ].map(item => (
                    <div key={item.step} className="flex gap-3">
                      <span className="w-5 h-5 rounded-full bg-[#FF5F1A]/20 text-[#FF8C42] text-[10px] font-bold flex items-center justify-center flex-shrink-0">{item.step}</span>
                      <p>{item.text}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-5 flex flex-col gap-3">
                <p className="text-white font-semibold text-sm">Chave de IA (Anthropic)</p>
                <div className="p-3 rounded-lg bg-[#131313] border border-[var(--border)] font-mono text-xs text-[#FF8C42]">
                  ANTHROPIC_API_KEY=sk-ant-...
                </div>
                <p className="text-[10px] text-[#52525b]">Configure na Vercel → Settings → Environment Variables</p>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* TAB: RELATÓRIO DIÁRIO                                                   */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      {tab === "report" && (
        <div className="flex flex-col gap-4">
          {loading ? <div className="h-64 rounded-xl bg-[#131313] border border-[var(--border)] animate-pulse" />
          : !report ? (
            <Card>
              <CardContent className="py-16 flex flex-col items-center gap-3 text-center">
                <FileText className="w-10 h-10 text-[#3f3f46]" />
                <p className="text-[#71717a] text-sm">Nenhum relatório gerado ainda para hoje</p>
                <button onClick={runNow} disabled={running}
                  className="mt-2 flex items-center gap-2 px-4 h-9 rounded-lg bg-[#FF5F1A] text-white text-sm font-medium hover:bg-[#E54E0B] transition-all cursor-pointer">
                  <Zap className="w-4 h-4" /> Gerar primeiro relatório
                </button>
              </CardContent>
            </Card>
          ) : (
            <>
              <Card>
                <CardContent className="p-5">
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-xl bg-[#FF5F1A]/20 flex items-center justify-center flex-shrink-0">
                      <FileText className="w-5 h-5 text-[#FF8C42]" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-3 flex-wrap">
                        <p className="text-white font-bold text-lg">Relatório do Otimizador</p>
                        <span className="text-xs text-[#71717a]">{new Date(report.report_date).toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" })}</span>
                      </div>
                      <p className="text-sm text-[#a1a1aa] mt-2 leading-relaxed">{report.summary}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                  { label: "Total de ações",      value: report.actions_count,     color: "#FF5F1A", icon: Zap },
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
              {(() => {
                const highlights = Array.isArray(report.highlights)
                  ? report.highlights
                  : (typeof report.highlights === "string"
                      ? (() => { try { return JSON.parse(report.highlights as unknown as string) } catch { return [] } })()
                      : [])
                return highlights.length > 0 && (
                <Card>
                  <CardContent className="p-5 flex flex-col gap-4">
                    <p className="text-white font-semibold">Principais ações do dia</p>
                    <div className="flex flex-col gap-2">
                      {highlights.map((h: { action: string; campaign: string; reason: string }, i: number) => {
                        const meta = ACTION_META[h.action] || ACTION_META.no_action
                        const Icon = meta.icon
                        return (
                          <div key={i} className="flex items-start gap-3 p-3 rounded-lg bg-[#131313] border border-[var(--border)]">
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
                )
              })()}
            </>
          )}
        </div>
      )}
    </div>
  )
}
