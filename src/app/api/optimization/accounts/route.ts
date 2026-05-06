import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function GET() {
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()
  const user = session?.user
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 })

  const { data: wsList } = await supabase.from("workspaces").select("id").eq("owner_id", user.id).order("created_at", { ascending: true })
  const workspace = wsList?.[0]
  if (!workspace) return NextResponse.json({ error: "Workspace não encontrado" }, { status: 404 })

  const { data: allAccounts } = await supabase.rpc("get_workspace_ad_accounts", { p_workspace_id: workspace.id })
  const accounts = (allAccounts || [])
    .filter((a: { platform: string; is_active: boolean }) => a.platform === "meta" && a.is_active)
    .map((a: { account_id: string; account_name: string; access_token: string; token_expires_at: string | null }) => ({
      account_id: a.account_id,
      account_name: a.account_name,
      token_expires_at: a.token_expires_at,
      expired: a.token_expires_at ? new Date(a.token_expires_at) < new Date() : false,
    }))

  // For each account, fetch a lightweight campaign list (name + id only)
  const campaignsByAccount: Record<string, { id: string; name: string; status: string }[]> = {}
  for (const account of allAccounts?.filter((a: { platform: string; is_active: boolean; token_expires_at: string | null }) =>
    a.platform === "meta" && a.is_active && !(a.token_expires_at && new Date(a.token_expires_at) < new Date())
  ) || []) {
    try {
      const res = await fetch(
        `https://graph.facebook.com/v21.0/act_${account.account_id}/campaigns?` +
        new URLSearchParams({
          fields: "name,effective_status",
          limit: "200",
          filtering: JSON.stringify([{ field: "effective_status", operator: "IN", value: ["ACTIVE", "PAUSED"] }]),
          access_token: account.access_token,
        })
      )
      if (res.ok) {
        const data = await res.json()
        campaignsByAccount[account.account_id] = (data.data || []).map((c: { id: string; name: string; effective_status: string }) => ({
          id: c.id,
          name: c.name,
          status: c.effective_status,
        }))
      }
    } catch { /* skip */ }
  }

  return NextResponse.json({ accounts, campaignsByAccount })
}
