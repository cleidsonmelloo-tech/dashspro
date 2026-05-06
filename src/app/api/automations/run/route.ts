import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

const GOOGLE_DEVELOPER_TOKEN = process.env.GOOGLE_DEVELOPER_TOKEN!
const GOOGLE_CLIENT_ID       = process.env.GOOGLE_CLIENT_ID!
const GOOGLE_CLIENT_SECRET   = process.env.GOOGLE_CLIENT_SECRET!

interface AutomationRow {
  id: string; name: string; metric: string; operator: string
  threshold: number; action: string; action_value: number | null; platform: string
}

interface Metrics {
  spend: number; ctr: number; cpc: number; cpa: number
  impressions: number; clicks: number; conversions: number; roas: number
}

// POST /api/automations/run — evaluate all active automations against current metrics
export async function POST() {
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()
  const user = session?.user
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 })

  const { data: wsList } = await supabase
    .from("workspaces").select("id").eq("owner_id", user.id).order("created_at", { ascending: true })
  const workspace = wsList?.[0]
  if (!workspace) return NextResponse.json({ triggered: [] })

  // Fetch active automations
  const { data: automations } = await supabase
    .from("automations")
    .select("*")
    .eq("workspace_id", workspace.id)
    .eq("active", true)

  if (!automations || automations.length === 0) return NextResponse.json({ triggered: [] })

  // Fetch current metrics (last 24h)
  const today   = new Date().toISOString().split("T")[0]
  const since   = new Date(Date.now() - 86400000).toISOString().split("T")[0]
  const metrics = await fetchCurrentMetrics(workspace.id, since, today, supabase)

  if (!metrics) return NextResponse.json({ triggered: [] })

  const triggered: string[] = []

  for (const auto of automations as AutomationRow[]) {
    const current = metrics[auto.metric as keyof Metrics]
    if (current === undefined) continue

    const fired = evaluate(current, auto.operator, auto.threshold)
    if (!fired) continue

    triggered.push(auto.name)

    // Record trigger time
    await supabase
      .from("automations")
      .update({ last_triggered_at: new Date().toISOString() })
      .eq("id", auto.id)

    // Execute action
    if (auto.action === "notify") continue // Just records the trigger
    if (auto.action === "pause_campaign" || auto.action === "increase_budget" || auto.action === "decrease_budget") {
      await executeAction(auto, workspace.id, supabase)
    }
  }

  return NextResponse.json({ triggered, metrics })
}

function evaluate(value: number, operator: string, threshold: number): boolean {
  switch (operator) {
    case "gt":  return value > threshold
    case "lt":  return value < threshold
    case "gte": return value >= threshold
    case "lte": return value <= threshold
    default:    return false
  }
}

