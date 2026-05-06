import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"

const META_APP_ID = process.env.META_APP_ID!
const META_APP_SECRET = process.env.META_APP_SECRET!
const REDIRECT_URI = `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/meta/callback`

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get("code")
  const stateRaw = searchParams.get("state")
  const errorParam = searchParams.get("error")

  if (errorParam) {
    return NextResponse.redirect(new URL("/dashboard/configuracoes?error=meta_denied", request.url))
  }

  if (!code || !stateRaw) {
    return NextResponse.redirect(new URL("/dashboard/configuracoes?error=meta_invalid", request.url))
  }

  let state: { workspace_id: string; user_id: string }
  try {
    state = JSON.parse(Buffer.from(stateRaw, "base64url").toString())
  } catch {
    return NextResponse.redirect(new URL("/dashboard/configuracoes?error=meta_state", request.url))
  }

  // Troca code por access_token
  const tokenRes = await fetch(
    `https://graph.facebook.com/v21.0/oauth/access_token?` +
    new URLSearchParams({
      client_id: META_APP_ID,
      client_secret: META_APP_SECRET,
      redirect_uri: REDIRECT_URI,
      code,
    })
  )

  if (!tokenRes.ok) {
    const errBody = await tokenRes.text()
    console.error("[meta/callback] token exchange failed:", errBody, "redirect_uri:", REDIRECT_URI)
    return NextResponse.redirect(new URL("/dashboard/configuracoes?error=meta_token", request.url))
  }

  const { access_token } = await tokenRes.json()

  // Busca token de longa duração
  const longTokenRes = await fetch(
    `https://graph.facebook.com/v21.0/oauth/access_token?` +
    new URLSearchParams({
      grant_type: "fb_exchange_token",
      client_id: META_APP_ID,
      client_secret: META_APP_SECRET,
      fb_exchange_token: access_token,
    })
  )

  const longTokenData = await longTokenRes.json()
  const finalToken = longTokenData.access_token || access_token
  const expiresIn = longTokenData.expires_in || 5184000
  const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString()

  // Busca contas de anúncio pessoais + via Business Manager
  const [personalAccountsRes, businessesRes] = await Promise.all([
    fetch(`https://graph.facebook.com/v21.0/me/adaccounts?fields=id,name,account_id&limit=200&access_token=${finalToken}`),
    fetch(`https://graph.facebook.com/v21.0/me/businesses?fields=id,name&limit=50&access_token=${finalToken}`),
  ])

  const personalData = await personalAccountsRes.json()
  const businessesData = await businessesRes.json()

  let allAccounts: { id: string; name: string; account_id: string }[] = personalData.data || []

  for (const biz of (businessesData.data || [])) {
    const [ownedRes, clientRes] = await Promise.all([
      fetch(`https://graph.facebook.com/v21.0/${biz.id}/owned_ad_accounts?fields=id,name,account_id&limit=200&access_token=${finalToken}`),
      fetch(`https://graph.facebook.com/v21.0/${biz.id}/client_ad_accounts?fields=id,name,account_id&limit=200&access_token=${finalToken}`),
    ])
    const ownedData = await ownedRes.json()
    const clientData = await clientRes.json()
    allAccounts = [...allAccounts, ...(ownedData.data || []), ...(clientData.data || [])]
  }

  // Remove duplicatas
  const seen = new Set<string>()
  const accounts = allAccounts.filter((a) => {
    const id = a.account_id || a.id.replace("act_", "")
    if (seen.has(id)) return false
    seen.add(id)
    return true
  })

  console.log("[meta/callback] saving", accounts.length, "accounts to Supabase")

  // Salva direto no Supabase server-side (sem passar pela URL)
  const supabase = createAdminClient()
  let savedCount = 0
  for (const a of accounts) {
    const accountId = a.account_id || a.id.replace("act_", "")
    const { error } = await supabase.rpc("upsert_ad_account", {
      p_workspace_id: state.workspace_id,
      p_platform: "meta",
      p_account_id: accountId,
      p_account_name: a.name,
      p_access_token: finalToken,
      p_token_expires_at: expiresAt,
      p_is_active: true,
    })
    if (error) {
      console.error("[meta/callback] upsert error for", accountId, error.message)
    } else {
      savedCount++
    }
  }

  console.log("[meta/callback] saved", savedCount, "/", accounts.length, "accounts")

  return NextResponse.redirect(new URL("/dashboard/configuracoes?success=meta_connected", request.url))
}
