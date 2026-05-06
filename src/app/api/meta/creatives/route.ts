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
  const filterAccountIds  = (searchParams.get("account_ids")  || "").split(",").filter(Boolean)
  const filterCampaignIds = (searchParams.get("campaign_ids") || "").split(",").filter(Boolean)

  const filteredAccounts = filterAccountIds.length > 0
    ? accounts.filter(a => filterAccountIds.includes(a.account_id))
    : accounts

  const allCreatives: Creative[] = []

  for (const account of filteredAccounts) {
    if (isTokenExpired(account.token_expires_at)) continue

    // Campaign filter — strip prefix
    const rawCampaignIds = filterCampaignIds
      .map(id => {
        const p = `meta_${account.account_id}_`
        if (id.startsWith(p)) return id.slice(p.length)
        if (id.startsWith("meta_") || id.startsWith("google_")) return null
        return id
      }).filter((id): id is string => id !== null && id.length > 0)
    if (filterCampaignIds.length > 0 && rawCampaignIds.length === 0) continue

    // ── Single call: ads + creative thumbnail + insights por período ──────────
    // insights.time_range({}) embeds metrics directly on each ad object
    const timeRange = JSON.stringify({ since, until })
    const fields = [
      "id",
      "name",
      "status",
      "adset_name",
      "campaign_name",
      "campaign_id",
      `creative{thumbnail_url,object_type}`,
      `insights.time_range(${timeRange}){spend,impressions,clicks,actions,ctr,cpc}`,
    ].join(",")

    const params: Record<string, string> = {
      fields,
      limit: "100",
      filtering: JSON.stringify([
        { field: "effective_status", operator: "IN", value: ["ACTIVE", "PAUSED"] },
      ]),
      access_token: account.access_token,
    }

    // Campaign filter at ad level
    if (rawCampaignIds.length > 0) {
      const existing = JSON.parse(params.filtering) as object[]
      existing.push({ field: "campaign.id", operator: "IN", value: rawCampaignIds })
      params.filtering = JSON.stringify(existing)
    }

    const res = await fetch(
      `https://graph.facebook.com/v21.0/act_${account.account_id}/ads?` +
      new URLSearchParams(params)
    )

    if (!res.ok) {
      const errText = await res.text().catch(() => "")
      console.error(`[creatives] Meta ads error for ${account.account_id}:`, errText)
      continue
    }

    const json = await res.json()
    const ads: MetaAd[] = json.data || []

    for (const ad of ads) {
      // insights can be absent if the ad had no activity in the period
      const ins = ad.insights?.data?.[0]
      const spend       = parseFloat(ins?.spend       || "0")
      const impressions = parseInt(ins?.impressions   || "0")
      const clicks      = parseInt(ins?.clicks        || "0")
      const conv        = (ins?.actions || []).find(a =>
        ["purchase", "lead", "complete_registration", "omni_purchase"].includes(a.action_type)
      )
      const conversions = conv ? parseFloat(conv.value || "0") : 0
      const ctr  = impressions > 0 ? (clicks / impressions) * 100 : 0
      const cpc  = clicks > 0 ? spend / clicks : 0
      const cpa  = conversions > 0 ? spend / conversions : 0

      allCreatives.push({
        id: ad.id,
        name: ad.name,
        campaign: ad.campaign_name || "",
        adset:    ad.adset_name    || "",
        platform: "meta",
        account_name: account.account_name,
        status: ad.status?.toLowerCase() || "active",
        spend, impressions, clicks, conversions, ctr, cpc, cpa,
        thumbnail_url: ad.creative?.thumbnail_url || null,
      })
    }
  }

  // Sort by CTR desc, then by spend desc
  allCreatives.sort((a, b) => b.ctr - a.ctr || b.spend - a.spend)

  return NextResponse.json({ creatives: allCreatives, connected: true })
}

// ── Types ────────────────────────────────────────────────────────────────────
interface MetaAd {
  id: string
  name: string
  status: string
  adset_name?: string
  campaign_name?: string
  campaign_id?: string
  creative?: { thumbnail_url?: string; object_type?: string }
  insights?: {
    data?: {
      spend?: string; impressions?: string; clicks?: string; ctr?: string; cpc?: string
      actions?: { action_type: string; value: string }[]
    }[]
  }
}

interface Creative {
  id: string; name: string; campaign: string; adset: string
  platform: string; account_name: string; status: string
  spend: number; impressions: number; clicks: number
  conversions: number; ctr: number; cpc: number; cpa: number
  thumbnail_url: string | null
}

function getDateDaysAgo(days: number) {
  const d = new Date(); d.setDate(d.getDate() - days); return d.toISOString().split("T")[0]
}
function isTokenExpired(expiresAt: string | null) {
  return expiresAt ? new Date(expiresAt) < new Date() : false
}
