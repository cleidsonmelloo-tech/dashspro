import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

const GOOGLE_DEVELOPER_TOKEN = process.env.GOOGLE_DEVELOPER_TOKEN!
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID!
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET!

// GET /api/filter/campaigns?account_id=xxx
// Returns campaign names (no metrics) for the dropdown filter
export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()
  const user = session?.user
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 })

  const { data: wsList } = await supabase
    .from("workspaces").select("id").eq("owner_id", user.id).order("created_at", { ascending: true })
  const workspace = wsList?.[0]
  if (!workspace) return NextResponse.json({ campaigns: [] })

  const { searchParams } = new URL(request.url)
  const accountId = searchParams.get("account_id")
  if (!accountId) return NextResponse.json({ campaigns: [] })

  // Look up the account via RPC (SECURITY DEFINER) to bypass RLS
  const { data: allAccounts } = await supabase.rpc("get_workspace_ad_accounts", {
    p_workspace_id: workspace.id,
  })
  const account = (allAccounts || []).find(
    (a: { account_id: string; is_active: boolean }) => a.account_id === accountId && a.is_active
  )

  if (!account) return NextResponse.json({ campaigns: [] })

  // ── Meta ──────────────────────────────────────────────────────────────────
  if (account.platform === "meta") {
    if (isTokenExpired(account.token_expires_at)) return NextResponse.json({ campaigns: [] })
    const res = await fetch(
      `https://graph.facebook.com/v21.0/act_${account.account_id}/campaigns?` +
      new URLSearchParams({
        fields: "id,name,status",
        limit: "200",
        access_token: account.access_token,
      })
    )
    if (!res.ok) return NextResponse.json({ campaigns: [] })
    const data = await res.json()
    const campaigns = (data.data || [])
      .filter((c: MetaCampaign) => c.status !== "DELETED" && c.status !== "ARCHIVED")
      .map((c: MetaCampaign) => ({
        id: `meta_${accountId}_${c.id}`,   // mesmo formato da /api/meta/campaigns
        name: c.name,
        account_id: accountId,
        platform: "meta" as const,
      }))
    return NextResponse.json({ campaigns })
  }

  // ── Google ─────────────────────────────────────────────────────────────────
  if (account.platform === "google") {
    let token = account.access_token
    if (isTokenExpired(account.token_expires_at) && account.refresh_token) {
      const refreshed = await refreshGoogleToken(account.refresh_token, supabase, accountId)
      if (!refreshed) return NextResponse.json({ campaigns: [] })
      token = refreshed
    }

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
        body: JSON.stringify({
          query: `SELECT campaign.id, campaign.name FROM campaign WHERE campaign.status != 'REMOVED' ORDER BY campaign.name LIMIT 200`,
        }),
      }
    )
    if (!res.ok) return NextResponse.json({ campaigns: [] })
    const data = await res.json()
    const campaigns = (data.results || []).map((r: GoogleRow) => ({
      id: `google_${accountId}_${r.campaign.id}`,   // mesmo formato da /api/google/campaigns
      name: r.campaign.name,
      account_id: accountId,
      platform: "google" as const,
    }))
    return NextResponse.json({ campaigns })
  }

  return NextResponse.json({ campaigns: [] })
}

interface MetaCampaign { id: string; name: string; status: string }
interface GoogleRow { campaign: { id: string; name: string } }

async function refreshGoogleToken(
  refreshToken: string,
  supabase: Awaited<ReturnType<typeof createClient>>,
  accountId: string,
): Promise<string | null> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID, client_secret: GOOGLE_CLIENT_SECRET,
      refresh_token: refreshToken, grant_type: "refresh_token",
    }),
  })
  if (!res.ok) return null
  const { access_token, expires_in } = await res.json()
  const expiresAt = new Date(Date.now() + (expires_in || 3600) * 1000).toISOString()
  await supabase.from("ad_accounts").update({ access_token, token_expires_at: expiresAt }).eq("account_id", accountId)
  return access_token
}

function isTokenExpired(e: string | null) { return e ? new Date(e) < new Date() : false }
