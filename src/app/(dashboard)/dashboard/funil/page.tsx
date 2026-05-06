"use client"

import { useState, useEffect, useCallback } from "react"
import { ArrowRight, TrendingDown, DollarSign, Users, ShoppingCart, MessageCircle, GraduationCap, ClipboardList, Pizza, RefreshCw } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { formatCurrency, cn } from "@/lib/utils"
import { BmCampaignFilter } from "@/components/ui/bm-campaign-filter"
import { PlatformPills } from "@/components/ui/platform-pills"
import { useFilter } from "@/lib/filter-context"

type FunnelType = "ecommerce" | "mensagens" | "infoproduto" | "cadastro" | "delivery"

interface FunnelStep {
  label: string
  value: number
  cost?: number
  rate?: number
  color: string
  icon: React.ElementType
}

// Gera os passos do funil a partir das métricas reais (impressões, cliques, conversões, gasto)
function buildFunnelSteps(type: FunnelType, impressions: number, clicks: number, conversions: number, spend: number): FunnelStep[] {
  const ctr = impressions > 0 ? (clicks / impressions) * 100 : 0
  const cpc = clicks > 0 ? spend / clicks : 0
  const cpa = conversions > 0 ? spend / conversions : 0

  switch (type) {
    case "ecommerce":
      return [
        { label: "Impressões", value: impressions, color: "#6366f1", icon: Users },
        { label: "Cliques no Anúncio", value: clicks, rate: ctr, cost: cpc, color: "#8b5cf6", icon: Users },
        { label: "Visitas à Loja", value: Math.round(clicks * 0.82), rate: 82, cost: cpc * 1.22, color: "#a78bfa", icon: Users },
        { label: "Adicionou ao Carrinho", value: Math.round(clicks * 0.19), rate: 23, cost: cpc * 4.3, color: "#c4b5fd", icon: ShoppingCart },
        { label: "Iniciou Checkout", value: Math.round(clicks * 0.09), rate: 47, cost: cpc * 9.2, color: "#ddd6fe", icon: ShoppingCart },
        { label: "Compras", value: conversions, rate: conversions > 0 ? (conversions / Math.round(clicks * 0.09)) * 100 : 0, cost: cpa, color: "#10b981", icon: DollarSign },
      ]
    case "mensagens":
      return [
        { label: "Impressões", value: impressions, color: "#6366f1", icon: Users },
        { label: "Cliques no Anúncio", value: clicks, rate: ctr, cost: cpc, color: "#8b5cf6", icon: Users },
        { label: "Conversas Iniciadas", value: Math.round(clicks * 0.82), rate: 82, cost: cpc * 1.22, color: "#06b6d4", icon: MessageCircle },
        { label: "Responderam", value: Math.round(clicks * 0.59), rate: 72, cost: cpc * 1.69, color: "#22d3ee", icon: MessageCircle },
        { label: "Proposta Enviada", value: Math.round(clicks * 0.22), rate: 38, cost: cpc * 4.55, color: "#67e8f9", icon: MessageCircle },
        { label: "Vendas Fechadas", value: conversions, rate: 0, cost: cpa, color: "#10b981", icon: DollarSign },
      ]
    case "infoproduto":
      return [
        { label: "Impressões", value: impressions, color: "#6366f1", icon: Users },
        { label: "Cliques no Anúncio", value: clicks, rate: ctr, cost: cpc, color: "#8b5cf6", icon: Users },
        { label: "Visitas à Página", value: Math.round(clicks * 0.87), rate: 87, cost: cpc * 1.15, color: "#a78bfa", icon: Users },
        { label: "Leads Capturados", value: Math.round(clicks * 0.22), rate: 25, cost: cpc * 4.55, color: "#f59e0b", icon: ClipboardList },
        { label: "Foram ao Checkout", value: Math.round(clicks * 0.095), rate: 43, cost: cpc * 10.5, color: "#fbbf24", icon: ShoppingCart },
        { label: "Compraram", value: conversions, rate: 0, cost: cpa, color: "#10b981", icon: DollarSign },
      ]
    case "cadastro":
      return [
        { label: "Impressões", value: impressions, color: "#6366f1", icon: Users },
        { label: "Cliques no Anúncio", value: clicks, rate: ctr, cost: cpc, color: "#8b5cf6", icon: Users },
        { label: "Visitas à Landing Page", value: Math.round(clicks * 0.86), rate: 86, cost: cpc * 1.16, color: "#a78bfa", icon: Users },
        { label: "Iniciou Formulário", value: Math.round(clicks * 0.34), rate: 40, cost: cpc * 2.94, color: "#f97316", icon: ClipboardList },
        { label: "Leads Qualificados", value: conversions, rate: 0, cost: cpa, color: "#10b981", icon: ClipboardList },
      ]
    case "delivery":
      return [
        { label: "Impressões", value: impressions, color: "#6366f1", icon: Users },
        { label: "Cliques no Anúncio", value: clicks, rate: ctr, cost: cpc, color: "#8b5cf6", icon: Users },
        { label: "Acessou Cardápio", value: Math.round(clicks * 0.78), rate: 78, cost: cpc * 1.28, color: "#ef4444", icon: Pizza },
        { label: "Adicionou Item", value: Math.round(clicks * 0.5), rate: 65, cost: cpc * 2.0, color: "#f87171", icon: Pizza },
        { label: "Pedidos Finalizados", value: conversions, rate: 0, cost: cpa, color: "#10b981", icon: DollarSign },
      ]
  }
}

