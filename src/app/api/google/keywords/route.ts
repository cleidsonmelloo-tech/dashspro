import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

const GOOGLE_DEVELOPER_TOKEN = process.env.GOOGLE_DEVELOPER_TOKEN!
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID!
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET!

// GET /api/google/keywords?since=...&until=...
export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()
  const user = session?.user
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 })

  const { data: wsList } = await supabase.from("workspaces").select("id").eq("owner_id", user.id).order("created_at", { ascending: true })
  const workspace = wsList?.[0]
  if (!workspace) return NextResponse.json({ error: "Workspace não encontrado" }, { status: 404 })

  const { data: accounts } = await supabase
    .from("ad_accounts")
    .select("id, account_id, access_token, refresh_token, token_expires_at, account_name")
    .eq("workspace_id", workspace.id)
    .eq("platform", "google")
    .eq("is_active", true)

  if (!accounts || accounts.length === 0) {
    return NextResponse.json({ keywords: [], connected: false })
  }

  const { searchParams } = new URL(request.url)
  const since = searchParams.get("since") || getDateDaysAgo(30)
  const until = searchParams.get("until") || getDateDaysAgo(0)

  const allKeywords: Keyword[] = []

  for (const account of accounts) {
    let token = account.access_token

    if (isTokenExpired(account.token_expires_at) && account.refresh_token) {
      token = await refreshGoogleToken(account.id, account.refresh_token, supabase)
      if (!token) continue
    }

    const query = `
      SELECT
        ad_group_criterion.keyword.text,
        ad_group_criterion.keyword.match_type,
        ad_group_criterion.quality_info.quality_score,
        metrics.cost_micros,
        metrics.impressions,
        metrics.clicks,
        metrics.conversions,
        metrics.ctr,
        metrics.average_cpc,
        campaign.name
      FROM keyword_view
      WHERE segments.date BETWEEN '${since}' AND '${until}'
        AND ad_group_criterion.status != 'REMOVED'
      ORDER BY metrics.cost_micros DESC
      LIMIT 100
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
    const rows: GoogleKwRow[] = data.results || []

    for (const row of rows) {
      const spend = parseInt(row.metrics.cost_micros || "0") / 1_000_000
      const impressions = parseInt(row.metrics.impressions || "0")
      const clicks = parseInt(row.metrics.clicks || "0")
      const conversions = parseFloat(row.metrics.conversions || "0")
      const ctr = impressions > 0 ? (clicks / impressions) * 100 : 0
      const cpc = clicks > 0 ? spend / clicks : 0
      const cpa = conversions > 0 ? spend / conversions : 0
      const qs = row.adGroupCriterion?.qualityInfo?.qualityScore || 0

      allKeywords.push({
        id: `${account.account_id}_${row.adGroupCriterion?.keyword?.text}_${row.adGroupCriterion?.keyword?.matchType}`,
        keyword: row.adGroupCriterion?.keyword?.text || "",
        matchType: row.adGroupCriterion?.keyword?.matchType || "BROAD",
        campaign: row.campaign?.name || "",
        qualityScore: qs,
        spend,
        impressions,
        clicks,
        conversions,
        ctr,
        cpc,
        cpa,
      })
    }
  }

  return NextResponse.json({ keywords: allKeywords, connected: true })
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
  const { access_token, expires_in } = await res.json()
  const expiresAt = new Date(Date.now() + (expires_in || 3600) * 1000).toISOString()
  await supabase.from("ad_accounts").update({ access_token, token_expires_at: expiresAt }).eq("id", accountDbId)
  return access_token
}

interface GoogleKwRow {
  adGroupCriterion?: {
    keyword?: { text: string; matchType: string }
    qualityInfo?: { qualityScore: number }
  }
  metrics: { cost_micros: string; impressions: string; clicks: string; conversions: string; ctr: string; average_cpc: string }
  campaign?: { name: string }
}
interface Keyword {
  id: string; keyword: string; matchType: string; campaign: string
  qualityScore: number; spend: number; impressions: number; clicks: number
  conversions: number; ctr: number; cpc: number; cpa: number
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
