"use client"

import { useState, useRef, useEffect } from "react"
import { Filter, X, ChevronDown, ChevronRight, Check, Loader2 } from "lucide-react"
import { useFilter } from "@/lib/filter-context"
import { cn } from "@/lib/utils"

export function BmCampaignFilter() {
  const {
    accounts, campaigns,
    selectedAccountIds, selectedCampaignIds,
    setSelectedAccountIds, setSelectedCampaignIds,
    loadCampaigns, clearFilter, isFiltered,
  } = useFilter()

  const [open, setOpen] = useState(false)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState<Set<string>>(new Set())
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [])

  function toggleAccount(accountId: string) {
    if (selectedAccountIds.includes(accountId)) {
      // deselect: also remove its campaigns
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
      const hasCampaigns = campaigns.some(c => c.account_id === accountId)
      if (!hasCampaigns) {
        setLoading(prev => new Set([...prev, accountId]))
        await loadCampaigns(accountId)
        setLoading(prev => { const s = new Set(prev); s.delete(accountId); return s })
      }
    }
    setExpanded(next)
  }

  // Decide if an account checkbox is checked
  // When selectedAccountIds is empty → all selected (indeterminate / "all" mode)
  function isAccountChecked(accountId: string) {
    return selectedAccountIds.length === 0 || selectedAccountIds.includes(accountId)
  }

  const activeAccounts = selectedAccountIds.length
  const activeCampaigns = selectedCampaignIds.length
  const label = !isFiltered
    ? "Todas as BMs"
    : [
        activeAccounts > 0 ? `${activeAccounts} BM${activeAccounts > 1 ? "s" : ""}` : "",
        activeCampaigns > 0 ? `${activeCampaigns} camp.` : "",
      ].filter(Boolean).join(" · ")

  return (
    <div className="relative" ref={ref}>
      {/* Trigger button */}
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
        <span className="max-w-[9rem] truncate text-xs font-medium">{label}</span>
        {isFiltered ? (
          <X
            className="w-3 h-3 flex-shrink-0 hover:text-red-400 transition-colors"
            onClick={e => { e.stopPropagation(); clearFilter() }}
          />
        ) : (
          <ChevronDown className={cn("w-3 h-3 flex-shrink-0 transition-transform", open && "rotate-180")} />
        )}
      </button>

      {/* Dropdown panel */}
      {open && (
        <div className="absolute right-0 top-full mt-1.5 w-80 bg-[#0f0f18] border border-[var(--border)] rounded-xl shadow-2xl z-50 overflow-hidden">
          {/* Header */}
          <div className="px-4 py-3 border-b border-[var(--border)] flex items-center justify-between">
            <span className="text-xs font-semibold text-[#71717a] uppercase tracking-wider">Filtrar análise</span>
            {isFiltered && (
              <button onClick={clearFilter} className="text-[10px] font-medium text-[#6366f1] hover:text-[#818cf8] transition-colors">
                Limpar filtros
              </button>
            )}
          </div>

          {/* Account list */}
          <div className="max-h-72 overflow-y-auto p-2">
            {accounts.length === 0 ? (
              <div className="flex flex-col items-center gap-1 py-6 text-[#52525b]">
                <Filter className="w-5 h-5 opacity-40" />
                <p className="text-xs">Nenhuma conta conectada</p>
              </div>
            ) : (
              accounts.map(acc => {
                const accCampaigns = campaigns.filter(c => c.account_id === acc.account_id)
                const isExpanded = expanded.has(acc.account_id)
                const isLoading = loading.has(acc.account_id)
                const checked = isAccountChecked(acc.account_id)
                const platformColor = acc.platform === "meta" ? "#1877f2" : "#34a853"

                return (
                  <div key={acc.account_id} className="mb-0.5">
                    {/* Account row */}
                    <div className="flex items-center gap-2 px-2 py-2 rounded-lg hover:bg-[#1a1a27] transition-colors">
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

                      {/* Platform dot */}
                      <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: platformColor }} />

                      {/* Label */}
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-[#e4e4e7] truncate">{acc.account_name}</p>
                        <p className="text-[10px] text-[#52525b]">
                          {acc.platform === "meta" ? "Meta Ads" : "Google Ads"} · {acc.account_id}
                        </p>
                      </div>

                      {/* Expand toggle */}
                      <button
                        onClick={() => toggleExpand(acc.account_id)}
                        className="p-1 rounded hover:bg-[#27272a] text-[#52525b] hover:text-[#a1a1aa] transition-colors flex-shrink-0"
                      >
                        {isLoading
                          ? <Loader2 className="w-3 h-3 animate-spin" />
                          : isExpanded
                            ? <ChevronDown className="w-3 h-3" />
                            : <ChevronRight className="w-3 h-3" />
                        }
                      </button>
                    </div>

                    {/* Campaign list */}
                    {isExpanded && (
                      <div className="ml-8 mt-0.5 mb-1 border-l border-[#27272a] pl-3">
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
              })
            )}
          </div>

          {/* Footer */}
          <div className="px-3 py-2.5 border-t border-[var(--border)]">
            <button
              onClick={() => setOpen(false)}
              className="w-full h-8 bg-[#6366f1] hover:bg-[#5558dd] text-white text-xs font-semibold rounded-lg transition-colors"
            >
              {isFiltered ? "Aplicar filtros" : "Fechar"}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
