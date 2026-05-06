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

  const { data: accounts } = await supabase
    .from("ad_accounts")
    .select("id, account_id, account_name, platform")
    .eq("workspace_id", workspace.id)
    .eq("is_active", true)
    .order("platform")
    .order("account_name")

  return NextResponse.json({ accounts: accounts ?? [] })
}
