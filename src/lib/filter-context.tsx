"use client"

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react"

export interface AdAccount {
  id: string
  account_id: string
  account_name: string
  platform: "meta" | "google"
  business_manager_name?: string | null
}

export interface FilterCampaign {
  id: string
  name: string
  account_id: string
  platform: "meta" | "google"
}

export interface DateRange {
  since: string
  until: string
}

interface FilterContextValue {
  // Accounts & Campaigns (já existia)
  accounts: AdAccount[]
  campaigns: FilterCampaign[]
  selectedAccountIds: string[]
  selectedCampaignIds: string[]
  setSelectedAccountIds: (ids: string[]) => void
  setSelectedCampaignIds: (ids: string[]) => void
  loadCampaigns: (accountId: string) => void
  clearFilter: () => void
  isFiltered: boolean
  filterParam: string

  // Período (compartilhado entre Dashboard, Funil, Campanhas, etc.)
  dateRange: DateRange
  setDateRange: (range: DateRange) => void

  // Plataforma (Meta / Google / vazio = ambos)
  platformFilter: string[]
  setPlatformFilter: (p: string[]) => void
}

function defaultDateRange(): DateRange {
  const d = new Date()
  const until = d.toISOString().split("T")[0]
  d.setDate(d.getDate() - 30)
  const since = d.toISOString().split("T")[0]
  return { since, until }
}

const LS_DATE = "dashspro_date_range"
const LS_PLATFORM = "dashspro_platform_filter"

const FilterContext = createContext<FilterContextValue>({
  accounts: [],
  campaigns: [],
  selectedAccountIds: [],
  selectedCampaignIds: [],
  setSelectedAccountIds: () => {},
  setSelectedCampaignIds: () => {},
  loadCampaigns: () => {},
  clearFilter: () => {},
  isFiltered: false,
  filterParam: "",
  dateRange: defaultDateRange(),
  setDateRange: () => {},
  platformFilter: [],
  setPlatformFilter: () => {},
})

export function FilterProvider({ children }: { children: ReactNode }) {
  const [accounts, setAccounts] = useState<AdAccount[]>([])
  const [campaigns, setCampaigns] = useState<FilterCampaign[]>([])
  const [selectedAccountIds, setSelectedAccountIds] = useState<string[]>([])
  const [selectedCampaignIds, setSelectedCampaignIds] = useState<string[]>([])
  const [loadedIds, setLoadedIds] = useState<Set<string>>(new Set())

  // Período compartilhado (persistido em localStorage)
  const [dateRange, setDateRangeState] = useState<DateRange>(() => {
    if (typeof window === "undefined") return defaultDateRange()
    try {
      const saved = localStorage.getItem(LS_DATE)
      if (saved) return JSON.parse(saved) as DateRange
    } catch {}
    return defaultDateRange()
  })

  const setDateRange = useCallback((range: DateRange) => {
    setDateRangeState(range)
    try { localStorage.setItem(LS_DATE, JSON.stringify(range)) } catch {}
  }, [])

  // Plataforma compartilhada
  const [platformFilter, setPlatformFilterState] = useState<string[]>(() => {
    if (typeof window === "undefined") return []
    try {
      const saved = localStorage.getItem(LS_PLATFORM)
      if (saved) return JSON.parse(saved) as string[]
    } catch {}
    return []
  })

  const setPlatformFilter = useCallback((p: string[]) => {
    setPlatformFilterState(p)
    try { localStorage.setItem(LS_PLATFORM, JSON.stringify(p)) } catch {}
  }, [])

  useEffect(() => {
    fetch("/api/filter/accounts")
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.accounts) setAccounts(d.accounts) })
      .catch(() => {})
  }, [])

  const loadCampaigns = useCallback(async (accountId: string) => {
    if (loadedIds.has(accountId)) return
    setLoadedIds(prev => new Set([...prev, accountId]))
    try {
      const res = await fetch(`/api/filter/campaigns?account_id=${accountId}`)
      const d = res.ok ? await res.json() : null
      if (d?.campaigns) {
        setCampaigns(prev => [
          ...prev.filter(c => c.account_id !== accountId),
          ...d.campaigns,
        ])
      }
    } catch {}
  }, [loadedIds])

  const clearFilter = useCallback(() => {
    setSelectedAccountIds([])
    setSelectedCampaignIds([])
  }, [])

  const isFiltered = selectedAccountIds.length > 0 || selectedCampaignIds.length > 0

  const filterParam = [
    selectedAccountIds.length > 0 ? `&account_ids=${selectedAccountIds.join(",")}` : "",
    selectedCampaignIds.length > 0 ? `&campaign_ids=${selectedCampaignIds.join(",")}` : "",
    platformFilter.length > 0 ? `&platforms=${platformFilter.join(",")}` : "",
  ].join("")

  return (
    <FilterContext.Provider value={{
      accounts, campaigns,
      selectedAccountIds, selectedCampaignIds,
      setSelectedAccountIds, setSelectedCampaignIds,
      loadCampaigns, clearFilter, isFiltered, filterParam,
      dateRange, setDateRange,
      platformFilter, setPlatformFilter,
    }}>
      {children}
    </FilterContext.Provider>
  )
}

export function useFilter() {
  return useContext(FilterContext)
}
