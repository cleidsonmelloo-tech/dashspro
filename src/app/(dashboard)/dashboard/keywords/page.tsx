"use client"

import { useState, useEffect, useCallback } from "react"
import { Search, DollarSign, Target, MousePointer, TrendingUp, RefreshCw } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { formatCurrency, cn } from "@/lib/utils"
import { BmCampaignFilter } from "@/components/ui/bm-campaign-filter"
import { DateRangePicker, DateRange } from "@/components/ui/date-range-picker"
import { PlatformPills } from "@/components/ui/platform-pills"
import { useFilter } from "@/lib/filter-context"

interface Keyword {
  id: string; keyword: string; matchType: string; campaign?: string
  impressions: number; clicks: number; ctr: number; cpc: number
  conversions: number; cpa: number; spend: number; qualityScore: number
}

const MOCK_KEYWORDS: Keyword[] = [
  { id: "1", keyword: "comprar [produto]", matchType: "EXACT", impressions: 4820, clicks: 680, ctr: 14.1, cpc: 1.76, conversions: 48, cpa: 24.93, spend: 1197, qualityScore: 9 },
  { id: "2", keyword: "[produto] preço", matchType: "PHRASE", impressions: 6240, clicks: 520, ctr: 8.33, cpc: 2.10, conversions: 32, cpa: 34.13, spend: 1092, qualityScore: 7 },
  { id: "3", keyword: "melhor [produto]", matchType: "BROAD", impressions: 12400, clicks: 380, ctr: 3.06, cpc: 3.42, conversions: 18, cpa: 72.15, spend: 1299, qualityScore: 5 },
  { id: "4", keyword: "[produto] online", matchType: "EXACT", impressions: 3100, clicks: 290, ctr: 9.35, cpc: 1.95, conversions: 24, cpa: 23.56, spend: 566, qualityScore: 8 },
  { id: "5", keyword: "[produto] barato", matchType: "PHRASE", impressions: 8900, clicks: 210, ctr: 2.36, cpc: 4.20, conversions: 8, cpa: 110.25, spend: 882, qualityScore: 4 },
  { id: "6", keyword: "como usar [produto]", matchType: "BROAD", impressions: 5600, clicks: 180, ctr: 3.21, cpc: 2.85, conversions: 6, cpa: 85.50, spend: 513, qualityScore: 6 },
  { id: "7", keyword: "[produto] entrega rápida", matchType: "EXACT", impressions: 2400, clicks: 320, ctr: 13.33, cpc: 1.62, conversions: 28, cpa: 18.51, spend: 518, qualityScore: 10 },
  { id: "8", keyword: "[produto] original", matchType: "PHRASE", impressions: 3800, clicks: 240, ctr: 6.32, cpc: 2.28, conversions: 20, cpa: 27.36, spend: 547, qualityScore: 8 },
]

const MATCH_TYPE_CONFIG: Record<string, { label: string; color: string }> = {
  EXACT: { label: "[Exato]", color: "#10b981" },
  PHRASE: { label: '"Frase"', color: "#f59e0b" },
  BROAD: { label: "Ampla", color: "#FF5F1A" },
  exact: { label: "[Exato]", color: "#10b981" },
  phrase: { label: '"Frase"', color: "#f59e0b" },
  broad: { label: "Ampla", color: "#FF5F1A" },
}

function QualityScore({ score }: { score: number }) {
  const color = score >= 8 ? "#10b981" : score >= 6 ? "#f59e0b" : "#ef4444"
  return (
    <div className="flex items-center gap-1.5">
      <div className="flex gap-0.5">
        {Array.from({ length: 10 }).map((_, i) => (
          <div key={i} className="w-1.5 h-3 rounded-sm" style={{ backgroundColor: i < score ? color : "#2a1f15" }} />
        ))}
      </div>
      <span className="text-xs font-bold" style={{ color }}>{score > 0 ? `${score}/10` : "—"}</span>
    </div>
  )
}

