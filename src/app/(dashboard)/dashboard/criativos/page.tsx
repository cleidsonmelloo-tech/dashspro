"use client"

import { useState, useEffect, useCallback } from "react"
import { Search, TrendingUp, MousePointer, Eye, DollarSign, ImageIcon, RefreshCw } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { formatCurrency, cn } from "@/lib/utils"
import { BmCampaignFilter } from "@/components/ui/bm-campaign-filter"
import { DateRangePicker, DateRange } from "@/components/ui/date-range-picker"
import { PlatformPills, matchesPlatform } from "@/components/ui/platform-pills"
import { useFilter } from "@/lib/filter-context"

interface Creative {
  id: string; name: string; thumbnail_url?: string | null
  campaign?: string; adset?: string
  platform: "meta" | "google"; account_name?: string
  status: string; spend: number; impressions: number
  clicks: number; ctr: number; cpc: number; conversions: number; cpa: number
}

const MOCK_CREATIVES: Creative[] = [
  { id: "1", name: "AD01 - Depoimento João [V1]", platform: "meta", status: "active", impressions: 48200, clicks: 1840, ctr: 3.82, cpc: 1.54, spend: 2840, conversions: 144, cpa: 19.73 },
  { id: "2", name: "AD02 - Oferta Especial [IMG]", platform: "meta", status: "active", impressions: 35100, clicks: 980, ctr: 2.79, cpc: 1.96, spend: 1920, conversions: 73, cpa: 26.30 },
  { id: "3", name: "AD03 - Carrossel Produto", platform: "meta", status: "active", impressions: 29800, clicks: 1120, ctr: 3.76, cpc: 1.46, spend: 1640, conversions: 74, cpa: 22.16 },
  { id: "4", name: "AD04 - Reels Stories [V2]", platform: "meta", status: "paused", impressions: 61400, clicks: 890, ctr: 1.45, cpc: 2.36, spend: 2100, conversions: 50, cpa: 42.00 },
  { id: "5", name: "AD05 - Urgência Black [IMG]", platform: "meta", status: "active", impressions: 18900, clicks: 720, ctr: 3.81, cpc: 1.36, spend: 980, conversions: 65, cpa: 15.08 },
  { id: "6", name: "Search - Comprar [KW]", platform: "google", status: "active", impressions: 12400, clicks: 680, ctr: 5.48, cpc: 1.76, spend: 1200, conversions: 100, cpa: 12.00 },
]