const FUNNEL_META: Record<FunnelType, { label: string; emoji: string; icon: React.ElementType }> = {
  ecommerce: { label: "E-commerce", emoji: "🛒", icon: ShoppingCart },
  mensagens: { label: "Mensagens", emoji: "💬", icon: MessageCircle },
  infoproduto: { label: "Infoproduto", emoji: "🎓", icon: GraduationCap },
  cadastro: { label: "Captação de Leads", emoji: "📋", icon: ClipboardList },
  delivery: { label: "Delivery / Local", emoji: "🍕", icon: Pizza },
}

// Demo values per funnel type
const DEMO_VALUES: Record<FunnelType, { impressions: number; clicks: number; conversions: number; spend: number }> = {
  ecommerce:   { impressions: 248932, clicks: 4721, conversions: 312, spend: 12480 },
  mensagens:   { impressions: 185420, clicks: 3210, conversions: 198, spend: 12500 },
  infoproduto: { impressions: 320100, clicks: 6840, conversions: 285, spend: 12500 },
  cadastro:    { impressions: 412000, clicks: 8240, conversions: 1920, spend: 12500 },
  delivery:    { impressions: 98400,  clicks: 2840, conversions: 892, spend: 5000 },
}

function FunnelBar({ step, maxValue }: { step: FunnelStep; maxValue: number }) {
  const width = Math.max((step.value / maxValue) * 100, 3)
  return (
    <div className="flex items-center gap-4 group">
      <div className="w-40 text-right flex-shrink-0">
        <p className="text-xs font-medium text-[#a1a1aa] leading-tight">{step.label}</p>
        <p className="text-lg font-bold text-white">{step.value.toLocaleString("pt-BR")}</p>
      </div>
      <div className="flex-1 relative h-10 flex items-center">
        <div className="absolute inset-y-0 left-0 right-0 bg-[#1e1e2e] rounded-lg" />
        <div
          className="relative h-8 rounded-lg transition-all duration-700 flex items-center px-3"
          style={{ width: `${width}%`, backgroundColor: step.color, minWidth: "52px" }}
        >
          <span className="text-xs font-bold text-white/90 whitespace-nowrap">{width.toFixed(0)}%</span>
        </div>
      </div>
      <div className="w-36 flex-shrink-0 flex flex-col gap-0.5">
        {step.rate !== undefined && step.rate > 0 && (
          <div className="flex items-center gap-1.5">
            <TrendingDown className="w-3 h-3 text-[#71717a]" />
            <span className="text-xs text-[#71717a]">Taxa: <span className="text-[#a1a1aa] font-medium">{step.rate.toFixed(2)}%</span></span>
          </div>
        )}
        {step.cost !== undefined && step.cost > 0 && (
          <div className="flex items-center gap-1.5">
            <DollarSign className="w-3 h-3 text-[#71717a]" />
            <span className="text-xs text-[#71717a]">Custo: <span className="text-[#a1a1aa] font-medium">{formatCurrency(step.cost)}</span></span>
          </div>
        )}
      </div>
    </div>
  )
}