async function fetchCurrentMetrics(
  workspaceId: string,
  since: string,
  until: string,
  supabase: Awaited<ReturnType<typeof import("@/lib/supabase/server").createClient>>
): Promise<Metrics | null> {
  // Use RPC (SECURITY DEFINER) to bypass RLS
  const { data: rawAccounts } = await supabase.rpc("get_workspace_ad_accounts", { p_workspace_id: workspaceId })
  type AccRow = { id: string; platform: string; account_id: string; account_name: string; access_token: string; refresh_token: string | null; token_expires_at: string | null; is_active: boolean }
  const accounts = (rawAccounts as AccRow[] || []).filter((a) => a.is_active)

  if (!accounts || accounts.length === 0) return null

  const totals = { spend: 0, impressions: 0, clicks: 0, conversions: 0 }

  for (const acc of accounts.filter((a) => a.platform === "meta")) {
    if (isTokenExpired(acc.token_expires_at)) continue
    const res = await fetch(
      `https://graph.facebook.com/v21.0/act_${acc.account_id}/insights?` +
      new URLSearchParams({
        fields: "spend,impressions,clicks,actions",
        time_range: JSON.stringify({ since, until }),
        access_token: acc.access_token!,
      })
    ).catch(() => null)
    if (!res?.ok) continue
    const { data: insights = [] } = await res.json()
    for (const ins of insights as { spend: string; impressions: string; clicks: string; actions?: { action_type: string; value: string }[] }[]) {
      totals.spend       += parseFloat(ins.spend || "0")
      totals.impressions += parseInt(ins.impressions || "0")
      totals.clicks      += parseInt(ins.clicks || "0")
      const conv = (ins.actions || []).find((a) => ["purchase", "lead", "complete_registration"].includes(a.action_type))
      totals.conversions += conv ? parseInt(conv.value || "0") : 0
    }
  }

  for (const acc of accounts.filter((a) => a.platform === "google")) {
    let token = acc.access_token
    if (isTokenExpired(acc.token_expires_at) && acc.refresh_token) {
      token = await refreshGoogleToken(acc.id, acc.refresh_token, supabase) ?? token
    }
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
        body: JSON.stringify({
          query: `SELECT metrics.cost_micros,metrics.impressions,metrics.clicks,metrics.conversions
            FROM campaign WHERE segments.date BETWEEN '${since}' AND '${until}'
            AND campaign.status != 'REMOVED'`
        }),
      }
    ).catch(() => null)
    if (!res?.ok) continue
    const { results = [] } = await res.json()
    for (const row of results as { metrics: { cost_micros: string; impressions: string; clicks: string; conversions: string } }[]) {
      totals.spend       += parseInt(row.metrics.cost_micros || "0") / 1_000_000
      totals.impressions += parseInt(row.metrics.impressions || "0")
      totals.clicks      += parseInt(row.metrics.clicks || "0")
      totals.conversions += parseFloat(row.metrics.conversions || "0")
    }
  }

  const ctr  = totals.impressions > 0 ? (totals.clicks / totals.impressions) * 100 : 0
  const cpc  = totals.clicks > 0 ? totals.spend / totals.clicks : 0
  const cpa  = totals.conversions > 0 ? totals.spend / totals.conversions : 0
  const roas = totals.spend > 0 && totals.conversions > 0 ? (totals.conversions * 50) / totals.spend : 0

  return { ...totals, ctr, cpc, cpa, roas }
}

async function executeAction(
  auto: AutomationRow,
  workspaceId: string,
  supabase: Awaited<ReturnType<typeof import("@/lib/supabase/server").createClient>>
) {
  // Use RPC (SECURITY DEFINER) to bypass RLS
  type AccRow2 = { id: string; platform: string; account_id: string; access_token: string; refresh_token: string | null; token_expires_at: string | null; is_active: boolean }
  const { data: rawAcc } = await supabase.rpc("get_workspace_ad_accounts", { p_workspace_id: workspaceId })
  const accounts = (rawAcc as AccRow2[] || []).filter((a) => a.is_active)

  if (!accounts) return

  for (const acc of accounts) {
    if (auto.platform !== "all" && acc.platform !== auto.platform) continue

    if (acc.platform === "meta") {
      if (isTokenExpired(acc.token_expires_at)) continue
      if (auto.action === "pause_campaign") {
        // Get all active campaigns and pause them
        const cRes = await fetch(
          `https://graph.facebook.com/v21.0/act_${acc.account_id}/campaigns?` +
          new URLSearchParams({ fields: "id,status", access_token: acc.access_token!, filtering: JSON.stringify([{ field: "status", operator: "IN", value: ["ACTIVE"] }]) })
        ).catch(() => null)
        if (!cRes?.ok) continue
        const { data: campaigns = [] } = await cRes.json()
        for (const c of campaigns as { id: string }[]) {
          await fetch(`https://graph.facebook.com/v21.0/${c.id}`, {
            method: "POST",
            body: new URLSearchParams({ status: "PAUSED", access_token: acc.access_token! }),
          }).catch(() => {})
        }
      }
    }
    // Google Ads pause/budget actions require additional GAQL mutations — logged but not executed here
    // in production, use Google Ads MutateOperations
  }
}

async function refreshGoogleToken(
  id: string, refreshToken: string,
  supabase: Awaited<ReturnType<typeof import("@/lib/supabase/server").createClient>>
) {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID, client_secret: GOOGLE_CLIENT_SECRET,
      refresh_token: refreshToken, grant_type: "refresh_token",
    }),
  }).catch(() => null)
  if (!res?.ok) return null
  const { access_token, expires_in } = await res.json()
  const expiresAt = new Date(Date.now() + (expires_in || 3600) * 1000).toISOString()
  await supabase.from("ad_accounts").update({ access_token, token_expires_at: expiresAt }).eq("id", id)
  return access_token as string
}

function isTokenExpired(e: string | null) { return e ? new Date(e) < new Date() : false }
