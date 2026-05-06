"use client"

import { useState, useEffect, useCallback } from "react"
import { Search, DollarSign, MousePointer, Eye, Target, Tag, RefreshCw, Loader2 } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { formatCurrency, formatNumber, formatPercent, cn } from "@/lib/utils"

interface Campaign {
  id: string; name: string; platform: "meta" | "google"; account_name?: string
  status: string; spend: number; impressions: number; clicks: number
  ctr: number; cpc: number; conversions: number; cpa: number; roas: number
}

const MOCK_CAMPAIGNS: Campaign[] = [
  { id: "1", name: "[VENDAS] [LP] [F] [CBO] Campanha Principal", platform: "meta", status: "active", spend: 4820, impressions: 98400, clicks: 2840, ctr: 2.89, cpc: 1.70, conversions: 244, cpa: 19.75, roas: 4.2 },
  { id: "2", name: "[LEADS] [WPP] [F] [ABO] Remarketing 7d", platform: "meta", status: "active", spend: 1940, impressions: 42100, clicks: 1120, ctr: 2.66, cpc: 1.73, conversions: 89, cpa: 21.80, roas: 2.8 },
  { id: "3", name: "[TRÁFEGO] [BLOG] [C] [CBO] Topo Funil", platform: "meta", status: "paused", spend: 880, impressions: 65200, clicks: 980, ctr: 1.50, cpc: 0.90, conversions: 12, cpa: 73.33, roas: 0.9 },
  { id: "4", name: "Search - Comprar [produto] - Exato", platform: "google", status: "active", spend: 2840, impressions: 18400, clicks: 1420, ctr: 7.72, cpc: 2.00, conversions: 128, cpa: 22.19, roas: 3.6 },
  { id: "5", name: "Search - [produto] preço - Frase", platform: "google", status: "active", spend: 1680, impressions: 24100, clicks: 820, ctr: 3.40, cpc: 2.05, conversions: 76, cpa: 22.11, roas: 3.2 },
  { id: "6", name: "[VENDAS] [INST_REELS] [F] [CBO] 3", platform: "meta", status: "ended", spend: 2120, impressions: 73000, clicks: 1580, ctr: 2.16, cpc: 1.34, conversions: 98, cpa: 21.63, roas: 3.1 },
]