function CreativeCard({ creative, rank, loading }: { creative: Creative; rank: number; loading?: boolean }) {
  const isGood = creative.ctr >= 3.0
  const platformColor = creative.platform === "meta" ? "#1877f2" : "#34a853"
  const platformLabel = creative.platform === "meta" ? "Meta" : "Google"
  const isPaused = creative.status === "paused"

  if (loading) {
    return (
      <Card>
        <CardContent className="p-4">
          <div className="w-full h-32 rounded-lg bg-[#1e1e2e] mb-3 animate-pulse" />
          <div className="h-4 bg-[#1e1e2e] rounded mb-3 animate-pulse" />
          <div className="grid grid-cols-2 gap-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-14 bg-[#1e1e2e] rounded-lg animate-pulse" />
            ))}
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className={cn("relative transition-all hover:border-[#6366f1]/40", isPaused && "opacity-60")}>
      <div className="absolute -top-2.5 -left-2.5 w-7 h-7 rounded-full bg-[#6366f1] flex items-center justify-center text-xs font-bold text-white shadow-lg z-10">
        {rank}
      </div>
      <CardContent className="p-4">
        <div className="w-full h-32 rounded-lg bg-[#1e1e2e] mb-3 flex items-center justify-center overflow-hidden relative">
          {creative.thumbnail_url
            ? <img src={creative.thumbnail_url} alt={creative.name} className="w-full h-full object-cover" />
            : <div className="flex flex-col items-center gap-1 text-[#3f3f46]"><ImageIcon className="w-8 h-8" /></div>
          }
          <div className="absolute top-2 right-2 px-2 py-0.5 rounded-full text-[10px] font-bold text-white" style={{ backgroundColor: platformColor }}>
            {platformLabel}
          </div>
          {isPaused && (
            <div className="absolute inset-0 bg-black/40 flex items-center justify-center rounded-lg">
              <Badge variant="warning">Pausado</Badge>
            </div>
          )}
        </div>

        <p className="text-xs font-medium text-[#a1a1aa] line-clamp-2 mb-3 leading-relaxed">{creative.name}</p>
        {creative.campaign && (
          <p className="text-[10px] text-[#52525b] truncate mb-2">{creative.campaign}</p>
        )}

        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-lg bg-[#0d0d14] p-2.5">
            <div className="flex items-center gap-1 mb-1">
              <TrendingUp className="w-3 h-3 text-[#71717a]" />
              <span className="text-[10px] text-[#71717a]">CTR</span>
            </div>
            <p className={cn("text-sm font-bold", isGood ? "text-emerald-400" : "text-amber-400")}>{creative.ctr.toFixed(2)}%</p>
          </div>
          <div className="rounded-lg bg-[#0d0d14] p-2.5">
            <div className="flex items-center gap-1 mb-1">
              <DollarSign className="w-3 h-3 text-[#71717a]" />
              <span className="text-[10px] text-[#71717a]">CPA</span>
            </div>
            <p className="text-sm font-bold text-white">{creative.cpa > 0 ? formatCurrency(creative.cpa) : "—"}</p>
          </div>
          <div className="rounded-lg bg-[#0d0d14] p-2.5">
            <div className="flex items-center gap-1 mb-1">
              <Eye className="w-3 h-3 text-[#71717a]" />
              <span className="text-[10px] text-[#71717a]">Impressões</span>
            </div>
            <p className="text-sm font-bold text-white">{creative.impressions >= 1000 ? `${(creative.impressions / 1000).toFixed(1)}k` : creative.impressions}</p>
          </div>
          <div className="rounded-lg bg-[#0d0d14] p-2.5">
            <div className="flex items-center gap-1 mb-1">
              <MousePointer className="w-3 h-3 text-[#71717a]" />
              <span className="text-[10px] text-[#71717a]">Conversões</span>
            </div>
            <p className="text-sm font-bold text-emerald-400">{Math.round(creative.conversions)}</p>
          </div>
        </div>

        <div className="mt-3 pt-3 border-t border-[var(--border)] flex items-center justify-between">
          <span className="text-xs text-[#71717a]">Investimento</span>
          <span className="text-sm font-semibold text-[#a1a1aa]">{formatCurrency(creative.spend)}</span>
        </div>
      </CardContent>
    </Card>
  )
}

