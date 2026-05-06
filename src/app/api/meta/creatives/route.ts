import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

// GET /api/meta/creatives?since=...&until=...
export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()
  const user = session?.user
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 })

  const { data: wsList } = await supabase.from("workspaces").select("id").eq("owner_id", user.id).order("created_at", { ascending: true })
  const workspace = wsList?.[0]
  if (!workspace) return NextResponse.json({ error: "Workspace não encontrado" }, { status: 404 })

  // Use RPC (SECURITY DEFINER) to bypass RLS
  type AccRow = { id: string; platform: string; account_id: string; account_name: string; access_token: string; token_expires_at: string | null; is_active: boolean }
  const { data: rawAccounts } = await supabase.rpc("get_workspace_ad_accounts", { p_workspace_id: workspace.id })
  const accounts = (rawAccounts as AccRow[] || []).filter(a => a.platform === "meta" && a.is_active)

  if (!accounts || accounts.length === 0) {
    return NextResponse.json({ creatives: [], connected: false })
  }

  const { searchParams } = new URL(request.url)
  const since = searchParams.get("since") || getDateDaysAgo(30)
  const until = searchParams.get("until") || getDateDaysAgo(0)
  const filterAccountIds = (searchParams.get("account_ids") || "").split(",").filter(Boolean)
  const filterCampaignIds = (searchParams.get("campaign_ids") || "").split(",").filter(Boolean)

  const filteredAccounts = filterAccountIds.length > 0
    ? accounts.filter(a => filterAccountIds.includes(a.account_id))
    : accounts

  const allCreatives: Creative[] = []

  for (const account of filteredAccounts) {
    if (isTokenExpired(account.token_expires_at)) continue

    const fields = "ad_name,adset_name,campaign_name,spend,impressions,clicks,actions,ctr,cpc,reach,thumbnail_url,creative"
    const fetchParams: Record<string, string> = {
      fields,
      time_range: JSON.stringify({ since, until }),
      level: "ad",
      limit: "50",
      access_token: account.access_token,
    }
    const rawCampaignIds = filterCampaignIds
      .map(id => {
        const p = `meta_${account.account_id}_`
        if (id.startsWith(p)) return id.slice(p.length)
        if (id.startsWith("meta_") || id.startsWith("google_")) return null
        return id
      }).filter((id): id is string => id !== null && id.length > 0)
    if (filterCampaignIds.length > 0 && rawCampaignIds.length === 0) continue
    if (rawCampaignIds.length > 0) {
      fetchParams.filtering = JSON.stringify([{ field: "campaign.id", operator: "IN", value: rawCampaignIds }])
    }
    const res = await fetch(
      `https://graph.facebook.com/v21.0/act_${account.account_id}/insights?` +
      new URLSearchParams(fetchParams)
    )

    if (!res.ok) continue

    const data = await res.json()
    const insights: MetaAdInsight[] = data.data || []

    for (const ad of insights) {
      const spend = parseFloat(ad.spend || "0")
      const impressions = parseInt(ad.impressions || "0")
      const clicks = parseInt(ad.clicks || "0")
      const conv = (ad.actions || []).find((a) =>
        ["purchase", "lead", "complete_registration"].includes(a.action_type)
      )
      const conversions = conv ? parseInt(conv.value || "0") : 0
      const ctr = impressions > 0 ? (clicks / impressions) * 100 : 0
      const cpc = clicks > 0 ? spend / clicks : 0
      const cpa = conversions > 0 ? spend / conversions : 0

      allCreatives.push({
        id: `${account.account_id}_${ad.ad_name}`,
        name: ad.ad_name,
        campaign: ad.campaign_name,
        adset: ad.adset_name,
        platform: "meta",
        account_name: account.account_name,
        status: "active",
        spend,
        impressions,
        clicks,
        conversions,
        ctr,
        cpc,
        cpa,
        thumbnail_url: ad.thumbnail_url || null,
      })
    }
  }

  allCreatives.sort((a, b) => b.ctr - a.ctr)

  return NextResponse.json({ creatives: allCreatives, connected: true })
}

interface MetaAdInsight {
  ad_name: string; adset_name: string; campaign_name: string
  spend: string; impressions: string; clicks: string; ctr: string; cpc: string; reach?: string
  thumbnail_url?: string; creative?: { id: string }
  actions?: { action_type: string; value: string }[]
}
interface Creative {
  id: string; name: string; campaign: string; adset: string
  platform: string; account_name: string; status: string
  spend: number; impressions: number; clicks: number
  conversions: number; ctr: number; cpc: number; cpa: number
  thumbnail_url: string | null
}

function getDateDaysAgo(days: number) {
  const d = new Date()
  d.setDate(d.getDate() - days)
  return d.toISOString().split("T")[0]
}

function isTokenExpired(expiresAt: string | null) {
  if (!expiresAt) return false
  return new Date(expiresAt) < new Date()
}
