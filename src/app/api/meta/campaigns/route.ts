import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

// GET /api/meta/campaigns?since=...&until=...
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
    .select("account_id, access_token, token_expires_at, account_name")
    .eq("workspace_id", workspace.id)
    .eq("platform", "meta")
    .eq("is_active", true)

  if (!accounts || accounts.length === 0) {
    return NextResponse.json({ campaigns: [], connected: false })
  }

  const { searchParams } = new URL(request.url)
  const since = searchParams.get("since") || getDateDaysAgo(30)
  const until = searchParams.get("until") || getDateDaysAgo(0)

  const allCampaigns: Campaign[] = []

  for (const account of accounts) {
    if (isTokenExpired(account.token_expires_at)) continue

    const fields = "campaign_name,spend,impressions,clicks,actions,cpc,ctr,reach,frequency"
    const res = await fetch(
      `https://graph.facebook.com/v21.0/act_${account.account_id}/insights?` +
      new URLSearchParams({
        fields,
        time_range: JSON.stringify({ since, until }),
        level: "campaign",
        access_token: account.access_token,
      })
    )

    if (!res.ok) continue

    const data = await res.json()
    const insights: MetaCampaignInsight[] = data.data || []

    for (const c of insights) {
      const spend = parseFloat(c.spend || "0")
      const impressions = parseInt(c.impressions || "0")
      const clicks = parseInt(c.clicks || "0")
      const conv = (c.actions || []).find((a: MetaAction) =>
        ["purchase", "lead", "complete_registration"].includes(a.action_type)
      )
      const conversions = conv ? parseInt(conv.value || "0") : 0
      const ctr = impressions > 0 ? (clicks / impressions) * 100 : 0
      const cpc = clicks > 0 ? spend / clicks : 0
      const cpa = conversions > 0 ? spend / conversions : 0

      allCampaigns.push({
        id: `meta_${account.account_id}_${c.campaign_name}`,
        name: c.campaign_name,
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
        roas: spend > 0 ? (conversions * 100) / spend : 0,
      })
    }
  }

  allCampaigns.sort((a, b) => b.spend - a.spend)

  return NextResponse.json({ campaigns: allCampaigns, connected: true })
}

interface MetaAction { action_type: string; value: string }
interface MetaCampaignInsight {
  campaign_name: string; spend: string; impressions: string; clicks: string
  cpc: string; ctr: string; reach?: string; frequency?: string; actions?: MetaAction[]
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
