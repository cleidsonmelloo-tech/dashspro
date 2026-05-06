import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"

// GET /api/kiwify/stats?since=2025-01-01&until=2025-01-31
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const since = searchParams.get("since") || new Date(Date.now() - 30 * 86400000).toISOString().split("T")[0]
  const until = searchParams.get("until") || new Date().toISOString().split("T")[0]

  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { data: wsList } = await supabase
    .from("workspaces").select("id").eq("owner_id", session.user.id).order("created_at", { ascending: true })
  const workspace = wsList?.[0]
  if (!workspace) return NextResponse.json({ connected: false, stats: null })

  const admin = createAdminClient()
  const { data, error } = await admin.rpc("get_kiwify_stats", {
    p_workspace_id: workspace.id,
    p_since: since,
    p_until: until,
  })

  if (error) {
    console.error("[kiwify/stats]", error.message)
    return NextResponse.json({ connected: false, stats: null })
  }

  const row = data?.[0]
  if (!row || (Number(row.total_sales) === 0 && Number(row.total_revenue) === 0)) {
    return NextResponse.json({ connected: true, stats: null, empty: true })
  }

  return NextResponse.json({
    connected: true,
    stats: {
      total_sales:   Number(row.total_sales),
      total_revenue: Number(row.total_revenue),
      avg_ticket:    Number(row.avg_ticket),
      refunds:       Number(row.refunds),
    }
  })
}
