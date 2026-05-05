import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

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
  const expiresIn = longTokenData.expires_in || 5184000 // 60 dias padrão
  const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString()

  // Busca as contas de anúncio disponíveis
  const accountsRes = await fetch(
    `https://graph.facebook.com/v21.0/me/adaccounts?fields=id,name,account_id,currency,account_status&access_token=${finalToken}`
  )
  const accountsData = await accountsRes.json()
  const accounts: { id: string; name: string; account_id: string }[] = accountsData.data || []

  // Busca info do usuário para usar como fallback
  const meRes = await fetch(`https://graph.facebook.com/v21.0/me?fields=id,name&access_token=${finalToken}`)
  const meData = await meRes.json()

  const supabase = await createClient()

  if (accounts.length > 0) {
    for (const account of accounts) {
      await supabase.from("ad_accounts").upsert({
        workspace_id: state.workspace_id,
        platform: "meta",
        account_id: account.account_id || account.id.replace("act_", ""),
        account_name: account.name,
        access_token: finalToken,
        token_expires_at: expiresAt,
        is_active: true,
      }, { onConflict: "workspace_id,platform,account_id" })
    }
  } else {
    // Salva conexão mesmo sem contas de anúncio vinculadas
    await supabase.from("ad_accounts").upsert({
      workspace_id: state.workspace_id,
      platform: "meta",
      account_id: meData.id || "personal",
      account_name: meData.name || "Conta Meta conectada",
      access_token: finalToken,
      token_expires_at: expiresAt,
      is_active: true,
    }, { onConflict: "workspace_id,platform,account_id" })
  }

  return NextResponse.redirect(new URL("/dashboard/configuracoes?success=meta_connected", request.url))
}
