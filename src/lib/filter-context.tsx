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

interface FilterContextValue {
  accounts: AdAccount[]
  campaigns: FilterCampaign[]
  selectedAccountIds: string[]   // account_id values; empty = all
  selectedCampaignIds: string[]  // raw campaign IDs; empty = all
  setSelectedAccountIds: (ids: string[]) => void
  setSelectedCampaignIds: (ids: string[]) => void
  loadCampaigns: (accountId: string) => void
  clearFilter: () => void
  isFiltered: boolean
  filterParam: string  // "&account_ids=1,2&campaign_ids=3,4" ready to append to URLs
}

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
})

export function FilterProvider({ children }: { children: ReactNode }) {
  const [accounts, setAccounts] = useState<AdAccount[]>([])
  const [campaigns, setCampaigns] = useState<FilterCampaign[]>([])
  const [selectedAccountIds, setSelectedAccountIds] = useState<string[]>([])
  const [selectedCampaignIds, setSelectedCampaignIds] = useState<string[]>([])
  const [loadedIds, setLoadedIds] = useState<Set<string>>(new Set())

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
  ].join("")

  return (
    <FilterContext.Provider value={{
      accounts, campaigns,
      selectedAccountIds, selectedCampaignIds,
      setSelectedAccountIds, setSelectedCampaignIds,
      loadCampaigns, clearFilter, isFiltered, filterParam,
    }}>
      {children}
    </FilterContext.Provider>
  )
}

export function useFilter() {
  return useContext(FilterContext)
}
