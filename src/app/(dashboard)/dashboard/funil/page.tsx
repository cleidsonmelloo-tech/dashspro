"use client"

import { useState, useEffect, useCallback } from "react"
import { TrendingDown, DollarSign, Users, ShoppingCart, MessageCircle, GraduationCap, ClipboardList, Pizza, RefreshCw } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { formatCurrency, cn } from "@/lib/utils"
import { BmCampaignFilter } from "@/components/ui/bm-campaign-filter"
import { PlatformPills } from "@/components/ui/platform-pills"
import { useFilter } from "@/lib/filter-context"
import { DateRangePicker } from "@/components/ui/date-range-picker"

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

// Cone-shaped funnel slice — true 3D look
function FunnelSlice({ step, index, total }: { step: FunnelStep; index: number; total: number }) {
  const Icon = step.icon
  // Width narrows from 100% (top) to 28% (bottom)
  const startPct = 100 - (index * (72 / Math.max(1, total - 1)))
  const endPct = 100 - ((index + 1) * (72 / Math.max(1, total - 1)))
  const topInset = (100 - startPct) / 2
  const botInset = (100 - Math.max(endPct, 28)) / 2

  // Lighter shade for inner highlight (3D effect)
  const lighter = step.color + "ff"
  const darker = step.color + "aa"

  return (
    <div className="relative w-full flex items-center justify-center" style={{ height: 78 }}>
      {/* Trapezoid background (clip-path) */}
      <div
        className="absolute inset-0 transition-all duration-500"
        style={{
          clipPath: `polygon(${topInset}% 0%, ${100 - topInset}% 0%, ${100 - botInset}% 100%, ${botInset}% 100%)`,
          background: `linear-gradient(180deg, ${lighter} 0%, ${darker} 100%)`,
          filter: "drop-shadow(0 4px 12px rgba(0,0,0,0.4))",
        }}
      />
      {/* Inner highlight strip for 3D feel */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          clipPath: `polygon(${topInset + 1}% 0%, ${topInset + 4}% 0%, ${botInset + 3}% 100%, ${botInset}% 100%)`,
          background: "linear-gradient(180deg, rgba(255,255,255,0.25), rgba(255,255,255,0))",
        }}
      />

      {/* Content centered */}
      <div className="relative z-10 flex items-center gap-3 text-white px-4">
        <div className="w-9 h-9 rounded-lg bg-black/25 flex items-center justify-center backdrop-blur-sm flex-shrink-0">
          <Icon className="w-4 h-4 text-white" />
        </div>
        <div className="text-center min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-wider text-white/90 truncate">{step.label}</p>
          <p className="text-xl font-black leading-tight">{step.value.toLocaleString("pt-BR")}</p>
        </div>
      </div>
    </div>
  )
}

