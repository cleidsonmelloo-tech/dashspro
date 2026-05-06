import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

// GET /api/meta/metrics?since=2024-01-01&until=2024-01-31
export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()
  const user = session?.user
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 })

  const { data: wsList } = await supabase
    .from("workspaces").select("id").eq("owner_id", user.id).order("created_at", { ascending: true })
  const workspace = wsList?.[0]
  if (!workspace) return NextResponse.json({ error: "Workspace não encontrado" }, { status: 404 })

  const { data: accounts } = await supabase
    .from("ad_accounts")
    .select("account_id, access_token, token_expires_at")
    .eq("workspace_id", workspace.id)
    .eq("platform", "meta")
    .eq("is_active", true)

  if (!accounts || accounts.length === 0) {
    return NextResponse.json({ data: null, connected: false })
  }

  const { searchParams } = new URL(request.url)
  const since = searchParams.get("since") || getDateDaysAgo(30)
  const until = searchParams.get("until") || getDateDaysAgo(0)

  const allMetrics = { spend: 0, impressions: 0, clicks: 0, conversions: 0, cpc: 0, ctr: 0 }
  const dailyData: Record<string, { date: string; meta_spend: number; meta_clicks: number; meta_impressions: number }> = {}

  for (const account of accounts) {
    if (isTokenExpired(account.token_expires_at)) continue

    const fields = "spend,impressions,clicks,actions,cpc,ctr"
    const res = await fetch(
      `https://graph.facebook.com/v21.0/act_${account.account_id}/insights?` +
      new URLSearchParams({
        fields,
        time_range: JSON.stringify({ since, until }),
        time_increment: "1",
        access_token: account.access_token,
      })
    )

    if (!res.ok) continue

    const data = await res.json()
    const insights: MetaInsight[] = data.data || []

    for (const insight of insights) {
      allMetrics.spend += parseFloat(insight.spend || "0")
      allMetrics.impressions += parseInt(insight.impressions || "0")
      allMetrics.clicks += parseInt(insight.clicks || "0")
      const conv = (insight.actions || []).find((a: MetaAction) =>
        ["purchase", "lead", "complete_registration"].includes(a.action_type)
      )
      allMetrics.conversions += conv ? parseInt(conv.value || "0") : 0

      const d = insight.date_start
      if (!dailyData[d]) dailyData[d] = { date: d, meta_spend: 0, meta_clicks: 0, meta_impressions: 0 }
      dailyData[d].meta_spend += parseFloat(insight.spend || "0")
      dailyData[d].meta_clicks += parseInt(insight.clicks || "0")
      dailyData[d].meta_impressions += parseInt(insight.impressions || "0")
    }
  }

  allMetrics.ctr = allMetrics.impressions > 0 ? (allMetrics.clicks / allMetrics.impressions) * 100 : 0
  allMetrics.cpc = allMetrics.clicks > 0 ? allMetrics.spend / allMetrics.clicks : 0

  return NextResponse.json({
    connected: true,
    metrics: allMetrics,
    daily: Object.values(dailyData).sort((a, b) => a.date.localeCompare(b.date)),
  })
}

interface MetaAction { action_type: string; value: string }
interface MetaInsight {
  spend: string; impressions: string; clicks: string; cpc: string; ctr: string
  date_start: string; actions?: MetaAction[]
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
