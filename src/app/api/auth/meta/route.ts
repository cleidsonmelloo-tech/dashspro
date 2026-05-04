import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

const META_APP_ID = process.env.META_APP_ID!
const REDIRECT_URI = `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/meta/callback`

// GET /api/auth/meta — inicia o fluxo OAuth
export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.redirect(new URL("/login", request.url))

  const { data: workspace } = await supabase
    .from("workspaces")
    .select("id")
    .eq("owner_id", user.id)
    .single()

  if (!workspace) return NextResponse.redirect(new URL("/onboarding", request.url))

  // Armazena workspace_id no state para recuperar no callback
  const state = Buffer.from(JSON.stringify({ workspace_id: workspace.id, user_id: user.id })).toString("base64url")

  const params = new URLSearchParams({
    client_id: META_APP_ID,
    redirect_uri: REDIRECT_URI,
    scope: "ads_read,ads_management,business_management,read_insights",
    response_type: "code",
    state,
  })

  return NextResponse.redirect(`https://www.facebook.com/v21.0/dialog/oauth?${params}`)
}
