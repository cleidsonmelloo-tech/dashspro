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
    const insightFields = `spend,impressions,clicks,actions,action_values,cpc,ctr,purchase_roas`
    const fields = `name,status,effective_status,insights.time_range({"since":"${since}","until":"${until}"}){${insightFields}}`

    const res = await fetch(
      `https://graph.facebook.com/v21.0/act_${account.account_id}/campaigns?` +
      new URLSearchParams({
        fields,
        limit: "500",
        // Exclui campanhas deletadas/arquivadas
        filtering: JSON.stringify([{ field: "effective_status", operator: "IN", value: ["ACTIVE", "PAUSED", "IN_PROCESS", "WITH_ISSUES"] }]),
        access_token: account.access_token,
      })
    )

    if (!res.ok) continue

    const data = await res.json()
    const campaigns: MetaCampaign[] = data.data || []

    for (const c of campaigns) {
      const insight = c.insights?.data?.[0]
      // Pula campanhas sem gasto no período (não rodaram)
      if (!insight || parseFloat(insight.spend || "0") === 0) continue
      const spend = parseFloat(insight.spend || "0")
      const impressions = parseInt(insight?.impressions || "0")
      const clicks = parseInt(insight?.clicks || "0")
      const conv = (insight?.actions || []).find((a: MetaAction) =>
        ["purchase", "lead", "complete_registration", "omni_purchase"].includes(a.action_type)
      )
      const conversions = conv ? parseFloat(conv.value || "0") : 0
      const ctr = impressions > 0 ? (clicks / impressions) * 100 : parseFloat(insight?.ctr || "0")
      const cpc = clicks > 0 ? spend / clicks : parseFloat(insight?.cpc || "0")
      const cpa = conversions > 0 ? spend / conversions : 0

      // ROAS real: usa purchase_roas da Meta ou calcula via action_values
      const purchaseRoasEntry = (insight?.purchase_roas || []).find((r: MetaAction) =>
        ["omni_purchase", "purchase"].includes(r.action_type)
      )
      const purchaseValue = (insight?.action_values || []).reduce((sum: number, av: MetaAction) =>
        ["omni_purchase", "purchase"].includes(av.action_type) ? sum + parseFloat(av.value || "0") : sum, 0
      )
      const roas = purchaseRoasEntry
        ? parseFloat(purchaseRoasEntry.value || "0")
        : (spend > 0 && purchaseValue > 0 ? purchaseValue / spend : 0)

      // Status: usa effective_status se disponível, senão status
      const rawStatus = (c.effective_status || c.status || "ACTIVE").toUpperCase()
      const statusMap: Record<string, string> = {
        ACTIVE: "active", PAUSED: "paused", CAMPAIGN_PAUSED: "paused",
        ADSET_PAUSED: "paused", DELETED: "removed", ARCHIVED: "ended",
        WITH_ISSUES: "with_issues", IN_PROCESS: "in_process",
      }
      const status = statusMap[rawStatus] || rawStatus.toLowerCase()

      allCampaigns.push({
        id: `meta_${account.account_id}_${c.id}`,
        name: c.name,
        platform: "meta",
        account_name: account.account_name,
        status,
        spend,
        impressions,
        clicks,
        conversions,
        ctr,
        cpc,
        cpa,
        roas,
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
  action_values?: MetaAction[]; purchase_roas?: MetaAction[]
}
interface MetaCampaign {
  id: string; name: string; status: string; effective_status: string
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
