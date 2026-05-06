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
    const errBody = await tokenRes.text()
    console.error("[meta/callback] token exchange failed:", errBody, "redirect_uri used:", REDIRECT_URI)
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

  // Busca contas de anúncio pessoais + via Business Manager + info do usuário
  const [personalAccountsRes, businessesRes, meRes] = await Promise.all([
    fetch(`https://graph.facebook.com/v21.0/me/adaccounts?fields=id,name,account_id&limit=200&access_token=${finalToken}`),
    fetch(`https://graph.facebook.com/v21.0/me/businesses?fields=id,name&limit=50&access_token=${finalToken}`),
    fetch(`https://graph.facebook.com/v21.0/me?fields=id,name&access_token=${finalToken}`),
  ])

  const personalData = await personalAccountsRes.json()
  const businessesData = await businessesRes.json()
  const meData = await meRes.json()

  console.log("[meta/callback] personal accounts:", JSON.stringify(personalData?.data?.map((a: {id:string;name:string}) => ({id:a.id,name:a.name}))))
  console.log("[meta/callback] businesses:", JSON.stringify(businessesData?.data?.map((b: {id:string;name:string}) => ({id:b.id,name:b.name}))))

  // Combina contas pessoais + contas das BMs (busca separada por business)
  let allAccounts: { id: string; name: string; account_id: string }[] = personalData.data || []

  for (const biz of (businessesData.data || [])) {
    // Busca owned_ad_accounts para cada BM separadamente
    const bizAccountsRes = await fetch(
      `https://graph.facebook.com/v21.0/${biz.id}/owned_ad_accounts?fields=id,name,account_id&limit=200&access_token=${finalToken}`
    )
    const bizAccountsData = await bizAccountsRes.json()
    console.log(`[meta/callback] BM ${biz.id} (${biz.name}) accounts:`, JSON.stringify(bizAccountsData?.data?.map((a: {id:string;name:string}) => ({id:a.id,name:a.name}))))
    const bizAccounts: { id: string; name: string; account_id: string }[] = bizAccountsData.data || []
    allAccounts = [...allAccounts, ...bizAccounts]

    // Também tenta client_ad_accounts (contas que a BM gerencia mas não é dona)
    const clientAccountsRes = await fetch(
      `https://graph.facebook.com/v21.0/${biz.id}/client_ad_accounts?fields=id,name,account_id&limit=200&access_token=${finalToken}`
    )
    const clientAccountsData = await clientAccountsRes.json()
    const clientAccounts: { id: string; name: string; account_id: string }[] = clientAccountsData.data || []
    allAccounts = [...allAccounts, ...clientAccounts]
  }

  console.log("[meta/callback] total accounts before dedup:", allAccounts.length)

  // Remove duplicatas pelo account_id
  const seen = new Set<string>()
  const accounts = allAccounts.filter((a) => {
    const id = a.account_id || a.id.replace("act_", "")
    if (seen.has(id)) return false
    seen.add(id)
    return true
  })

  console.log("[meta/callback] final unique accounts:", accounts.map(a => ({ id: a.account_id || a.id, name: a.name })))

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

  // Passa dados via URL para o client-side salvar com a sessão autenticada
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url")
  return NextResponse.redirect(new URL(`/dashboard/configuracoes?meta_data=${encoded}`, request.url))
}
