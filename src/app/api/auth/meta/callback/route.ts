import { NextRequest, NextResponse } from "next/server"

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
  const expiresIn = longTokenData.expires_in || 5184000
  const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString()

  // Busca contas de anúncio e info do usuário
  const [accountsRes, meRes] = await Promise.all([
    fetch(`https://graph.facebook.com/v21.0/me/adaccounts?fields=id,name,account_id&access_token=${finalToken}`),
    fetch(`https://graph.facebook.com/v21.0/me?fields=id,name&access_token=${finalToken}`),
  ])

  const accountsData = await accountsRes.json()
  const meData = await meRes.json()
  const accounts: { id: string; name: string; account_id: string }[] = accountsData.data || []

  // Monta payload para salvar via cookie (a sessão do usuário está no browser)
  const payload = accounts.length > 0
    ? accounts.map((a) => ({
        workspace_id: state.workspace_id,
        platform: "meta",
        account_id: a.account_id || a.id.replace("act_", ""),
        account_name: a.name,
        access_token: finalToken,
        token_expires_at: expiresAt,
        is_active: true,
      }))
    : [{
        workspace_id: state.workspace_id,
        platform: "meta",
        account_id: meData.id || "personal",
        account_name: meData.name || "Conta Meta conectada",
        access_token: finalToken,
        token_expires_at: expiresAt,
        is_active: true,
      }]

  // Salva via cookie para o client-side persistir com a sessão autenticada
  const cookieValue = Buffer.from(JSON.stringify(payload)).toString("base64")
  const response = NextResponse.redirect(new URL("/dashboard/configuracoes?meta_pending=1", request.url))
  response.cookies.set("meta_oauth_pending", cookieValue, {
    httpOnly: false, // precisa ser lido pelo client-side
    secure: true,
    sameSite: "lax",
    maxAge: 300, // 5 minutos
    path: "/",
  })

  return response
}
