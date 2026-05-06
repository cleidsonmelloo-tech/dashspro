"use client"

import { useState, useRef, useEffect } from "react"
import { Filter, X, ChevronDown, ChevronRight, Check, Loader2, Building2, Megaphone, Briefcase, LayoutGrid } from "lucide-react"
import { useFilter } from "@/lib/filter-context"
import { cn } from "@/lib/utils"

// ── Types ──────────────────────────────────────────────────────────────────────
interface BmGroup {
  bm_name: string
  platform: "meta" | "google"
  accounts: ReturnType<typeof useFilter>["accounts"]
}

export function BmCampaignFilter() {
  const {
    accounts, campaigns,
    selectedAccountIds, selectedCampaignIds,
    setSelectedAccountIds, setSelectedCampaignIds,
    loadCampaigns, clearFilter, isFiltered,
  } = useFilter()

  const [open,     setOpen]     = useState(false)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())  // account_ids expanded
  const [collapsedBMs, setCollapsedBMs] = useState<Set<string>>(new Set()) // BM groups collapsed
  const [loading,  setLoading]  = useState<Set<string>>(new Set())
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [])

  // ── Helpers ──────────────────────────────────────────────────────────────────
  function isAccountChecked(accountId: string) {
    return selectedAccountIds.length === 0 || selectedAccountIds.includes(accountId)
  }

  function toggleAccount(accountId: string) {
    if (selectedAccountIds.includes(accountId)) {
      const gone = campaigns.filter(c => c.account_id === accountId).map(c => c.id)
      setSelectedAccountIds(selectedAccountIds.filter(id => id !== accountId))
      setSelectedCampaignIds(selectedCampaignIds.filter(id => !gone.includes(id)))
    } else {
      setSelectedAccountIds([...selectedAccountIds, accountId])
    }
  }

  function toggleCampaign(campaignId: string) {
    setSelectedCampaignIds(
      selectedCampaignIds.includes(campaignId)
        ? selectedCampaignIds.filter(id => id !== campaignId)
        : [...selectedCampaignIds, campaignId]
    )
  }

  async function toggleExpand(accountId: string) {
    const next = new Set(expanded)
    if (next.has(accountId)) {
      next.delete(accountId)
    } else {
      next.add(accountId)
      if (!campaigns.some(c => c.account_id === accountId)) {
        setLoading(prev => new Set([...prev, accountId]))
        await loadCampaigns(accountId)
        setLoading(prev => { const s = new Set(prev); s.delete(accountId); return s })
      }
    }
    setExpanded(next)
  }

  function toggleBMCollapsed(key: string) {
    setCollapsedBMs(prev => {
      const s = new Set(prev)
      if (s.has(key)) s.delete(key); else s.add(key)
      return s
    })
  }

  // ── Group accounts by platform → business_manager_name ───────────────────────
  function buildGroups(platform: "meta" | "google"): BmGroup[] {
    const platformAccounts = accounts.filter(a => a.platform === platform)
    const groupMap = new Map<string, BmGroup>()

    for (const acc of platformAccounts) {
      const bmName = acc.business_manager_name || (platform === "meta" ? "Conta Pessoal" : "Google Ads")
      const key = `${platform}__${bmName}`
      if (!groupMap.has(key)) {
        groupMap.set(key, { bm_name: bmName, platform, accounts: [] })
      }
      groupMap.get(key)!.accounts.push(acc)
    }

    return Array.from(groupMap.values()).sort((a, b) => {
      // "Conta Pessoal" always last
      if (a.bm_name === "Conta Pessoal") return 1
      if (b.bm_name === "Conta Pessoal") return -1
      return a.bm_name.localeCompare(b.bm_name)
    })
  }

  const metaGroups   = buildGroups("meta")
  const googleGroups = buildGroups("google")

  // ── Button label ─────────────────────────────────────────────────────────────
  const activeAccounts  = selectedAccountIds.length
  const activeCampaigns = selectedCampaignIds.length
  const label = !isFiltered
    ? "Conta / BM / Campanha"
    : [
        activeAccounts  > 0 ? `${activeAccounts} BM${activeAccounts  > 1 ? "s" : ""}` : "",
        activeCampaigns > 0 ? `${activeCampaigns} camp.`                                : "",
      ].filter(Boolean).join(" · ")

  // ── Platform section renderer ─────────────────────────────────────────────────
  function PlatformSection({ groups, platformLabel, platformColor }: {
    groups: BmGroup[]
    platformLabel: string
    platformColor: string
  }) {
    if (groups.length === 0) return null

    return (
      <div className="mb-3">
        {/* Platform header */}
        <div className="flex items-center gap-1.5 px-2 py-1.5 mb-1">
          <LayoutGrid className="w-3 h-3 flex-shrink-0" style={{ color: platformColor }} />
          <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: platformColor }}>
            {platformLabel}
          </span>
        </div>

        {groups.map(group => {
          const bmKey = `${group.platform}__${group.bm_name}`
          const bmCollapsed = collapsedBMs.has(bmKey)

          return (
            <div key={bmKey} className="mb-1">
              {/* ── CONTA (BM / Portfolio) row ── */}
              <button
                onClick={() => toggleBMCollapsed(bmKey)}
                className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-[#1a1a27] transition-colors text-left"
              >
                <Briefcase className="w-3 h-3 flex-shrink-0" style={{ color: platformColor }} />
                <span className="flex-1 text-xs font-semibold text-[#e4e4e7] truncate">{group.bm_name}</span>
                <span className="text-[10px] text-[#52525b] flex-shrink-0 mr-1">{group.accounts.length} BM{group.accounts.length !== 1 ? "s" : ""}</span>
                {bmCollapsed
                  ? <ChevronRight className="w-3 h-3 text-[#52525b] flex-shrink-0" />
                  : <ChevronDown className="w-3 h-3 text-[#52525b] flex-shrink-0" />
                }
              </button>

              {/* ── BM (Ad Account) list inside CONTA ── */}
              {!bmCollapsed && (
                <div className="ml-5 border-l-2 pl-2.5 mb-1" style={{ borderColor: `${platformColor}30` }}>
                  {/* BM sub-label */}
                  <div className="flex items-center gap-1.5 py-1 mb-0.5">
                    <Building2 className="w-2.5 h-2.5" style={{ color: platformColor }} />
                    <span className="text-[9px] font-bold uppercase tracking-widest" style={{ color: platformColor }}>
                      BM / Conta de Anúncio
                    </span>
                  </div>

                  {group.accounts.map(acc => {
                    const accCampaigns = campaigns.filter(c => c.account_id === acc.account_id)
                    const isExpanded   = expanded.has(acc.account_id)
                    const isLoading    = loading.has(acc.account_id)
                    const checked      = isAccountChecked(acc.account_id)

                    return (
                      <div key={acc.account_id} className="mb-0.5">
                        {/* BM row */}
                        <div className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-[#1a1a27] transition-colors">
                          {/* Checkbox */}
                          <button
                            onClick={() => toggleAccount(acc.account_id)}
                            className={cn(
                              "w-4 h-4 rounded flex items-center justify-center border flex-shrink-0 transition-colors",
                              checked && selectedAccountIds.length > 0
                                ? "bg-[#6366f1] border-[#6366f1]"
                                : selectedAccountIds.length === 0
                                  ? "border-[#6366f1]/60 bg-[#6366f1]/10"
                                  : "border-[#3f3f46] hover:border-[#6366f1]/60"
                            )}
                          >
                            {checked && <Check className="w-2.5 h-2.5 text-white" />}
                          </button>

                          {/* Label */}
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium text-[#e4e4e7] truncate leading-tight">{acc.account_name}</p>
                            <p className="text-[10px] text-[#52525b] truncate">{acc.account_id}</p>
                          </div>

                          {/* Expand campaigns */}
                          <button
                            onClick={() => toggleExpand(acc.account_id)}
                            className="p-1 rounded hover:bg-[#27272a] text-[#52525b] hover:text-[#a1a1aa] transition-colors flex-shrink-0"
                            title="Ver campanhas"
                          >
                            {isLoading
                              ? <Loader2 className="w-3 h-3 animate-spin" />
                              : isExpanded
                                ? <ChevronDown className="w-3 h-3" />
                                : <ChevronRight className="w-3 h-3" />}
                          </button>
                        </div>

                        {/* ── Campaign list ── */}
                        {isExpanded && (
                          <div className="ml-7 mt-0.5 mb-1 border-l-2 pl-2.5" style={{ borderColor: `${platformColor}40` }}>
                            <div className="flex items-center gap-1.5 py-1 mb-0.5">
                              <Megaphone className="w-2.5 h-2.5" style={{ color: platformColor }} />
                              <span className="text-[9px] font-bold uppercase tracking-widest" style={{ color: platformColor }}>
                                Campanhas
                              </span>
                            </div>

                            {accCampaigns.length === 0 ? (
                              <p className="text-[10px] text-[#52525b] py-1.5 px-1">
                                {isLoading ? "Carregando..." : "Nenhuma campanha encontrada"}
                              </p>
                            ) : (
                              accCampaigns.map(camp => (
                                <button
                                  key={camp.id}
                                  onClick={() => toggleCampaign(camp.id)}
                                  className="w-full flex items-center gap-2 px-1.5 py-1.5 rounded-md hover:bg-[#1a1a27] transition-colors text-left"
                                >
                                  <div className={cn(
                                    "w-3.5 h-3.5 rounded flex items-center justify-center border flex-shrink-0 transition-colors",
                                    selectedCampaignIds.includes(camp.id)
                                      ? "bg-[#6366f1] border-[#6366f1]"
                                      : "border-[#3f3f46] hover:border-[#6366f1]/60"
                                  )}>
                                    {selectedCampaignIds.includes(camp.id) && <Check className="w-2 h-2 text-white" />}
                                  </div>
                                  <p className="text-[10px] text-[#a1a1aa] truncate leading-tight">{camp.name}</p>
                                </button>
                              ))
                            )}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </div>
    )
  }

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <div className="relative" ref={ref}>
      {/* Trigger */}
      <button
        onClick={() => setOpen(v => !v)}
        className={cn(
          "flex items-center gap-1.5 h-9 px-3 rounded-lg border text-sm transition-all",
          isFiltered
            ? "border-[#6366f1] bg-[#6366f1]/10 text-[#818cf8]"
            : "border-[var(--border)] bg-[#111118] text-[#71717a] hover:text-white hover:border-[#6366f1]/40"
        )}
      >
        <Filter className="w-3.5 h-3.5 flex-shrink-0" />
        <span className="max-w-[11rem] truncate text-xs font-medium">{label}</span>
        {isFiltered ? (
          <X
            className="w-3 h-3 flex-shrink-0 hover:text-red-400 transition-colors"
            onClick={e => { e.stopPropagation(); clearFilter() }}
          />
        ) : (
          <ChevronDown className={cn("w-3 h-3 flex-shrink-0 transition-transform", open && "rotate-180")} />
        )}
      </button>

      {/* Dropdown */}
      {open && (
        <div
          className="absolute right-0 top-full mt-1.5 bg-[#0f0f18] border border-[var(--border)] rounded-xl shadow-2xl z-50 overflow-hidden"
          style={{ width: "22rem" }}
        >
          {/* Header */}
          <div className="px-4 py-3 border-b border-[var(--border)] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Filter className="w-3.5 h-3.5 text-[#6366f1]" />
              <span className="text-xs font-bold text-white uppercase tracking-wider">
                Conta / BM / Campanha
              </span>
            </div>
            {isFiltered && (
              <button onClick={clearFilter}
                className="text-[10px] font-medium text-[#6366f1] hover:text-[#818cf8] transition-colors whitespace-nowrap ml-2">
                Limpar
              </button>
            )}
          </div>

          {/* Hierarchy legend */}
          <div className="px-4 py-2 bg-[#0a0a12] border-b border-[var(--border)] flex items-center gap-3 text-[9px] text-[#52525b] uppercase tracking-widest">
            <span className="flex items-center gap-1"><Briefcase className="w-2.5 h-2.5" /> Conta</span>
            <span className="text-[#27272a]">›</span>
            <span className="flex items-center gap-1"><Building2 className="w-2.5 h-2.5" /> BM</span>
            <span className="text-[#27272a]">›</span>
            <span className="flex items-center gap-1"><Megaphone className="w-2.5 h-2.5" /> Campanha</span>
          </div>

          {/* List */}
          <div className="max-h-96 overflow-y-auto p-2">
            {accounts.length === 0 ? (
              <div className="flex flex-col items-center gap-1 py-6 text-[#52525b]">
                <Filter className="w-5 h-5 opacity-40" />
                <p className="text-xs">Nenhuma conta conectada</p>
              </div>
            ) : (
              <>
                <PlatformSection groups={metaGroups}   platformLabel="Meta Ads"   platformColor="#1877f2" />
                <PlatformSection groups={googleGroups} platformLabel="Google Ads" platformColor="#34a853" />
              </>
            )}
          </div>

          {/* Footer */}
          <div className="px-3 py-2.5 border-t border-[var(--border)]">
            <button
              onClick={() => setOpen(false)}
              className="w-full h-8 bg-[#6366f1] hover:bg-[#5558dd] text-white text-xs font-semibold rounded-lg transition-colors cursor-pointer"
            >
              {isFiltered ? "Aplicar filtros" : "Fechar"}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
