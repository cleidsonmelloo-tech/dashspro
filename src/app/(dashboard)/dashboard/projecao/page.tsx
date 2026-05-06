"use client"

import { useState, useMemo } from "react"
import { DollarSign, Calendar, TrendingUp, Plus, Trash2 } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { BmCampaignFilter } from "@/components/ui/bm-campaign-filter"

interface PlatformBudget {
  id: string
  platform: "meta" | "google" | "tiktok" | "youtube"
  name: string
  percentage: number
  color: string
}

const platformOptions = [
  { value: "meta",    label: "Meta Ads",    color: "#1877f2" },
  { value: "google",  label: "Google Ads",  color: "#34a853" },
  { value: "tiktok",  label: "TikTok Ads",  color: "#010101" },
  { value: "youtube", label: "YouTube Ads", color: "#ff0000" },
]

function toISO(d: Date) { return d.toISOString().split("T")[0] }
function diffDays(a: string, b: string) {
  return Math.max(Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86400000) + 1, 1)
}
function fmtBRL(n: number) {
  return n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}
function fmtDate(iso: string) {
  const [y, m, d] = iso.split("-")
  return `${d}/${m}/${y}`
}

export default function ProjecaoPage() {
  const today    = new Date()
  const firstDay = toISO(new Date(today.getFullYear(), today.getMonth(), 1))
  const lastDay  = toISO(new Date(today.getFullYear(), today.getMonth() + 1, 0))

  const [totalBudget,   setTotalBudget]   = useState("10000")
  const [startDate,     setStartDate]     = useState(firstDay)
  const [endDate,       setEndDate]       = useState(lastDay)
  const [activePlatforms, setActivePlatforms] = useState<Set<string>>(new Set(["meta", "google"]))
  const [platforms, setPlatforms] = useState<PlatformBudget[]>([
    { id: "1", platform: "meta",   name: "Meta Ads",   percentage: 70, color: "#1877f2" },
    { id: "2", platform: "google", name: "Google Ads", percentage: 30, color: "#34a853" },
  ])

  const budget         = parseFloat(totalBudget) || 0
  const daysInPeriod   = diffDays(startDate, endDate)
  const daysRemaining  = Math.max(diffDays(toISO(today), endDate), 0)

  function togglePlatform(p: string) {
    setActivePlatforms(prev => {
      const next = new Set(prev)
      if (next.has(p)) { if (next.size > 1) next.delete(p) } else next.add(p)
      return next
    })
  }

  /** Atualiza percentual e recalcula o total se necessário */
  function updatePercentage(id: string, raw: string) {
    const num = Math.min(100, Math.max(0, parseFloat(raw) || 0))
    setPlatforms(prev => prev.map(p => p.id === id ? { ...p, percentage: num } : p))
  }

  /** Usuário digitou um valor R$ → converte para % relativo ao orçamento total */
  function updateBudgetValue(id: string, raw: string) {
    const value = parseFloat(raw.replace(/[^\d.,]/g, "").replace(",", ".")) || 0
    if (budget <= 0) return
    const pct = Math.min(100, Math.max(0, (value / budget) * 100))
    setPlatforms(prev => prev.map(p => p.id === id ? { ...p, percentage: parseFloat(pct.toFixed(2)) } : p))
  }

  const filteredPlatforms = platforms.filter(p => activePlatforms.has(p.platform))
  const totalPercentage   = filteredPlatforms.reduce((s, p) => s + p.percentage, 0)

  const projections = useMemo(() => {
    return filteredPlatforms.map(p => {
      const share           = (p.percentage / 100) * budget
      const dailyBudget     = share / daysInPeriod
      const remainingBudget = dailyBudget * daysRemaining
      return { ...p, share, dailyBudget, remainingBudget }
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filteredPlatforms, budget, daysInPeriod, daysRemaining])

  function addPlatform() {
    const available = platformOptions.find(o => !platforms.find(p => p.platform === o.value))
    if (!available) return
    setPlatforms(prev => [...prev, {
      id: Date.now().toString(),
      platform: available.value as PlatformBudget["platform"],
      name: available.label,
      percentage: 0,
      color: available.color,
    }])
  }

  function removePlatform(id: string) {
    setPlatforms(prev => prev.filter(p => p.id !== id))
  }

  return (
    <div className="flex flex-col gap-6 max-w-4xl">

      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Projeção de Verba</h1>
          <p className="text-sm text-[#71717a] mt-0.5">Calcule e distribua seu orçamento de mídia automaticamente</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {[
            { value: "meta",   label: "Meta Ads",   color: "#1877f2" },
            { value: "google", label: "Google Ads", color: "#34a853" },
          ].map(opt => (
            <button key={opt.value} onClick={() => togglePlatform(opt.value)}
              className={cn(
                "flex items-center gap-1.5 px-3 h-8 rounded-full border text-xs font-medium transition-all cursor-pointer",
                activePlatforms.has(opt.value)
                  ? "border-transparent text-white"
                  : "border-[var(--border)] bg-[#131313] text-[#71717a] hover:text-white"
              )}
              style={activePlatforms.has(opt.value)
                ? { backgroundColor: `${opt.color}25`, borderColor: `${opt.color}60`, color: opt.color }
                : {}}
            >
              <span className="w-2 h-2 rounded-full"
                style={{ backgroundColor: activePlatforms.has(opt.value) ? opt.color : "#52525b" }} />
              {opt.label}
            </button>
          ))}
          <BmCampaignFilter />
        </div>
      </div>

      {/* Configuração do período */}
      <Card>
        <CardHeader>
          <CardTitle>Configuração do Período</CardTitle>
          <CardDescription>Defina o orçamento total e o período de veiculação</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-5">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* Orçamento total */}
            <Input label="Orçamento Total (R$)" type="number" value={totalBudget}
              onChange={e => setTotalBudget(e.target.value)}
              leftIcon={<DollarSign className="w-4 h-4" />} placeholder="10000" />

            {/* Data de início */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-[#a1a1aa]">Data de início</label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#71717a] pointer-events-none" />
                <input
                  type="date"
                  value={startDate}
                  max={endDate}
                  onChange={e => setStartDate(e.target.value)}
                  className="w-full h-10 pl-9 pr-3 rounded-lg border border-[var(--border)] bg-[#131313] text-sm text-white outline-none focus:border-[#FF5F1A] transition-colors cursor-pointer"
                  style={{ colorScheme: "dark" }}
                />
              </div>
              <span className="text-[11px] text-[#52525b]">{fmtDate(startDate)}</span>
            </div>

            {/* Data de término */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-[#a1a1aa]">Data de término</label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#71717a] pointer-events-none" />
                <input
                  type="date"
                  value={endDate}
                  min={startDate}
                  onChange={e => setEndDate(e.target.value)}
                  className="w-full h-10 pl-9 pr-3 rounded-lg border border-[var(--border)] bg-[#131313] text-sm text-white outline-none focus:border-[#FF5F1A] transition-colors cursor-pointer"
                  style={{ colorScheme: "dark" }}
                />
              </div>
              <span className="text-[11px] text-[#52525b]">{fmtDate(endDate)}</span>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            {[
              { label: "Dias no período",      value: `${daysInPeriod} dias` },
              { label: "Dias restantes",        value: `${daysRemaining} dias` },
              { label: "Orçamento/dia (total)", value: `R$ ${fmtBRL(budget / daysInPeriod)}` },
            ].map(info => (
              <div key={info.label} className="rounded-lg bg-[#0f0f0f] border border-[var(--border)] p-3">
                <p className="text-xs text-[#71717a]">{info.label}</p>
                <p className="text-base font-bold text-white mt-0.5">{info.value}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Distribuição por plataforma */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Distribuição por Plataforma</CardTitle>
              <CardDescription>
                Total: <span className={cn("font-semibold", totalPercentage === 100 ? "text-emerald-400" : "text-amber-400")}>{totalPercentage.toFixed(1)}%</span>
                {Math.abs(totalPercentage - 100) > 0.1 && <span className="text-amber-400 ml-1">(deve somar 100%)</span>}
              </CardDescription>
            </div>
            <Button size="sm" variant="outline" onClick={addPlatform} className="gap-2">
              <Plus className="w-3.5 h-3.5" /> Plataforma
            </Button>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {filteredPlatforms.map(p => {
            const platformBudget = (p.percentage / 100) * budget
            return (
              <div key={p.id} className="rounded-xl border border-[var(--border)] bg-[#0f0f0f] overflow-hidden">
                {/* Linha principal */}
                <div className="flex items-center gap-3 px-4 py-3">
                  <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: p.color }} />
                  <span className="text-sm font-semibold text-white w-28 flex-shrink-0">{p.name}</span>
                  {/* Barra de progresso */}
                  <div className="flex-1 h-2 bg-[#1a1410] rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all duration-300"
                      style={{ width: `${Math.min(p.percentage, 100)}%`, backgroundColor: p.color }} />
                  </div>
                  {platforms.length > 1 && (
                    <button onClick={() => removePlatform(p.id)}
                      className="text-[#52525b] hover:text-red-400 transition-colors cursor-pointer flex-shrink-0">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
                {/* Inputs de valor e percentual */}
                <div className="grid grid-cols-2 gap-px border-t border-[var(--border)]">
                  {/* Orçamento R$ */}
                  <div className="bg-[#0a0a12] px-4 py-3">
                    <p className="text-[10px] text-[#71717a] mb-1.5 uppercase tracking-wide">Orçamento (R$)</p>
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs text-[#52525b]">R$</span>
                      <input
                        type="number"
                        value={parseFloat(platformBudget.toFixed(2))}
                        onChange={e => updateBudgetValue(p.id, e.target.value)}
                        className="flex-1 h-9 rounded-lg border border-[var(--border)] bg-[#131313] px-2 text-sm font-bold text-white outline-none focus:border-[#FF5F1A] transition-colors"
                        style={{ colorScheme: "dark" }}
                        min={0}
                        step={100}
                      />
                    </div>
                    <p className="text-[10px] text-[#52525b] mt-1">Digite o valor para esta plataforma</p>
                  </div>
                  {/* Percentual % */}
                  <div className="bg-[#0a0a12] px-4 py-3 border-l border-[var(--border)]">
                    <p className="text-[10px] text-[#71717a] mb-1.5 uppercase tracking-wide">Percentual (%)</p>
                    <div className="flex items-center gap-1.5">
                      <input
                        type="number"
                        value={p.percentage}
                        onChange={e => updatePercentage(p.id, e.target.value)}
                        className="flex-1 h-9 rounded-lg border border-[var(--border)] bg-[#131313] px-2 text-sm font-bold text-white outline-none focus:border-[#FF5F1A] transition-colors"
                        style={{ colorScheme: "dark" }}
                        min={0} max={100} step={1}
                      />
                      <span className="text-sm text-[#52525b]">%</span>
                    </div>
                    <p className="text-[10px] text-[#52525b] mt-1">Do orçamento total</p>
                  </div>
                </div>
              </div>
            )
          })}
        </CardContent>
      </Card>

      {/* Resultado da projeção */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {projections.map(p => (
          <Card key={p.id} className="border-l-4" style={{ borderLeftColor: p.color }}>
            <CardContent className="p-5">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: p.color }} />
                <h3 className="font-semibold text-white">{p.name}</h3>
                <span className="text-xs text-[#71717a] ml-auto">{p.percentage}%</span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: "Orçamento Total",     value: `R$ ${fmtBRL(p.share)}` },
                  { label: "Diário (período)",    value: `R$ ${fmtBRL(p.dailyBudget)}` },
                  { label: "Total no Período",    value: `R$ ${fmtBRL(p.share)}`, highlight: true },
                  { label: "Restante do Período", value: `R$ ${fmtBRL(p.remainingBudget)}` },
                ].map(item => (
                  <div key={item.label}
                    className={cn("rounded-lg p-3",
                      item.highlight
                        ? "bg-[#FF5F1A]/10 border border-[#FF5F1A]/20"
                        : "bg-[#0f0f0f] border border-[var(--border)]")}>
                    <p className="text-[10px] text-[#71717a] mb-1">{item.label}</p>
                    <p className={cn("text-sm font-bold", item.highlight ? "text-[#FF8C42]" : "text-white")}>
                      {item.value}
                    </p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Resumo total */}
      {Math.abs(totalPercentage - 100) <= 0.1 && (
        <Card className="bg-[#FF5F1A]/5 border-[#FF5F1A]/20">
          <CardContent className="p-5">
            <div className="flex items-center gap-2 mb-3">
              <TrendingUp className="w-4 h-4 text-[#FF8C42]" />
              <h3 className="font-semibold text-white">Resumo da Projeção</h3>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: "Total no Período",     value: `R$ ${fmtBRL(budget)}` },
                { label: "Média Diária",         value: `R$ ${fmtBRL(budget / daysInPeriod)}` },
                { label: "Período",              value: `${fmtDate(startDate)} → ${fmtDate(endDate)}` },
                { label: "Restante do Período",  value: `R$ ${fmtBRL((budget / daysInPeriod) * daysRemaining)}` },
              ].map(item => (
                <div key={item.label}>
                  <p className="text-xs text-[#71717a]">{item.label}</p>
                  <p className="text-base font-bold text-[#FF8C42] mt-0.5">{item.value}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
