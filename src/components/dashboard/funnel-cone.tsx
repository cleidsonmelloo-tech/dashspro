"use client"

import { TrendingDown, DollarSign, Users, ShoppingCart, MessageCircle, ClipboardList, Pizza } from "lucide-react"
import { formatCurrency } from "@/lib/utils"

export type FunnelType = "ecommerce" | "mensagens" | "infoproduto" | "cadastro" | "delivery"

export interface FunnelStep {
  label: string
  value: number
  cost?: number
  rate?: number
  color: string
  icon: React.ElementType
}

export function buildFunnelSteps(
  type: FunnelType,
  impressions: number,
  clicks: number,
  conversions: number,
  spend: number
): FunnelStep[] {
  const ctr = impressions > 0 ? (clicks / impressions) * 100 : 0
  const cpc = clicks > 0 ? spend / clicks : 0
  const cpa = conversions > 0 ? spend / conversions : 0
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

export function FunnelSlice({ step, index, total }: { step: FunnelStep; index: number; total: number }) {
  const Icon = step.icon
  const startPct = 100 - (index * (72 / Math.max(1, total - 1)))
  const endPct = 100 - ((index + 1) * (72 / Math.max(1, total - 1)))
  const topInset = (100 - startPct) / 2
  const botInset = (100 - Math.max(endPct, 28)) / 2

  return (
    <div className="relative w-full flex items-center justify-center" style={{ height: 72 }}>
      <div
        className="absolute inset-0 transition-all duration-500"
        style={{
          clipPath: `polygon(${topInset}% 0%, ${100 - topInset}% 0%, ${100 - botInset}% 100%, ${botInset}% 100%)`,
          background: `linear-gradient(180deg, ${step.color} 0%, ${step.color}aa 100%)`,
          filter: "drop-shadow(0 4px 12px rgba(0,0,0,0.4))",
        }}
      />
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          clipPath: `polygon(${topInset + 1}% 0%, ${topInset + 4}% 0%, ${botInset + 3}% 100%, ${botInset}% 100%)`,
          background: "linear-gradient(180deg, rgba(255,255,255,0.25), rgba(255,255,255,0))",
        }}
      />
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

export function FunnelStats({ steps, maxValue }: { steps: FunnelStep[]; maxValue: number }) {
  return (
    <div className="flex flex-col gap-1 pt-2">
      {steps.map((step, i) => {
        const pct = (step.value / maxValue) * 100
        const prev = i > 0 ? steps[i - 1].value : null
        const drop = prev !== null && prev > 0 ? ((prev - step.value) / prev) * 100 : 0
        return (
          <div key={i} className="flex items-center gap-2 h-[72px] px-3 rounded-lg hover:bg-[#1a1410] transition-colors">
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

// Componente completo: cone + estatísticas
export function FunnelCone({
  type, impressions, clicks, conversions, spend,
}: {
  type: FunnelType
  impressions: number
  clicks: number
  conversions: number
  spend: number
}) {
  const steps = buildFunnelSteps(type, impressions, clicks, conversions, spend)
  const maxValue = steps[0].value || 1

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1.4fr_1fr] gap-6 items-start">
      <div className="flex flex-col gap-0 px-4 py-2">
        {steps.map((step, i) => (
          <FunnelSlice key={i} step={step} index={i} total={steps.length} />
        ))}
        <div className="flex justify-center mt-2">
          <div className="w-16 h-1 rounded-full bg-gradient-to-r from-transparent via-[#FF5F1A] to-transparent opacity-60" />
        </div>
      </div>
      <FunnelStats steps={steps} maxValue={maxValue} />
    </div>
  )
}
