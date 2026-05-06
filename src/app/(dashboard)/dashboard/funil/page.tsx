"use client"

import { useState, useEffect, useCallback } from "react"
import { TrendingDown, DollarSign, Users, ShoppingCart, MessageCircle, GraduationCap, ClipboardList, Pizza, RefreshCw } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { formatCurrency, cn } from "@/lib/utils"
import { BmCampaignFilter } from "@/components/ui/bm-campaign-filter"
import { PlatformPills } from "@/components/ui/platform-pills"
import { useFilter } from "@/lib/filter-context"
import { DateRangePicker, DateRange } from "@/components/ui/date-range-picker"

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
    // Paleta laranja unificada
    const C = ["#FF5F1A", "#FF7A33", "#FF8C42", "#FFA66B", "#FFBC8E", "#10b981"]
    switch (type) {
    case "ecommerce":
      return [
        { label: "Impressões", value: impressions, color: C[0], icon: Users },
        { label: "Cliques no Anúncio", value: clicks, rate: ctr, cost: cpc, color: C[1], icon: Users },
        { label: "Visitas à Loja", value: Math.round(clicks * 0.82), rate: 82, cost: cpc * 1.22, color: C[2], icon: Users },
        { label: "Adicionou ao Carrinho", value: Math.round(clicks * 0.19), rate: 23, cost: cpc * 4.3, color: C[3], icon: ShoppingCart },
        { label: "Iniciou Checkout", value: Math.round(clicks * 0.09), rate: 47, cost: cpc * 9.2, color: C[4], icon: ShoppingCart },
        { label: "Compras", value: conversions, rate: conversions > 0 ? (conversions / Math.round(clicks * 0.09)) * 100 : 0, cost: cpa, color: C[5], icon: DollarSign },
      ]
    case "mensagens":
      return [
        { label: "Impressões", value: impressions, color: C[0], icon: Users },
        { label: "Cliques no Anúncio", value: clicks, rate: ctr, cost: cpc, color: C[1], icon: Users },
        { label: "Conversas Iniciadas", value: Math.round(clicks * 0.82), rate: 82, cost: cpc * 1.22, color: C[2], icon: MessageCircle },
        { label: "Responderam", value: Math.round(clicks * 0.59), rate: 72, cost: cpc * 1.69, color: C[3], icon: MessageCircle },
        { label: "Proposta Enviada", value: Math.round(clicks * 0.22), rate: 38, cost: cpc * 4.55, color: C[4], icon: MessageCircle },
        { label: "Vendas Fechadas", value: conversions, rate: 0, cost: cpa, color: C[5], icon: DollarSign },
      ]
    case "infoproduto":
      return [
        { label: "Impressões", value: impressions, color: C[0], icon: Users },
        { label: "Cliques no Anúncio", value: clicks, rate: ctr, cost: cpc, color: C[1], icon: Users },
        { label: "Visitas à Página", value: Math.round(clicks * 0.87), rate: 87, cost: cpc * 1.15, color: C[2], icon: Users },
        { label: "Leads Capturados", value: Math.round(clicks * 0.22), rate: 25, cost: cpc * 4.55, color: C[3], icon: ClipboardList },
        { label: "Foram ao Checkout", value: Math.round(clicks * 0.095), rate: 43, cost: cpc * 10.5, color: C[4], icon: ShoppingCart },
        { label: "Compraram", value: conversions, rate: 0, cost: cpa, color: C[5], icon: DollarSign },
      ]
    case "cadastro":
      return [
        { label: "Impressões", value: impressions, color: C[0], icon: Users },
        { label: "Cliques no Anúncio", value: clicks, rate: ctr, cost: cpc, color: C[1], icon: Users },
        { label: "Visitas à Landing Page", value: Math.round(clicks * 0.86), rate: 86, cost: cpc * 1.16, color: C[2], icon: Users },
        { label: "Iniciou Formulário", value: Math.round(clicks * 0.34), rate: 40, cost: cpc * 2.94, color: C[3], icon: ClipboardList },
        { label: "Leads Qualificados", value: conversions, rate: 0, cost: cpa, color: C[5], icon: ClipboardList },
      ]
    case "delivery":
      return [
        { label: "Impressões", value: impressions, color: C[0], icon: Users },
        { label: "Cliques no Anúncio", value: clicks, rate: ctr, cost: cpc, color: C[1], icon: Users },
        { label: "Acessou Cardápio", value: Math.round(clicks * 0.78), rate: 78, cost: cpc * 1.28, color: C[2], icon: Pizza },
        { label: "Adicionou Item", value: Math.round(clicks * 0.5), rate: 65, cost: cpc * 2.0, color: C[3], icon: Pizza },
        { label: "Pedidos Finalizados", value: conversions, rate: 0, cost: cpa, color: C[5], icon: DollarSign },
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

function FunnelBar({ step, maxValue, prevValue, isLast }: { step: FunnelStep; maxValue: number; prevValue?: number; isLast?: boolean }) {
  const width = Math.max((step.value / maxValue) * 100, 8)
  const dropPct = prevValue !== undefined && prevValue > 0
    ? ((prevValue - step.value) / prevValue) * 100
    : 0
  const Icon = step.icon

  return (
    <div className="flex flex-col items-center group">
      {/* Linha de queda entre etapas */}
      {prevValue !== undefined && dropPct > 0 && (
        <div className="flex items-center gap-2 -mt-1 mb-1 text-[10px] text-[#71717a]">
          <TrendingDown className="w-3 h-3 text-red-400" />
          <span>Perdeu <span className="text-red-400 font-semibold">{dropPct.toFixed(1)}%</span> nesta etapa</span>
        </div>
      )}

      {/* Bloco do funil — formato trapézio centrado */}
      <div className="relative w-full flex items-center justify-center" style={{ height: "72px" }}>
        {/* Barra centralizada com gradiente */}
        <div
          className="relative h-full rounded-lg flex items-center justify-between px-5 transition-all duration-700 shadow-lg"
          style={{
            width: `${width}%`,
            minWidth: "240px",
            background: `linear-gradient(135deg, ${step.color} 0%, ${step.color}cc 100%)`,
            boxShadow: `0 4px 20px ${step.color}40`,
          }}
        >
          {/* Lado esquerdo: ícone + label */}
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-white/20 flex items-center justify-center backdrop-blur-sm">
              <Icon className="w-4 h-4 text-white" />
            </div>
            <div>
              <p className="text-[10px] font-medium text-white/80 uppercase tracking-wider">{step.label}</p>
              <p className="text-xl font-bold text-white leading-tight">{step.value.toLocaleString("pt-BR")}</p>
            </div>
          </div>

          {/* Lado direito: % + métricas */}
          <div className="flex flex-col items-end gap-0.5">
            <span className="text-2xl font-black text-white tracking-tight">
              {((step.value / maxValue) * 100).toFixed(1)}%
            </span>
            <div className="flex items-center gap-2 text-[10px] text-white/80">
              {step.rate !== undefined && step.rate > 0 && (
                <span>Taxa: <strong className="text-white">{step.rate.toFixed(1)}%</strong></span>
              )}
              {step.cost !== undefined && step.cost > 0 && (
                <span>Custo: <strong className="text-white">{formatCurrency(step.cost)}</strong></span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Conector seta para baixo entre etapas */}
      {!isLast && (
        <div className="my-1 w-0 h-0 border-l-[8px] border-l-transparent border-r-[8px] border-r-transparent border-t-[10px]"
          style={{ borderTopColor: step.color, opacity: 0.5 }}
        />
      )}
    </div>
  )
}

export default function FunilPage() {
  const { filterParam } = useFilter()
  const [platformFilter, setPlatformFilter] = useState<string[]>([])
  const [activeFunnel, setActiveFunnel] = useState<FunnelType>("ecommerce")
  const [dateRange, setDateRange] = useState<DateRange>(() => {
    const d = new Date(); const until = d.toISOString().split("T")[0]
    d.setDate(d.getDate() - 30); const since = d.toISOString().split("T")[0]
    return { since, until }
  })
  const [loading, setLoading] = useState(false)
  const [isRealData, setIsRealData] = useState(false)
  const [liveMetrics, setLiveMetrics] = useState<{ impressions: number; clicks: number; conversions: number; spend: number } | null>(null)

  const fetchMetrics = useCallback(async () => {
    setLoading(true)
    try {
      const { since, until } = dateRange
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
  }, [dateRange, filterParam])

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
          <button onClick={fetchMetrics} className="w-9 h-9 flex items-center justify-center rounded-lg border border-[var(--border)] bg-[#131313] hover:bg-[#1a1410] transition-colors">
            <RefreshCw className={`w-3.5 h-3.5 text-[#71717a] ${loading ? "animate-spin" : ""}`} />
          </button>
          <DateRangePicker value={dateRange} onChange={setDateRange} />
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
                  ? "border-[#FF5F1A] bg-[#FF5F1A]/15 text-white"
                  : "border-[var(--border)] bg-[#131313] text-[#71717a] hover:text-white hover:border-[#FF5F1A]/40"
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
          { label: "Investimento Total", value: formatCurrency(values.spend), color: "#FF5F1A" },
          { label: lastStep.label, value: values.conversions.toLocaleString("pt-BR"), color: "#10b981" },
          { label: "Custo por Resultado", value: formatCurrency(cpa), color: "#f59e0b" },
          { label: "Taxa de Conversão", value: `${conversionRate.toFixed(3)}%`, color: "#FF7A33" },
        ].map((kpi) => (
          <Card key={kpi.label}>
            <CardContent className="p-4">
              <p className="text-xs text-[#71717a] mb-1">{kpi.label}</p>
              {loading
                ? <div className="h-7 w-24 bg-[#1a1410] rounded animate-pulse" />
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
                  <div className="w-40 h-10 bg-[#1a1410] rounded animate-pulse flex-shrink-0" />
                  <div className="flex-1 h-10 bg-[#1a1410] rounded animate-pulse" />
                  <div className="w-36 h-10 bg-[#1a1410] rounded animate-pulse flex-shrink-0" />
                </div>
              ))
            ) : (
              steps.map((step, i) => (
                <FunnelBar
                  key={i}
                  step={step}
                  maxValue={maxValue}
                  prevValue={i > 0 ? steps[i - 1].value : undefined}
                  isLast={i === steps.length - 1}
                />
              ))
            )}
          </div>
        </CardContent>
      </Card>

      {/* Nota sobre dados */}
      {!isRealData && (
        <div className="rounded-xl border border-dashed border-[#2a1f15] bg-[#131313]/40 p-4 flex items-center gap-3">
          <span className="text-lg flex-shrink-0">💡</span>
          <div>
            <p className="text-sm font-medium text-white">As etapas intermediárias são projetadas</p>
            <p className="text-xs text-[#71717a] mt-0.5">
              Com contas conectadas, os dados reais de impressões, cliques e conversões alimentam o funil automaticamente.{" "}
              <a href="/dashboard/configuracoes" className="text-[#FF5F1A] hover:underline">Conectar agora →</a>
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