const STATUS_MAP: Record<string, { label: string; variant: "success" | "warning" | "outline" }> = {
  active: { label: "Ativa", variant: "success" },
  enabled: { label: "Ativa", variant: "success" },
  paused: { label: "Pausada", variant: "warning" },
  campaign_paused: { label: "Pausada", variant: "warning" },
  adset_paused: { label: "Pausada", variant: "warning" },
  ended: { label: "Encerrada", variant: "outline" },
  deleted: { label: "Deletada", variant: "outline" },
  archived: { label: "Arquivada", variant: "outline" },
  removed: { label: "Removida", variant: "outline" },
  with_issues: { label: "Com problemas", variant: "warning" },
  in_process: { label: "Em processo", variant: "warning" },
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

export default function CampanhasPage() {
  const [search, setSearch] = useState("")
  const [platform, setPlatform] = useState<"all" | "meta" | "google">("all")
  const [period, setPeriod] = useState("30d")
  const [campaigns, setCampaigns] = useState<Campaign[]>(MOCK_CAMPAIGNS)
  const [loading, setLoading] = useState(false)
  const [isRealData, setIsRealData] = useState(false)

  const fetchCampaigns = useCallback(async () => {
    setLoading(true)
    try {
      const { since, until } = getDateRange(period)
      const [metaRes, googleRes] = await Promise.all([
        fetch(`/api/meta/campaigns?since=${since}&until=${until}`),
        fetch(`/api/google/campaigns?since=${since}&until=${until}`),
      ])
      const meta = metaRes.ok ? await metaRes.json() : { campaigns: [], connected: false }
      const google = googleRes.ok ? await googleRes.json() : { campaigns: [], connected: false }
      const all = [...(meta.campaigns || []), ...(google.campaigns || [])]
      if (all.length > 0) {
        setCampaigns(all)
        setIsRealData(true)
      } else {
        setCampaigns(MOCK_CAMPAIGNS)
        setIsRealData(false)
      }
    } catch {
      setCampaigns(MOCK_CAMPAIGNS)
      setIsRealData(false)
    } finally {
      setLoading(false)
    }
  }, [period])

  useEffect(() => { fetchCampaigns() }, [fetchCampaigns])

  const filtered = campaigns
    .filter((c) => platform === "all" || c.platform === platform)
    .filter((c) => c.name.toLowerCase().includes(search.toLowerCase()))

  const totals = filtered.reduce((acc, c) => ({
    spend: acc.spend + c.spend,
    impressions: acc.impressions + c.impressions,
    clicks: acc.clicks + c.clicks,
    conversions: acc.conversions + c.conversions,
  }), { spend: 0, impressions: 0, clicks: 0, conversions: 0 })

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Campanhas</h1>
          <p className="text-sm text-[#71717a] mt-0.5">Acompanhe todas as suas campanhas ativas</p>
        </div>
        <div className="flex items-center gap-2">
          <div className={`flex items-center gap-1.5 px-3 h-7 rounded-full border ${isRealData ? "bg-emerald-500/10 border-emerald-500/20" : "bg-amber-500/10 border-amber-500/20"}`}>
            <div className={`w-1.5 h-1.5 rounded-full ${isRealData ? "bg-emerald-400 animate-pulse" : "bg-amber-400"}`} />
            <span className={`text-xs font-medium ${isRealData ? "text-emerald-400" : "text-amber-400"}`}>{isRealData ? "Dados reais" : "Demo"}</span>
          </div>
          <button onClick={fetchCampaigns} className="w-9 h-9 flex items-center justify-center rounded-lg border border-[var(--border)] bg-[#111118] hover:bg-[#1e1e2e] transition-colors">
            <RefreshCw className={`w-3.5 h-3.5 text-[#71717a] ${loading ? "animate-spin" : ""}`} />
          </button>
          <select value={period} onChange={(e) => setPeriod(e.target.value)}
            className="h-9 px-3 rounded-lg border border-[var(--border)] bg-[#111118] text-sm text-[#f4f4f5] outline-none cursor-pointer">
            {PERIOD_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
      </div>

      {/* KPI totais */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Investimento", value: formatCurrency(totals.spend), icon: DollarSign, color: "#6366f1" },
          { label: "Impressões", value: formatNumber(totals.impressions), icon: Eye, color: "#8b5cf6" },
          { label: "Cliques", value: formatNumber(totals.clicks), icon: MousePointer, color: "#06b6d4" },
          { label: "Conversões", value: formatNumber(totals.conversions), icon: Target, color: "#10b981" },
        ].map((kpi) => (
          <Card key={kpi.label}>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: `${kpi.color}20` }}>
                <kpi.icon className="w-4 h-4" style={{ color: kpi.color }} />
              </div>
              <div>
                <p className="text-xs text-[#71717a]">{kpi.label}</p>
                {loading ? <div className="h-5 w-16 bg-[#1e1e2e] rounded animate-pulse mt-1" /> : <p className="text-lg font-bold text-white">{kpi.value}</p>}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-3">
        <div className="flex-1 min-w-48">
          <Input placeholder="Buscar campanha..." value={search} onChange={(e) => setSearch(e.target.value)} leftIcon={<Search className="w-4 h-4" />} />
        </div>
        <div className="flex gap-1 p-1 bg-[#111118] border border-[var(--border)] rounded-lg">
          {(["all", "meta", "google"] as const).map((p) => (
            <button key={p} onClick={() => setPlatform(p)}
              className={cn("px-3 py-1.5 rounded-md text-xs font-medium transition-all cursor-pointer", platform === p ? "bg-[#6366f1] text-white" : "text-[#71717a] hover:text-white")}>
              {p === "all" ? "Todos" : p === "meta" ? "Meta Ads" : "Google Ads"}
            </button>
          ))}
        </div>
      </div>

      {/* Tabela */}
      <Card className="overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--border)] bg-[#0d0d14]">
                {["Campanha", "Status", "Investimento", "Impressões", "CTR", "CPC", "Conversões", "CPA", "ROAS"].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-[#71717a] uppercase tracking-wide whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="border-b border-[var(--border)]">
                    {Array.from({ length: 9 }).map((_, j) => (
                      <td key={j} className="px-4 py-3">
                        <div className="h-4 bg-[#1e1e2e] rounded animate-pulse" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-10 text-center text-sm text-[#52525b]">
                    Nenhuma campanha encontrada.
                  </td>
                </tr>
              ) : (
                filtered.map((c) => {
                  const status = STATUS_MAP[c.status] || { label: c.status, variant: "outline" as const }
                  return (
                    <tr key={c.id} className="border-b border-[var(--border)] hover:bg-[#111118] transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className={cn("w-1.5 h-1.5 rounded-full flex-shrink-0", c.platform === "meta" ? "bg-blue-500" : "bg-green-500")} />
                          <span className="font-medium text-white text-xs max-w-[220px] truncate">{c.name}</span>
                        </div>
                        {c.account_name && (
                          <div className="flex items-center gap-1 ml-3.5 mt-0.5">
                            <Tag className="w-3 h-3 text-[#52525b]" />
                            <span className="text-[10px] text-[#52525b] truncate max-w-[200px]">{c.account_name}</span>
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={status.variant}>{status.label}</Badge>
                      </td>
                      <td className="px-4 py-3 font-semibold text-white">{formatCurrency(c.spend)}</td>
                      <td className="px-4 py-3 text-[#a1a1aa]">{c.impressions >= 1000 ? `${(c.impressions / 1000).toFixed(1)}k` : c.impressions}</td>
                      <td className="px-4 py-3">
                        <span className={cn("font-medium", c.ctr >= 2 ? "text-emerald-400" : "text-amber-400")}>{c.ctr.toFixed(2)}%</span>
                      </td>
                      <td className="px-4 py-3 text-[#a1a1aa]">{formatCurrency(c.cpc)}</td>
                      <td className="px-4 py-3 font-medium text-white">{Math.round(c.conversions)}</td>
                      <td className="px-4 py-3 text-[#a1a1aa]">{c.cpa > 0 ? formatCurrency(c.cpa) : "—"}</td>
                      <td className="px-4 py-3">
                        <span className={cn("font-bold", c.roas >= 3 ? "text-emerald-400" : c.roas >= 2 ? "text-amber-400" : "text-red-400")}>
                          {c.roas > 0 ? `${c.roas.toFixed(1)}x` : "—"}
                        </span>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}
