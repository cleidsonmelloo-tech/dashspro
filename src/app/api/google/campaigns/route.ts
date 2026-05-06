import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

const GOOGLE_DEVELOPER_TOKEN = process.env.GOOGLE_DEVELOPER_TOKEN!
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID!
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET!

// GET /api/google/campaigns?since=...&until=...
export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()
  const user = session?.user
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 })

  const { data: wsList } = await supabase
    .from("workspaces").select("id").eq("owner_id", user.id).order("created_at", { ascending: true })
  const workspace = wsList?.[0]
  if (!workspace) return NextResponse.json({ error: "Workspace não encontrado" }, { status: 404 })

  // Use RPC (SECURITY DEFINER) to bypass RLS
  type AccRow = { id: string; platform: string; account_id: string; account_name: string; access_token: string; refresh_token: string | null; token_expires_at: string | null; is_active: boolean }
  const { data: rawAccounts } = await supabase.rpc("get_workspace_ad_accounts", { p_workspace_id: workspace.id })
  const accounts = (rawAccounts as AccRow[] || []).filter(a => a.platform === "google" && a.is_active)

  if (!accounts || accounts.length === 0) {
    return NextResponse.json({ campaigns: [], connected: false })
  }

  const { searchParams } = new URL(request.url)
  const since = (searchParams.get("since") || getDateDaysAgo(30)).replace(/-/g, "")
  const until = (searchParams.get("until") || getDateDaysAgo(0)).replace(/-/g, "")
  const filterAccountIds = (searchParams.get("account_ids") || "").split(",").filter(Boolean)

  const filteredAccounts = filterAccountIds.length > 0
    ? accounts.filter(a => filterAccountIds.includes(a.account_id))
    : accounts

  const allCampaigns: Campaign[] = []

  for (const account of filteredAccounts) {
    let token = account.access_token

    // Refresh token if expired
    const rt = account.refresh_token
    if (isTokenExpired(account.token_expires_at) && rt) {
      token = await refreshGoogleToken(account.id, rt, supabase)
      if (!token) continue
    }

    const query = `
      SELECT
        campaign.id,
        campaign.name,
        campaign.status,
        metrics.cost_micros,
        metrics.impressions,
        metrics.clicks,
        metrics.conversions,
        metrics.ctr,
        metrics.average_cpc
      FROM campaign
      WHERE segments.date BETWEEN '${since.slice(0,4)}-${since.slice(4,6)}-${since.slice(6,8)}'
        AND '${until.slice(0,4)}-${until.slice(4,6)}-${until.slice(6,8)}'
        AND campaign.status != 'REMOVED'
    `

    const res = await fetch(
      `https://googleads.googleapis.com/v17/customers/${account.account_id}/googleAds:search`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "developer-token": GOOGLE_DEVELOPER_TOKEN,
          "login-customer-id": account.account_id,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ query }),
      }
    )

    if (!res.ok) continue

    const data = await res.json()
    const rows: GoogleRow[] = data.results || []

    const campaignMap: Record<string, Campaign> = {}

    for (const row of rows) {
      const id = row.campaign.id
      if (!campaignMap[id]) {
        campaignMap[id] = {
          id: `google_${account.account_id}_${id}`,
          name: row.campaign.name,
          platform: "google",
          account_name: account.account_name,
          status: row.campaign.status.toLowerCase(),
          spend: 0, impressions: 0, clicks: 0, conversions: 0,
          ctr: 0, cpc: 0, cpa: 0, roas: 0,
        }
      }
      const c = campaignMap[id]
      c.spend += (parseInt(row.metrics.cost_micros || "0") / 1_000_000)
      c.impressions += parseInt(row.metrics.impressions || "0")
      c.clicks += parseInt(row.metrics.clicks || "0")
      c.conversions += parseFloat(row.metrics.conversions || "0")
    }

    for (const c of Object.values(campaignMap)) {
      c.ctr = c.impressions > 0 ? (c.clicks / c.impressions) * 100 : 0
      c.cpc = c.clicks > 0 ? c.spend / c.clicks : 0
      c.cpa = c.conversions > 0 ? c.spend / c.conversions : 0
      allCampaigns.push(c)
    }
  }

  allCampaigns.sort((a, b) => b.spend - a.spend)
  return NextResponse.json({ campaigns: allCampaigns, connected: true })
}

async function refreshGoogleToken(
  accountDbId: string,
  refreshToken: string,
  supabase: Awaited<ReturnType<typeof createClient>>
): Promise<string | null> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  })

  if (!res.ok) return null

  const data = await res.json()
  const { access_token, expires_in } = data
  const expiresAt = new Date(Date.now() + (expires_in || 3600) * 1000).toISOString()

  await supabase
    .from("ad_accounts")
    .update({ access_token, token_expires_at: expiresAt })
    .eq("id", accountDbId)

  return access_token
}

interface GoogleRow {
  campaign: { id: string; name: string; status: string }
  metrics: { cost_micros: string; impressions: string; clicks: string; conversions: string; ctr: string; average_cpc: string }
}
interface Campaign {
  id: string; name: string; platform: string; account_name: string
  status: string; spend: number; impressions: number; clicks: number
  conversions: number; ctr: number; cpc: number; cpa: number; roas: number
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
