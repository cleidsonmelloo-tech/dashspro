import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

const GOOGLE_DEVELOPER_TOKEN = process.env.GOOGLE_DEVELOPER_TOKEN!
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID!
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET!

// GET /api/dashboard/metrics?since=...&until=...
// Returns combined Meta + Google overview metrics + daily chart data
export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 })

  const { data: workspace } = await supabase
    .from("workspaces")
    .select("id")
    .eq("owner_id", user.id)
    .single()

  if (!workspace) return NextResponse.json({ error: "Workspace não encontrado" }, { status: 404 })

  const { data: accounts } = await supabase
    .from("ad_accounts")
    .select("id, platform, account_id, access_token, refresh_token, token_expires_at")
    .eq("workspace_id", workspace.id)
    .eq("is_active", true)

  if (!accounts || accounts.length === 0) {
    return NextResponse.json({ connected: false, metrics: defaultMetrics(), daily: [] })
  }

  const { searchParams } = new URL(request.url)
  const since = searchParams.get("since") || getDateDaysAgo(30)
  const until = searchParams.get("until") || getDateDaysAgo(0)

  const totals = { spend: 0, impressions: 0, clicks: 0, conversions: 0, meta_spend: 0, google_spend: 0 }
  const dailyMap: Record<string, DailyPoint> = {}

  // ---- Meta ----
  const metaAccounts = accounts.filter((a) => a.platform === "meta")
  for (const acc of metaAccounts) {
    if (isTokenExpired(acc.token_expires_at)) continue
    const res = await fetch(
      `https://graph.facebook.com/v21.0/act_${acc.account_id}/insights?` +
      new URLSearchParams({
        fields: "spend,impressions,clicks,actions",
        time_range: JSON.stringify({ since, until }),
        time_increment: "1",
        access_token: acc.access_token,
      })
    )
    if (!res.ok) continue
    const { data: insights = [] } = await res.json()

    for (const ins of insights as MetaInsight[]) {
      const spend = parseFloat(ins.spend || "0")
      const impressions = parseInt(ins.impressions || "0")
      const clicks = parseInt(ins.clicks || "0")
      const conv = (ins.actions || []).find((a) =>
        ["purchase", "lead", "complete_registration"].includes(a.action_type)
      )
      const conversions = conv ? parseInt(conv.value || "0") : 0

      totals.spend += spend
      totals.meta_spend += spend
      totals.impressions += impressions
      totals.clicks += clicks
      totals.conversions += conversions

      const d = ins.date_start
      if (!dailyMap[d]) dailyMap[d] = { date: d, meta_spend: 0, google_spend: 0, clicks: 0, impressions: 0, conversions: 0 }
      dailyMap[d].meta_spend += spend
      dailyMap[d].clicks += clicks
      dailyMap[d].impressions += impressions
      dailyMap[d].conversions += conversions
    }
  }

  // ---- Google ----
  const googleAccounts = accounts.filter((a) => a.platform === "google")
  for (const acc of googleAccounts) {
    let token = acc.access_token
    if (isTokenExpired(acc.token_expires_at) && acc.refresh_token) {
      token = await refreshGoogleToken(acc.id, acc.refresh_token, supabase) ?? token
    }

    const query = `
      SELECT
        segments.date,
        metrics.cost_micros,
        metrics.impressions,
        metrics.clicks,
        metrics.conversions
      FROM campaign
      WHERE segments.date BETWEEN '${since}' AND '${until}'
        AND campaign.status != 'REMOVED'
    `

    const res = await fetch(
      `https://googleads.googleapis.com/v17/customers/${acc.account_id}/googleAds:search`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "developer-token": GOOGLE_DEVELOPER_TOKEN,
          "login-customer-id": acc.account_id,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ query }),
      }
    )
    if (!res.ok) continue

    const { results = [] } = await res.json()
    for (const row of results as GoogleRow[]) {
      const spend = parseInt(row.metrics.cost_micros || "0") / 1_000_000
      const impressions = parseInt(row.metrics.impressions || "0")
      const clicks = parseInt(row.metrics.clicks || "0")
      const conversions = parseFloat(row.metrics.conversions || "0")
      const d = row.segments.date

      totals.spend += spend
      totals.google_spend += spend
      totals.impressions += impressions
      totals.clicks += clicks
      totals.conversions += conversions

      if (!dailyMap[d]) dailyMap[d] = { date: d, meta_spend: 0, google_spend: 0, clicks: 0, impressions: 0, conversions: 0 }
      dailyMap[d].google_spend += spend
      dailyMap[d].clicks += clicks
      dailyMap[d].impressions += impressions
      dailyMap[d].conversions += conversions
    }
  }

  const ctr = totals.impressions > 0 ? (totals.clicks / totals.impressions) * 100 : 0
  const cpc = totals.clicks > 0 ? totals.spend / totals.clicks : 0
  const cpa = totals.conversions > 0 ? totals.spend / totals.conversions : 0

  return NextResponse.json({
    connected: true,
    metrics: { ...totals, ctr, cpc, cpa },
    daily: Object.values(dailyMap).sort((a, b) => a.date.localeCompare(b.date)),
  })
}

function defaultMetrics() {
  return { spend: 0, impressions: 0, clicks: 0, conversions: 0, ctr: 0, cpc: 0, cpa: 0, meta_spend: 0, google_spend: 0 }
}

interface MetaInsight {
  spend: string; impressions: string; clicks: string; date_start: string
  actions?: { action_type: string; value: string }[]
}
interface GoogleRow {
  segments: { date: string }
  metrics: { cost_micros: string; impressions: string; clicks: string; conversions: string }
}
interface DailyPoint {
  date: string; meta_spend: number; google_spend: number
  clicks: number; impressions: number; conversions: number
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

function getDateDaysAgo(days: number) {
  const d = new Date()
  d.setDate(d.getDate() - days)
  return d.toISOString().split("T")[0]
}

function isTokenExpired(expiresAt: string | null) {
  if (!expiresAt) return false
  return new Date(expiresAt) < new Date()
}