export default function CriativosPage() {
  const { filterParam } = useFilter()
  const [search, setSearch] = useState("")
  const [platform, setPlatform] = useState<string[]>([])
  const [sortBy, setSortBy] = useState<"ctr" | "conversions" | "spend">("ctr")
  const [dateRange, setDateRange] = useState<DateRange>(() => {
    const d = new Date(); const until = d.toISOString().split("T")[0]
    d.setDate(d.getDate() - 30); const since = d.toISOString().split("T")[0]
    return { since, until }
  })
  const [creatives, setCreatives] = useState<Creative[]>(MOCK_CREATIVES)
  const [loading, setLoading] = useState(false)
  const [isRealData, setIsRealData] = useState(false)

  const fetchCreatives = useCallback(async () => {
    setLoading(true)
    try {
      const { since, until } = dateRange
      const res = await fetch(`/api/meta/creatives?since=${since}&until=${until}${filterParam}`)
      const data = res.ok ? await res.json() : { creatives: [], connected: false }
      if (data.connected && data.creatives?.length > 0) {
        setCreatives(data.creatives)
        setIsRealData(true)
      } else {
        setCreatives(MOCK_CREATIVES)
        setIsRealData(false)
      }
    } catch {
      setCreatives(MOCK_CREATIVES)
      setIsRealData(false)
    } finally {
      setLoading(false)
    }
  }, [dateRange, filterParam])

  useEffect(() => { fetchCreatives() }, [fetchCreatives])

  const filtered = creatives
    .filter((c) => matchesPlatform(c.platform, platform))
    .filter((c) => c.name.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => b[sortBy] - a[sortBy])

  const totalSpend = filtered.reduce((s, c) => s + c.spend, 0)
  const avgCTR = filtered.reduce((s, c) => s + c.ctr, 0) / (filtered.length || 1)
  const totalConversions = filtered.reduce((s, c) => s + c.conversions, 0)

  return (
    <div className="flex flex-col gap-6">
      {/* ── Header ── */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Criativos</h1>
          <p className="text-sm text-[#71717a] mt-0.5">Performance dos seus anúncios por visual</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Status */}
          <div className={`flex items-center gap-1.5 px-3 h-7 rounded-full border ${isRealData ? "bg-emerald-500/10 border-emerald-500/20" : "bg-amber-500/10 border-amber-500/20"}`}>
            <div className={`w-1.5 h-1.5 rounded-full ${isRealData ? "bg-emerald-400 animate-pulse" : "bg-amber-400"}`} />
            <span className={`text-xs font-medium ${isRealData ? "text-emerald-400" : "text-amber-400"}`}>{isRealData ? "Dados reais" : "Demo"}</span>
          </div>

          <PlatformPills value={platform} onChange={setPlatform} />
          <BmCampaignFilter />

          {/* Refresh */}
          <button onClick={fetchCreatives} className="w-9 h-9 flex items-center justify-center rounded-lg border border-[var(--border)] bg-[#111118] hover:bg-[#1e1e2e] transition-colors">
            <RefreshCw className={`w-3.5 h-3.5 text-[#71717a] ${loading ? "animate-spin" : ""}`} />
          </button>

          {/* Period */}
          <DateRangePicker value={dateRange} onChange={setDateRange} />
        </div>
      </div>

      {/* ── KPIs ── */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Investimento Total", value: formatCurrency(totalSpend),                          icon: DollarSign, color: "#6366f1" },
          { label: "CTR Médio",          value: `${avgCTR.toFixed(2)}%`,                             icon: TrendingUp, color: "#10b981" },
          { label: "Total Conversões",   value: Math.round(totalConversions).toLocaleString("pt-BR"), icon: MousePointer, color: "#f59e0b" },
        ].map((kpi) => (
          <Card key={kpi.label}>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: `${kpi.color}20` }}>
                <kpi.icon className="w-4 h-4" style={{ color: kpi.color }} />
              </div>
              <div>
                <p className="text-xs text-[#71717a]">{kpi.label}</p>
                {loading
                  ? <div className="h-5 w-16 bg-[#1e1e2e] rounded animate-pulse mt-1" />
                  : <p className="text-lg font-bold text-white">{kpi.value}</p>}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* ── Search + sort ── */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex-1 min-w-48">
          <Input placeholder="Buscar criativo..." value={search}
            onChange={(e) => setSearch(e.target.value)}
            leftIcon={<Search className="w-4 h-4" />} />
        </div>
        <select value={sortBy} onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
          className="h-9 px-3 rounded-lg border border-[var(--border)] bg-[#111118] text-xs text-[#f4f4f5] outline-none cursor-pointer">
          <option value="ctr">Ordenar: CTR</option>
          <option value="conversions">Ordenar: Conversões</option>
          <option value="spend">Ordenar: Investimento</option>
        </select>
      </div>

      {/* Grid */}
      {loading ? (
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <CreativeCard key={i} creative={MOCK_CREATIVES[0]} rank={i + 1} loading />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[var(--border)] p-10 text-center text-sm text-[#52525b]">
          Nenhum criativo encontrado.
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-6">
          {filtered.map((creative, i) => (
            <CreativeCard key={creative.id} creative={creative} rank={i + 1} />
          ))}
        </div>
      )}
    </div>
  )
}