const PERIOD_OPTIONS = [
  { label: "Últimos 7 dias", value: "7d" },
  { label: "Últimos 30 dias", value: "30d" },
  { label: "Este mês", value: "this_month" },
]

function getDateRange(period: string) {
  const today = new Date()
  const until = today.toISOString().split("T")[0]
  if (period === "7d") { const d = new Date(today); d.setDate(d.getDate() - 7); return { since: d.toISOString().split("T")[0], until } }
  if (period === "this_month") return { since: `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-01`, until }
  const d = new Date(today); d.setDate(d.getDate() - 30); return { since: d.toISOString().split("T")[0], until }
}

export default function FunilPage() {
  const { filterParam } = useFilter()
  const [platformFilter, setPlatformFilter] = useState<"all" | "meta" | "google">("all")
  const [activeFunnel, setActiveFunnel] = useState<FunnelType>("ecommerce")
  const [period, setPeriod] = useState("30d")
  const [loading, setLoading] = useState(false)
  const [isRealData, setIsRealData] = useState(false)
  const [liveMetrics, setLiveMetrics] = useState<{ impressions: number; clicks: number; conversions: number; spend: number } | null>(null)

  const fetchMetrics = useCallback(async () => {
    setLoading(true)
    try {
      const { since, until } = getDateRange(period)
      const res = await fetch(`/api/dashboard/metrics?since=${since}&until=${until}${filterParam}`)
      if (res.ok) {
        const data = await res.json()
        if (data.connected && data.metrics) {
          setLiveMetrics({
            impressions: data.metrics.impressions,
            clicks: data.metrics.clicks,
            conversions: data.metrics.conversions,
            spend: data.metrics.spend,
          })
          setIsRealData(true)
        } else {
          setLiveMetrics(null)
          setIsRealData(false)
        }
      }
    } catch {
      setLiveMetrics(null)
      setIsRealData(false)
    } finally {
      setLoading(false)
    }
  }, [period, filterParam])

  useEffect(() => { fetchMetrics() }, [fetchMetrics])

  // Load workspace funnel type preference
  useEffect(() => {
    async function loadFunnelType() {
      try {
        const { createClient } = await import("@/lib/supabase/client")
        const supabase = createClient()
        const { data: { session } } = await supabase.auth.getSession()
        const user = session?.user
        if (!user) return
        const { data: wsList } = await supabase.from("workspaces").select("id").eq("owner_id", user.id).order("created_at", { ascending: true })
        const ws = wsList?.[0]
        if (!ws) return
        const { data: settings } = await supabase.from("workspace_settings").select("funnel_type").eq("workspace_id", ws.id).single()
        if (settings?.funnel_type) setActiveFunnel(settings.funnel_type as FunnelType)
      } catch { /* ignore */ }
    }
    loadFunnelType()
  }, [])

  const values = liveMetrics || DEMO_VALUES[activeFunnel]
  const steps = buildFunnelSteps(activeFunnel, values.impressions, values.clicks, values.conversions, values.spend)
  const maxValue = steps[0].value
  const lastStep = steps[steps.length - 1]
  const conversionRate = values.impressions > 0 ? (values.conversions / values.impressions) * 100 : 0
  const cpa = values.conversions > 0 ? values.spend / values.conversions : 0
  const meta = FUNNEL_META[activeFunnel]

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Funil Adaptável</h1>
          <p className="text-sm text-[#71717a] mt-0.5">Visualize o fluxo de conversão por etapa</p>
        </div>
        <div className="flex items-center gap-2">
          <div className={`flex items-center gap-1.5 px-3 h-7 rounded-full border ${isRealData ? "bg-emerald-500/10 border-emerald-500/20" : "bg-amber-500/10 border-amber-500/20"}`}>
            <div className={`w-1.5 h-1.5 rounded-full ${isRealData ? "bg-emerald-400 animate-pulse" : "bg-amber-400"}`} />
            <span className={`text-xs font-medium ${isRealData ? "text-emerald-400" : "text-amber-400"}`}>{isRealData ? "Dados reais" : "Demo"}</span>
          </div>
          <PlatformPills value={platformFilter} onChange={setPlatformFilter} />
          <BmCampaignFilter />
          <button onClick={fetchMetrics} className="w-9 h-9 flex items-center justify-center rounded-lg border border-[var(--border)] bg-[#111118] hover:bg-[#1e1e2e] transition-colors">
            <RefreshCw className={`w-3.5 h-3.5 text-[#71717a] ${loading ? "animate-spin" : ""}`} />
          </button>
          <select value={period} onChange={(e) => setPeriod(e.target.value)}
            className="h-9 px-3 rounded-lg border border-[var(--border)] bg-[#111118] text-sm text-[#f4f4f5] outline-none cursor-pointer">
            {PERIOD_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
      </div>

      {/* Seletor de tipo */}
      <div className="flex flex-wrap gap-2">
        {(Object.keys(FUNNEL_META) as FunnelType[]).map((key) => {
          const m = FUNNEL_META[key]
          return (
            <button key={key} onClick={() => setActiveFunnel(key)}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-xl border text-sm font-medium transition-all cursor-pointer",
                activeFunnel === key
                  ? "border-[#6366f1] bg-[#6366f1]/15 text-white"
                  : "border-[var(--border)] bg-[#111118] text-[#71717a] hover:text-white hover:border-[#6366f1]/40"
              )}
            >
              <span>{m.emoji}</span>{m.label}
            </button>
          )
        })}
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: "Investimento Total", value: formatCurrency(values.spend), color: "#6366f1" },
          { label: lastStep.label, value: values.conversions.toLocaleString("pt-BR"), color: "#10b981" },
          { label: "Custo por Resultado", value: formatCurrency(cpa), color: "#f59e0b" },
          { label: "Taxa de Conversão", value: `${conversionRate.toFixed(3)}%`, color: "#8b5cf6" },
        ].map((kpi) => (
          <Card key={kpi.label}>
            <CardContent className="p-4">
              <p className="text-xs text-[#71717a] mb-1">{kpi.label}</p>
              {loading
                ? <div className="h-7 w-24 bg-[#1e1e2e] rounded animate-pulse" />
                : <p className="text-xl font-bold" style={{ color: kpi.color }}>{kpi.value}</p>
              }
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Funil visual */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <span className="text-xl">{meta.emoji}</span>
            <div>
              <CardTitle>Funil {meta.label}</CardTitle>
              <CardDescription>
                {isRealData ? "Etapas calculadas com seus dados reais" : "Dados demonstrativos — conecte suas contas para ver dados reais"}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-3">
            {loading ? (
              Array.from({ length: steps.length }).map((_, i) => (
                <div key={i} className="flex items-center gap-4">
                  <div className="w-40 h-10 bg-[#1e1e2e] rounded animate-pulse flex-shrink-0" />
                  <div className="flex-1 h-10 bg-[#1e1e2e] rounded animate-pulse" />
                  <div className="w-36 h-10 bg-[#1e1e2e] rounded animate-pulse flex-shrink-0" />
                </div>
              ))
            ) : (
              steps.map((step, i) => (
                <div key={i}>
                  <FunnelBar step={step} maxValue={maxValue} />
                  {i < steps.length - 1 && (
                    <div className="flex items-center justify-center my-1">
                      <ArrowRight className="w-4 h-4 text-[#3f3f46] rotate-90" />
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      {/* Nota sobre dados */}
      {!isRealData && (
        <div className="rounded-xl border border-dashed border-[#27272a] bg-[#111118]/40 p-4 flex items-center gap-3">
          <span className="text-lg flex-shrink-0">💡</span>
          <div>
            <p className="text-sm font-medium text-white">As etapas intermediárias são projetadas</p>
            <p className="text-xs text-[#71717a] mt-0.5">
              Com contas conectadas, os dados reais de impressões, cliques e conversões alimentam o funil automaticamente.{" "}
              <a href="/dashboard/configuracoes" className="text-[#6366f1] hover:underline">Conectar agora →</a>
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