export default function KeywordsPage() {
  const { filterParam } = useFilter()
  const [search, setSearch] = useState("")
  const [matchFilter, setMatchFilter] = useState<"all" | "EXACT" | "PHRASE" | "BROAD">("all")
  const [sortBy, setSortBy] = useState<"conversions" | "ctr" | "spend" | "cpa">("conversions")
  const [dateRange, setDateRange] = useState<DateRange>(() => {
    const d = new Date(); const until = d.toISOString().split("T")[0]
    d.setDate(d.getDate() - 30); const since = d.toISOString().split("T")[0]
    return { since, until }
  })
  const [keywords, setKeywords] = useState<Keyword[]>(MOCK_KEYWORDS)
  const [loading, setLoading] = useState(false)
  const [isRealData, setIsRealData] = useState(false)

  const fetchKeywords = useCallback(async () => {
    setLoading(true)
    try {
      const { since, until } = dateRange
      const res = await fetch(`/api/google/keywords?since=${since}&until=${until}${filterParam}`)
      const data = res.ok ? await res.json() : { keywords: [], connected: false }
      if (data.connected && data.keywords?.length > 0) {
        setKeywords(data.keywords)
        setIsRealData(true)
      } else {
        setKeywords(MOCK_KEYWORDS)
        setIsRealData(false)
      }
    } catch {
      setKeywords(MOCK_KEYWORDS)
      setIsRealData(false)
    } finally {
      setLoading(false)
    }
  }, [dateRange, filterParam])

  useEffect(() => { fetchKeywords() }, [fetchKeywords])

  const filtered = keywords
    .filter((k) => matchFilter === "all" || k.matchType === matchFilter)
    .filter((k) => k.keyword.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => sortBy === "cpa" ? (a.cpa || 999) - (b.cpa || 999) : b[sortBy] - a[sortBy])

  const totals = filtered.reduce((acc, k) => ({
    spend: acc.spend + k.spend, clicks: acc.clicks + k.clicks,
    conversions: acc.conversions + k.conversions, impressions: acc.impressions + k.impressions,
  }), { spend: 0, clicks: 0, conversions: 0, impressions: 0 })

  const avgCTR = filtered.reduce((s, k) => s + k.ctr, 0) / (filtered.length || 1)
  const avgCPA = totals.spend / (totals.conversions || 1)

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Keywords Google Ads</h1>
          <p className="text-sm text-[#71717a] mt-0.5">Palavras-chave com melhor performance e conversões</p>
        </div>
        <div className="flex items-center gap-2">
          <div className={`flex items-center gap-1.5 px-3 h-7 rounded-full border ${isRealData ? "bg-emerald-500/10 border-emerald-500/20" : "bg-amber-500/10 border-amber-500/20"}`}>
            <div className={`w-1.5 h-1.5 rounded-full ${isRealData ? "bg-emerald-400 animate-pulse" : "bg-amber-400"}`} />
            <span className={`text-xs font-medium ${isRealData ? "text-emerald-400" : "text-amber-400"}`}>{isRealData ? "Dados reais" : "Demo"}</span>
          </div>
          <PlatformPills value={[]} onChange={() => {}} fixed="google" />
          <BmCampaignFilter />
          <button onClick={fetchKeywords} className="w-9 h-9 flex items-center justify-center rounded-lg border border-[var(--border)] bg-[#131313] hover:bg-[#1a1410] transition-colors">
            <RefreshCw className={`w-3.5 h-3.5 text-[#71717a] ${loading ? "animate-spin" : ""}`} />
          </button>
          <DateRangePicker value={dateRange} onChange={setDateRange} />
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Investimento", value: formatCurrency(totals.spend), icon: DollarSign, color: "#FF5F1A" },
          { label: "CTR Médio", value: `${avgCTR.toFixed(2)}%`, icon: TrendingUp, color: "#10b981" },
          { label: "CPA Médio", value: formatCurrency(avgCPA), icon: Target, color: "#f59e0b" },
          { label: "Conversões", value: Math.round(totals.conversions).toString(), icon: MousePointer, color: "#06b6d4" },
        ].map((kpi) => (
          <Card key={kpi.label}>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${kpi.color}20` }}>
                <kpi.icon className="w-4 h-4" style={{ color: kpi.color }} />
              </div>
              <div>
                <p className="text-xs text-[#71717a]">{kpi.label}</p>
                {loading ? <div className="h-5 w-16 bg-[#1a1410] rounded animate-pulse mt-1" /> : <p className="text-lg font-bold text-white">{kpi.value}</p>}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-3">
        <div className="flex-1 min-w-48">
          <Input placeholder="Buscar keyword..." value={search} onChange={(e) => setSearch(e.target.value)} leftIcon={<Search className="w-4 h-4" />} />
        </div>
        <div className="flex gap-1 p-1 bg-[#131313] border border-[var(--border)] rounded-lg">
          {(["all", "EXACT", "PHRASE", "BROAD"] as const).map((m) => (
            <button key={m} onClick={() => setMatchFilter(m)}
              className={cn("px-3 py-1.5 rounded-md text-xs font-medium transition-all cursor-pointer", matchFilter === m ? "bg-[#FF5F1A] text-white" : "text-[#71717a] hover:text-white")}>
              {m === "all" ? "Todos" : m === "EXACT" ? "[Exato]" : m === "PHRASE" ? '"Frase"' : "Ampla"}
            </button>
          ))}
        </div>
        <select value={sortBy} onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
          className="h-9 px-3 rounded-lg border border-[var(--border)] bg-[#131313] text-xs text-[#f4f4f5] outline-none cursor-pointer">
          <option value="conversions">Ordenar: Conversões</option>
          <option value="ctr">Ordenar: CTR</option>
          <option value="spend">Ordenar: Gasto</option>
          <option value="cpa">Ordenar: CPA (menor)</option>
        </select>
      </div>

      {/* Tabela */}
      <Card className="overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--border)] bg-[#0f0f0f]">
                {["Keyword", "Tipo", "Quality Score", "Impressões", "CTR", "CPC", "Conversões", "CPA"].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-[#71717a] uppercase tracking-wide whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i} className="border-b border-[var(--border)]">
                    {Array.from({ length: 8 }).map((_, j) => (
                      <td key={j} className="px-4 py-3"><div className="h-4 bg-[#1a1410] rounded animate-pulse" /></td>
                    ))}
                  </tr>
                ))
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-sm text-[#52525b]">Nenhuma keyword encontrada.</td>
                </tr>
              ) : (
                filtered.map((k) => {
                  const mt = MATCH_TYPE_CONFIG[k.matchType] || { label: k.matchType, color: "#FF5F1A" }
                  return (
                    <tr key={k.id} className="border-b border-[var(--border)] hover:bg-[#131313] transition-colors">
                      <td className="px-4 py-3">
                        <span className="font-medium text-white text-xs block max-w-[200px] truncate">{k.keyword}</span>
                        {k.campaign && <span className="text-[10px] text-[#52525b] block truncate max-w-[200px]">{k.campaign}</span>}
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs font-mono font-semibold" style={{ color: mt.color }}>{mt.label}</span>
                      </td>
                      <td className="px-4 py-3"><QualityScore score={k.qualityScore} /></td>
                      <td className="px-4 py-3 text-[#a1a1aa]">{k.impressions.toLocaleString("pt-BR")}</td>
                      <td className="px-4 py-3">
                        <span className={cn("font-medium", k.ctr >= 5 ? "text-emerald-400" : k.ctr >= 3 ? "text-amber-400" : "text-red-400")}>
                          {k.ctr.toFixed(2)}%
                        </span>
                      </td>
                      <td className="px-4 py-3 text-[#a1a1aa]">{formatCurrency(k.cpc)}</td>
                      <td className="px-4 py-3 font-bold text-white">{Math.round(k.conversions)}</td>
                      <td className="px-4 py-3">
                        <span className={cn("font-medium", k.cpa <= 30 ? "text-emerald-400" : k.cpa <= 60 ? "text-amber-400" : "text-red-400")}>
                          {k.cpa > 0 ? formatCurrency(k.cpa) : "—"}
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
