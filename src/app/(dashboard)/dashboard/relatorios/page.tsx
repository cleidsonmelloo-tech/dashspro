"use client"

import { useState, useEffect, useCallback } from "react"
import { Download, RefreshCw, FileText, TrendingUp, DollarSign, MousePointer, Eye, Target, FileSpreadsheet } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { formatCurrency, formatNumber, formatPercent, cn } from "@/lib/utils"

interface Campaign {
  id: string; name: string; platform: string; account_name?: string
  status: string; spend: number; impressions: number; clicks: number
  conversions: number; ctr: number; cpc: number; cpa: number; roas: number
}

interface DashMetrics {
  spend: number; impressions: number; clicks: number; conversions: number
  ctr: number; cpc: number; cpa: number; meta_spend: number; google_spend: number
}

const PERIOD_OPTIONS = [
  { label: "Hoje", value: "today" },
  { label: "Últimos 7 dias", value: "7d" },
  { label: "Últimos 30 dias", value: "30d" },
  { label: "Este mês", value: "this_month" },
  { label: "Mês anterior", value: "last_month" },
]

function getDateRange(period: string): { since: string; until: string; label: string } {
  const today = new Date()
  const until = today.toISOString().split("T")[0]
  if (period === "today") return { since: until, until, label: "Hoje" }
  if (period === "7d") {
    const d = new Date(today); d.setDate(d.getDate() - 7)
    return { since: d.toISOString().split("T")[0], until, label: "Últimos 7 dias" }
  }
  if (period === "this_month") {
    const since = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-01`
    return { since, until, label: "Este mês" }
  }
  if (period === "last_month") {
    const d = new Date(today.getFullYear(), today.getMonth() - 1, 1)
    const e = new Date(today.getFullYear(), today.getMonth(), 0)
    return { since: d.toISOString().split("T")[0], until: e.toISOString().split("T")[0], label: "Mês anterior" }
  }
  // 30d
  const d = new Date(today); d.setDate(d.getDate() - 30)
  return { since: d.toISOString().split("T")[0], until, label: "Últimos 30 dias" }
}

function exportCSV(campaigns: Campaign[], metrics: DashMetrics | null, period: string) {
  const { label } = getDateRange(period)
  const rows: string[] = []

  // Cabeçalho do relatório
  rows.push(`"Relatório DashsPro — ${label}"`)
  rows.push(`"Gerado em: ${new Date().toLocaleString("pt-BR")}"`)
  rows.push("")

  // Resumo geral
  if (metrics) {
    rows.push('"RESUMO GERAL"')
    rows.push('"Métrica","Valor"')
    rows.push(`"Investimento Total","${formatCurrency(metrics.spend)}"`)
    rows.push(`"Impressões","${formatNumber(metrics.impressions)}"`)
    rows.push(`"Cliques","${formatNumber(metrics.clicks)}"`)
    rows.push(`"CTR Médio","${formatPercent(metrics.ctr)}"`)
    rows.push(`"CPC Médio","${formatCurrency(metrics.cpc)}"`)
    rows.push(`"Conversões","${formatNumber(metrics.conversions)}"`)
    rows.push(`"CPA Médio","${formatCurrency(metrics.cpa)}"`)
    rows.push(`"Investimento Meta","${formatCurrency(metrics.meta_spend)}"`)
    rows.push(`"Investimento Google","${formatCurrency(metrics.google_spend)}"`)
    rows.push("")
  }

  // Campanhas
  if (campaigns.length > 0) {
    rows.push('"CAMPANHAS"')
    rows.push('"Campanha","Plataforma","Status","Investimento","Impressões","Cliques","CTR","CPC","Conversões","CPA","ROAS"')
    for (const c of campaigns) {
      rows.push([
        `"${c.name}"`,
        `"${c.platform === "meta" ? "Meta Ads" : "Google Ads"}"`,
        `"${c.status}"`,
        `"${formatCurrency(c.spend)}"`,
        `"${formatNumber(c.impressions)}"`,
        `"${formatNumber(c.clicks)}"`,
        `"${formatPercent(c.ctr)}"`,
        `"${formatCurrency(c.cpc)}"`,
        `"${Math.round(c.conversions)}"`,
        `"${c.cpa > 0 ? formatCurrency(c.cpa) : "—"}"`,
        `"${c.roas > 0 ? c.roas.toFixed(2) + "x" : "—"}"`,
      ].join(","))
    }
  }

  const blob = new Blob(["﻿" + rows.join("\n")], { type: "text/csv;charset=utf-8;" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = `dashspro-relatorio-${period}-${new Date().toISOString().split("T")[0]}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

export default function RelatoriosPage() {
  const [period, setPeriod] = useState("30d")
  const [loading, setLoading] = useState(false)
  const [connected, setConnected] = useState(false)
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [metrics, setMetrics] = useState<DashMetrics | null>(null)
  const [exporting, setExporting] = useState(false)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const { since, until } = getDateRange(period)
      const [metricsRes, metaCRes, googleCRes] = await Promise.all([
        fetch(`/api/dashboard/metrics?since=${since}&until=${until}`),
        fetch(`/api/meta/campaigns?since=${since}&until=${until}`),
        fetch(`/api/google/campaigns?since=${since}&until=${until}`),
      ])

      const md = metricsRes.ok ? await metricsRes.json() : { connected: false }
      if (md.connected) { setConnected(true); setMetrics(md.metrics) }
      else { setConnected(false); setMetrics(null) }

      const meta = (metaCRes.ok ? await metaCRes.json() : { campaigns: [] }).campaigns || []
      const google = (googleCRes.ok ? await googleCRes.json() : { campaigns: [] }).campaigns || []
      const all = [...meta, ...google].sort((a: Campaign, b: Campaign) => b.spend - a.spend)
      setCampaigns(all)
    } catch {
      setConnected(false)
    } finally {
      setLoading(false)
    }
  }, [period])

  useEffect(() => { fetchData() }, [fetchData])

  function handleExport() {
    setExporting(true)
    exportCSV(campaigns, metrics, period)
    setTimeout(() => setExporting(false), 1000)
  }

  const { label: periodLabel } = getDateRange(period)
  const totalSpend = metrics?.spend ?? campaigns.reduce((s, c) => s + c.spend, 0)
  const totalConv = metrics?.conversions ?? campaigns.reduce((s, c) => s + c.conversions, 0)
  const avgROAS = campaigns.length > 0
    ? campaigns.filter(c => c.roas > 0).reduce((s, c) => s + c.roas, 0) / (campaigns.filter(c => c.roas > 0).length || 1)
    : 0

  return (
    <div className="flex flex-col gap-6 max-w-6xl">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white">Relatórios</h1>
          <p className="text-sm text-[#71717a] mt-0.5">Resumo consolidado das campanhas com exportação</p>
        </div>
        <div className="flex items-center gap-2">
          <div className={cn(
            "flex items-center gap-1.5 px-3 h-7 rounded-full border",
            connected ? "bg-emerald-500/10 border-emerald-500/20" : "bg-amber-500/10 border-amber-500/20"
          )}>
            <div className={cn("w-1.5 h-1.5 rounded-full", connected ? "bg-emerald-400 animate-pulse" : "bg-amber-400")} />
            <span className={cn("text-xs font-medium", connected ? "text-emerald-400" : "text-amber-400")}>
              {connected ? "Dados reais" : "Sem contas"}
            </span>
          </div>
          <button onClick={fetchData}
            className="w-9 h-9 flex items-center justify-center rounded-lg border border-[var(--border)] bg-[#111118] hover:bg-[#1e1e2e] transition-colors">
            <RefreshCw className={cn("w-3.5 h-3.5 text-[#71717a]", loading && "animate-spin")} />
          </button>
          <select value={period} onChange={(e) => setPeriod(e.target.value)}
            className="h-9 px-3 rounded-lg border border-[var(--border)] bg-[#111118] text-sm text-[#f4f4f5] outline-none cursor-pointer">
            {PERIOD_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <Button onClick={handleExport} loading={exporting} size="sm" className="gap-2">
            <FileSpreadsheet className="w-4 h-4" />
            Exportar CSV
          </Button>
        </div>
      </div>

      {/* KPIs resumo */}
      {metrics ? (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: "Investimento", value: formatCurrency(metrics.spend), icon: DollarSign, color: "#6366f1" },
            { label: "Impressões", value: formatNumber(metrics.impressions), icon: Eye, color: "#8b5cf6" },
            { label: "Cliques", value: formatNumber(metrics.clicks), icon: MousePointer, color: "#06b6d4" },
            { label: "Conversões", value: formatNumber(metrics.conversions), icon: Target, color: "#10b981" },
          ].map((kpi) => (
            <Card key={kpi.label}>
              <CardContent className="p-4 flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: `${kpi.color}20` }}>
                  <kpi.icon className="w-4 h-4" style={{ color: kpi.color }} />
                </div>
                <div>
                  <p className="text-xs text-[#71717a]">{kpi.label}</p>
                  <p className="text-lg font-bold text-white">{kpi.value}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : !connected && (
        <div className="rounded-xl border border-dashed border-[#27272a] p-6 text-center">
          <FileText className="w-8 h-8 text-[#3f3f46] mx-auto mb-2" />
          <p className="text-sm text-[#71717a]">Sem contas conectadas para gerar relatório.</p>
          <a href="/dashboard/configuracoes" className="text-xs text-[#6366f1] hover:underline mt-1 inline-block">
            Conectar Meta Ads ou Google Ads →
          </a>
        </div>
      )}

      {/* Métricas por plataforma */}
      {metrics && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            { label: "Meta Ads", value: metrics.meta_spend, pct: metrics.spend > 0 ? (metrics.meta_spend / metrics.spend) * 100 : 0, color: "#1877f2" },
            { label: "Google Ads", value: metrics.google_spend, pct: metrics.spend > 0 ? (metrics.google_spend / metrics.spend) * 100 : 0, color: "#34a853" },
            { label: "ROAS Médio", value: avgROAS, pct: 0, color: "#6366f1", isRoas: true },
          ].map((p) => (
            <Card key={p.label}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-medium text-[#a1a1aa]">{p.label}</p>
                  {!("isRoas" in p) && <span className="text-xs text-[#52525b]">{p.pct.toFixed(0)}%</span>}
                </div>
                <p className="text-xl font-bold text-white">
                  {("isRoas" in p) ? `${avgROAS.toFixed(2)}x` : formatCurrency(p.value)}
                </p>
                {!("isRoas" in p) && (
                  <div className="h-1.5 bg-[#1e1e2e] rounded-full mt-2 overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${p.pct}%`, backgroundColor: p.color }} />
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Tabela de campanhas */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Campanhas — {periodLabel}</CardTitle>
              <CardDescription>
                {campaigns.length > 0 ? `${campaigns.length} campanhas encontradas` : "Nenhuma campanha no período"}
              </CardDescription>
            </div>
            {campaigns.length > 0 && (
              <Button variant="outline" size="sm" onClick={handleExport} className="gap-2">
                <Download className="w-3.5 h-3.5" />
                .CSV
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-6 flex flex-col gap-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-10 bg-[#1e1e2e] rounded animate-pulse" />
              ))}
            </div>
          ) : campaigns.length === 0 ? (
            <div className="p-10 text-center text-sm text-[#52525b]">
              {connected ? "Nenhuma campanha no período selecionado." : "Conecte suas contas para ver as campanhas."}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--border)] bg-[#0d0d14]">
                    {["#", "Campanha", "Plataforma", "Invest.", "Impressões", "Cliques", "CTR", "CPC", "Conv.", "CPA", "ROAS"].map((h) => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-[#71717a] uppercase tracking-wide whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {campaigns.map((c, i) => (
                    <tr key={c.id} className="border-b border-[var(--border)] hover:bg-[#111118] transition-colors">
                      <td className="px-4 py-3 text-xs text-[#52525b] font-mono">{i + 1}</td>
                      <td className="px-4 py-3">
                        <span className="text-xs font-medium text-white max-w-[200px] truncate block">{c.name}</span>
                        {c.account_name && <span className="text-[10px] text-[#52525b]">{c.account_name}</span>}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          <div className={cn("w-1.5 h-1.5 rounded-full", c.platform === "meta" ? "bg-blue-500" : "bg-green-500")} />
                          <span className="text-xs text-[#a1a1aa]">{c.platform === "meta" ? "Meta" : "Google"}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 font-semibold text-white text-xs">{formatCurrency(c.spend)}</td>
                      <td className="px-4 py-3 text-xs text-[#a1a1aa]">{c.impressions >= 1000 ? `${(c.impressions / 1000).toFixed(1)}k` : c.impressions}</td>
                      <td className="px-4 py-3 text-xs text-[#a1a1aa]">{c.clicks.toLocaleString("pt-BR")}</td>
                      <td className="px-4 py-3 text-xs">
                        <span className={cn("font-medium", c.ctr >= 2 ? "text-emerald-400" : "text-amber-400")}>{c.ctr.toFixed(2)}%</span>
                      </td>
                      <td className="px-4 py-3 text-xs text-[#a1a1aa]">{formatCurrency(c.cpc)}</td>
                      <td className="px-4 py-3 text-xs font-medium text-white">{Math.round(c.conversions)}</td>
                      <td className="px-4 py-3 text-xs text-[#a1a1aa]">{c.cpa > 0 ? formatCurrency(c.cpa) : "—"}</td>
                      <td className="px-4 py-3 text-xs">
                        <span className={cn("font-bold", c.roas >= 3 ? "text-emerald-400" : c.roas >= 2 ? "text-amber-400" : "text-red-400")}>
                          {c.roas > 0 ? `${c.roas.toFixed(1)}x` : "—"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
                {campaigns.length > 0 && (
                  <tfoot>
                    <tr className="border-t-2 border-[var(--border)] bg-[#0d0d14]">
                      <td className="px-4 py-3" />
                      <td className="px-4 py-3 text-xs font-bold text-white">TOTAL</td>
                      <td className="px-4 py-3" />
                      <td className="px-4 py-3 text-xs font-bold text-white">{formatCurrency(totalSpend)}</td>
                      <td className="px-4 py-3" />
                      <td className="px-4 py-3" />
                      <td className="px-4 py-3" />
                      <td className="px-4 py-3" />
                      <td className="px-4 py-3 text-xs font-bold text-white">{Math.round(totalConv)}</td>
                      <td className="px-4 py-3" />
                      <td className="px-4 py-3 text-xs font-bold text-emerald-400">{avgROAS > 0 ? `${avgROAS.toFixed(1)}x` : "—"}</td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
