import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

// GET /api/meta/campaigns?since=...&until=...
export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()
  const user = session?.user
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 })

  const { data: workspaceList } = await supabase
    .from("workspaces")
    .select("id")
    .eq("owner_id", user.id)
    .order("created_at", { ascending: true })
  const workspace = workspaceList?.[0]

  if (!workspace) return NextResponse.json({ error: "Workspace não encontrado" }, { status: 404 })

  const { data: allAccounts } = await supabase.rpc("get_workspace_ad_accounts", { p_workspace_id: workspace.id })
  const accounts = (allAccounts || []).filter((a: AdAccountRow) => a.platform === "meta" && a.is_active)

  if (!accounts || accounts.length === 0) {
    return NextResponse.json({ campaigns: [], connected: false })
  }

  const { searchParams } = new URL(request.url)
  const since = searchParams.get("since") || getDateDaysAgo(30)
  const until = searchParams.get("until") || getDateDaysAgo(0)

  const allCampaigns: Campaign[] = []

  for (const account of accounts) {
    if (isTokenExpired(account.token_expires_at)) continue

    // Busca campanhas com status + insights aninhados no mesmo request
    const insightFields = `spend,impressions,clicks,actions,cpc,ctr`
    const fields = `name,effective_status,insights.time_range({"since":"${since}","until":"${until}"}){${insightFields}}`

    const res = await fetch(
      `https://graph.facebook.com/v21.0/act_${account.account_id}/campaigns?` +
      new URLSearchParams({
        fields,
        limit: "500",
        access_token: account.access_token,
      })
    )

    if (!res.ok) continue

    const data = await res.json()
    const campaigns: MetaCampaign[] = data.data || []

    for (const c of campaigns) {
      const insight = c.insights?.data?.[0]
      const spend = parseFloat(insight?.spend || "0")
      const impressions = parseInt(insight?.impressions || "0")
      const clicks = parseInt(insight?.clicks || "0")
      const conv = (insight?.actions || []).find((a: MetaAction) =>
        ["purchase", "lead", "complete_registration", "omni_purchase"].includes(a.action_type)
      )
      const conversions = conv ? parseFloat(conv.value || "0") : 0
      const ctr = impressions > 0 ? (clicks / impressions) * 100 : parseFloat(insight?.ctr || "0")
      const cpc = clicks > 0 ? spend / clicks : parseFloat(insight?.cpc || "0")
      const cpa = conversions > 0 ? spend / conversions : 0

      allCampaigns.push({
        id: `meta_${account.account_id}_${c.id}`,
        name: c.name,
        platform: "meta",
        account_name: account.account_name,
        status: (c.effective_status || "active").toLowerCase(),
        spend,
        impressions,
        clicks,
        conversions,
        ctr,
        cpc,
        cpa,
        roas: spend > 0 ? (conversions * 100) / spend : 0,
      })
    }
  }

  allCampaigns.sort((a, b) => b.spend - a.spend)

  return NextResponse.json({ campaigns: allCampaigns, connected: true })
}

interface AdAccountRow {
  account_id: string; account_name: string; access_token: string
  platform: string; is_active: boolean; token_expires_at: string | null
}
interface MetaAction { action_type: string; value: string }
interface MetaCampaignInsight {
  spend: string; impressions: string; clicks: string
  cpc: string; ctr: string; actions?: MetaAction[]
}
interface MetaCampaign {
  id: string; name: string; effective_status: string
  insights?: { data: MetaCampaignInsight[] }
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
