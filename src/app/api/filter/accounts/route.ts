import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

// GET /api/filter/accounts — returns all active ad accounts (no metrics, lightweight)
export async function GET() {
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()
  const user = session?.user
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 })

  const { data: wsList } = await supabase
    .from("workspaces").select("id").eq("owner_id", user.id).order("created_at", { ascending: true })
  const workspace = wsList?.[0]
  if (!workspace) return NextResponse.json({ accounts: [] })

  // Use RPC (SECURITY DEFINER) to bypass RLS — same pattern as /api/meta/campaigns
  const { data: allAccounts } = await supabase.rpc("get_workspace_ad_accounts", {
    p_workspace_id: workspace.id,
  })

  const accounts = (allAccounts || [])
    .filter((a: { is_active: boolean }) => a.is_active)
    .map((a: { id: string; account_id: string; account_name: string; platform: string }) => ({
      id: a.id,
      account_id: a.account_id,
      account_name: a.account_name,
      platform: a.platform,
    }))
    .sort((a: { platform: string; account_name: string }, b: { platform: string; account_name: string }) => {
      if (a.platform !== b.platform) return a.platform.localeCompare(b.platform)
      return a.account_name.localeCompare(b.account_name)
    })

  return NextResponse.json({ accounts })
}
