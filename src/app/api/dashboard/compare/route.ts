import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

const GOOGLE_DEVELOPER_TOKEN = process.env.GOOGLE_DEVELOPER_TOKEN!
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID!
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET!

type Acc = { id: string; platform: string; account_id: string; access_token: string; refresh_token: string | null; token_expires_at: string | null; is_active: boolean }

// GET /api/dashboard/compare?since=...&until=...&account_ids=...&campaign_ids=...
export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()
  const user = session?.user
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 })

  const { data: wsList } = await supabase.from("workspaces").select("id").eq("owner_id", user.id).order("created_at", { ascending: true })
  const workspace = wsList?.[0]
  if (!workspace) return NextResponse.json({ error: "Workspace não encontrado" }, { status: 404 })

  // Use RPC (SECURITY DEFINER) to bypass RLS
  const { data: rawAccounts } = await supabase.rpc("get_workspace_ad_accounts", { p_workspace_id: workspace.id })
  const allAccounts = (rawAccounts || []).filter((a: Acc) => a.is_active)

  if (!allAccounts || allAccounts.length === 0) {
    return NextResponse.json({ connected: false, current: null, previous: null })
  }

  const { searchParams } = new URL(request.url)
  const since = searchParams.get("since") || getDateDaysAgo(30)
  const until = searchParams.get("until") || getDateDaysAgo(0)
  const filterAccountIds = (searchParams.get("account_ids") || "").split(",").filter(Boolean)
  const filterCampaignIds = (searchParams.get("campaign_ids") || "").split(",").filter(Boolean)

  const accounts: Acc[] = filterAccountIds.length > 0
    ? allAccounts.filter((a: Acc) => filterAccountIds.includes(a.account_id))
    : allAccounts

  const sinceDate = new Date(since)
  const untilDate = new Date(until)
  const diffMs = untilDate.getTime() - sinceDate.getTime()
  const prevUntil = new Date(sinceDate.getTime() - 86400000).toISOString().split("T")[0]
  const prevSince = new Date(sinceDate.getTime() - diffMs - 86400000).toISOString().split("T")[0]

  const [current, previous] = await Promise.all([
    fetchPeriodMetrics(accounts, since, until, filterCampaignIds, supabase),
    fetchPeriodMetrics(accounts, prevSince, prevUntil, filterCampaignIds, supabase),
  ])

  return NextResponse.json({ connected: true, current, previous })
}

async function fetchPeriodMetrics(
  accounts: Acc[], since: string, until: string,
  filterCampaignIds: string[],
  supabase: Awaited<ReturnType<typeof createClient>>
) {
  const totals = { spend: 0, impressions: 0, clicks: 0, conversions: 0 }

  for (const acc of accounts.filter(a => a.platform === "meta")) {
    if (isTokenExpired(acc.token_expires_at)) continue

    const rawCampaignIds = filterCampaignIds
      .map(id => {
        const p = `meta_${acc.account_id}_`
        if (id.startsWith(p)) return id.slice(p.length)
        if (id.startsWith("meta_") || id.startsWith("google_")) return null
        return id
      }).filter((id): id is string => id !== null && id.length > 0)
    if (filterCampaignIds.length > 0 && rawCampaignIds.length === 0) continue

    const params: Record<string, string> = {
      fields: "spend,impressions,clicks,actions",
      time_range: JSON.stringify({ since, until }),
      access_token: acc.access_token,
    }
    if (rawCampaignIds.length > 0) {
      params.filtering = JSON.stringify([{ field: "campaign.id", operator: "IN", value: rawCampaignIds }])
      params.level = "campaign"
    }
    const res = await fetch(`https://graph.facebook.com/v21.0/act_${acc.account_id}/insights?` + new URLSearchParams(params))
    if (!res.ok) continue
    const { data: insights = [] } = await res.json()
    for (const ins of insights as MetaInsight[]) {
      totals.spend += parseFloat(ins.spend || "0")
      totals.impressions += parseInt(ins.impressions || "0")
      totals.clicks += parseInt(ins.clicks || "0")
      const conv = (ins.actions || []).find(a => ["purchase", "lead", "complete_registration"].includes(a.action_type))
      totals.conversions += conv ? parseInt(conv.value || "0") : 0
    }
  }

  for (const acc of accounts.filter(a => a.platform === "google")) {
    let token = acc.access_token
    const rt = acc.refresh_token
    if (isTokenExpired(acc.token_expires_at) && rt) {
      token = await refreshGoogleToken(acc.id, rt, supabase) ?? token
    }

    const rawCampaignIds = filterCampaignIds
      .map(id => {
        const p = `google_${acc.account_id}_`
        if (id.startsWith(p)) return id.slice(p.length)
        if (id.startsWith("meta_") || id.startsWith("google_")) return null
        return id
      }).filter((id): id is string => id !== null && id.length > 0)
    if (filterCampaignIds.length > 0 && rawCampaignIds.length === 0) continue

    let query = `SELECT metrics.cost_micros,metrics.impressions,metrics.clicks,metrics.conversions
      FROM campaign WHERE segments.date BETWEEN '${since}' AND '${until}' AND campaign.status != 'REMOVED'`
    if (rawCampaignIds.length > 0) query += ` AND campaign.id IN (${rawCampaignIds.join(",")})`

    const res = await fetch(
      `https://googleads.googleapis.com/v17/customers/${acc.account_id}/googleAds:search`,
      { method: "POST", headers: { Authorization: `Bearer ${token}`, "developer-token": GOOGLE_DEVELOPER_TOKEN, "login-customer-id": acc.account_id, "Content-Type": "application/json" }, body: JSON.stringify({ query }) }
    )
    if (!res.ok) continue
    const { results = [] } = await res.json()
    for (const row of results as GoogleRow[]) {
      totals.spend += parseInt(row.metrics.cost_micros || "0") / 1_000_000
      totals.impressions += parseInt(row.metrics.impressions || "0")
      totals.clicks += parseInt(row.metrics.clicks || "0")
      totals.conversions += parseFloat(row.metrics.conversions || "0")
    }
  }

  return {
    ...totals,
    ctr: totals.impressions > 0 ? (totals.clicks / totals.impressions) * 100 : 0,
    cpc: totals.clicks > 0 ? totals.spend / totals.clicks : 0,
    cpa: totals.conversions > 0 ? totals.spend / totals.conversions : 0,
  }
}

interface MetaInsight { spend: string; impressions: string; clicks: string; actions?: { action_type: string; value: string }[] }
interface GoogleRow { metrics: { cost_micros: string; impressions: string; clicks: string; conversions: string } }

async function refreshGoogleToken(id: string, refreshToken: string, supabase: Awaited<ReturnType<typeof createClient>>) {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: GOOGLE_CLIENT_ID, client_secret: GOOGLE_CLIENT_SECRET, refresh_token: refreshToken, grant_type: "refresh_token" }),
  })
  if (!res.ok) return null
  const { access_token, expires_in } = await res.json()
  const expiresAt = new Date(Date.now() + (expires_in || 3600) * 1000).toISOString()
  await supabase.from("ad_accounts").update({ access_token, token_expires_at: expiresAt }).eq("id", id)
  return access_token
}
function getDateDaysAgo(days: number) { const d = new Date(); d.setDate(d.getDate() - days); return d.toISOString().split("T")[0] }
function isTokenExpired(e: string | null) { return e ? new Date(e) < new Date() : false }