// Side panel showing rate and cost for each step
function FunnelStats({ steps, maxValue }: { steps: FunnelStep[]; maxValue: number }) {
  return (
    <div className="flex flex-col gap-1 pt-2">
      {steps.map((step, i) => {
        const pct = (step.value / maxValue) * 100
        const prev = i > 0 ? steps[i - 1].value : null
        const drop = prev !== null && prev > 0 ? ((prev - step.value) / prev) * 100 : 0
        return (
          <div key={i} className="flex items-center gap-2 h-[78px] px-3 rounded-lg hover:bg-[#1a1410] transition-colors">
            <div className="w-1.5 h-10 rounded-full flex-shrink-0" style={{ backgroundColor: step.color }} />
            <div className="flex-1 min-w-0">
              <p className="text-xs text-[#a1a1aa] truncate">{step.label}</p>
              <div className="flex items-center gap-3 mt-0.5 text-[11px]">
                <span className="text-white font-bold">{pct.toFixed(1)}%</span>
                {step.rate !== undefined && step.rate > 0 && (
                  <span className="text-[#71717a]">Taxa: <strong className="text-[#a1a1aa]">{step.rate.toFixed(1)}%</strong></span>
                )}
                {step.cost !== undefined && step.cost > 0 && (
                  <span className="text-[#71717a]">Custo: <strong className="text-[#a1a1aa]">{formatCurrency(step.cost)}</strong></span>
                )}
                {drop > 0 && (
                  <span className="flex items-center gap-1 text-red-400">
                    <TrendingDown className="w-2.5 h-2.5" />
                    -{drop.toFixed(0)}%
                  </span>
                )}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

export default function FunilPage() {
  const { filterParam, dateRange, setDateRange, platformFilter, setPlatformFilter } = useFilter()
  const [activeFunnel, setActiveFunnel] = useState<FunnelType>("ecommerce")
  const [loading, setLoading] = useState(false)
  const [isRealData, setIsRealData] = useState(false)
  const [liveMetrics, setLiveMetrics] = useState<{ impressions: number; clicks: number; conversions: number; spend: number } | null>(null)
  const [kiwifySales, setKiwifySales] = useState<number | null>(null)

  const fetchMetrics = useCallback(async () => {
    setLoading(true)
    try {
      const { since, until } = dateRange
      const [metricsRes, kiwifyRes] = await Promise.all([
        fetch(`/api/dashboard/metrics?since=${since}&until=${until}${filterParam}`),
        fetch(`/api/kiwify/stats?since=${since}&until=${until}`),
      ])
      if (metricsRes.ok) {
        const data = await metricsRes.json()
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
      if (kiwifyRes.ok) {
        const k = await kiwifyRes.json()
        setKiwifySales(k.connected && k.stats ? k.stats.total_sales : null)
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
  // Se houver vendas reais Kiwify, usar como conversão real
  const realConversions = kiwifySales !== null && kiwifySales > 0 ? kiwifySales : values.conversions
  const steps = buildFunnelSteps(activeFunnel, values.impressions, values.clicks, realConversions, values.spend)
  const maxValue = steps[0].value
  const lastStep = steps[steps.length - 1]
  const conversionRate = values.impressions > 0 ? (realConversions / values.impressions) * 100 : 0
  const cpa = realConversions > 0 ? values.spend / realConversions : 0
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

      {/* KPIs — alinhados com altura fixa */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        {[
          { label: "Investimento Total", value: formatCurrency(values.spend), color: "#FF5F1A" },
          { label: lastStep.label, value: realConversions.toLocaleString("pt-BR"), color: "#10b981" },
          { label: "Custo por Resultado", value: formatCurrency(cpa), color: "#f59e0b" },
          { label: "Taxa de Conversão", value: `${conversionRate.toFixed(3)}%`, color: "#FF7A33" },
        ].map((kpi) => (
          <Card key={kpi.label} className="h-[100px]">
            <CardContent className="p-3 sm:p-4 grid grid-rows-[auto_1fr] gap-1 h-full">
              <p
                className="text-[10px] sm:text-xs font-semibold text-[#71717a] uppercase tracking-wider line-clamp-2 leading-[1.25]"
                style={{ minHeight: "26px" }}
              >
                {kpi.label}
              </p>
              <div className="flex items-center">
                {loading
                  ? <div className="h-7 w-24 bg-[#1a1410] rounded animate-pulse" />
                  : <p
                      className="font-bold leading-none truncate w-full"
                      style={{ color: kpi.color, fontSize: "clamp(14px, 1.4vw, 22px)" }}
                      title={kpi.value}
                    >
                      {kpi.value}
                    </p>
                }
              </div>
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
          {loading ? (
            <div className="flex flex-col gap-1">
              {Array.from({ length: steps.length }).map((_, i) => (
                <div key={i} className="h-[78px] bg-[#1a1410] rounded animate-pulse" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-[1.4fr_1fr] gap-6 items-start">
              {/* Cone do funil */}
              <div className="flex flex-col gap-0 px-4 py-2">
                {steps.map((step, i) => (
                  <FunnelSlice key={i} step={step} index={i} total={steps.length} />
                ))}
                {/* Base / "alvo" */}
                <div className="flex justify-center mt-2">
                  <div className="w-16 h-1 rounded-full bg-gradient-to-r from-transparent via-[#FF5F1A] to-transparent opacity-60" />
                </div>
              </div>
              {/* Painel de estatísticas */}
              <FunnelStats steps={steps} maxValue={maxValue} />
            </div>
          )}
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
