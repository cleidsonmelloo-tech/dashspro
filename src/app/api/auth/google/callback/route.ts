import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID!
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET!
const GOOGLE_DEVELOPER_TOKEN = process.env.GOOGLE_DEVELOPER_TOKEN!
const REDIRECT_URI = `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/google/callback`

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get("code")
  const stateRaw = searchParams.get("state")
  const errorParam = searchParams.get("error")

  if (errorParam) {
    return NextResponse.redirect(new URL("/dashboard/configuracoes?error=google_denied", request.url))
  }
  if (!code || !stateRaw) {
    return NextResponse.redirect(new URL("/dashboard/configuracoes?error=google_invalid", request.url))
  }

  let state: { workspace_id: string; user_id: string }
  try {
    state = JSON.parse(Buffer.from(stateRaw, "base64url").toString())
  } catch {
    return NextResponse.redirect(new URL("/dashboard/configuracoes?error=google_state", request.url))
  }

  // Troca code por tokens
  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      redirect_uri: REDIRECT_URI,
      grant_type: "authorization_code",
    }),
  })

  if (!tokenRes.ok) {
    return NextResponse.redirect(new URL("/dashboard/configuracoes?error=google_token", request.url))
  }

  const tokenData = await tokenRes.json()
  const { access_token, refresh_token, expires_in } = tokenData
  const expiresAt = new Date(Date.now() + (expires_in || 3600) * 1000).toISOString()

  // Busca as contas do Google Ads vinculadas
  const accountsRes = await fetch(
    "https://googleads.googleapis.com/v17/customers:listAccessibleCustomers",
    {
      headers: {
        Authorization: `Bearer ${access_token}`,
        "developer-token": GOOGLE_DEVELOPER_TOKEN,
      },
    }
  )

  const supabase = await createClient()

  if (accountsRes.ok) {
    const { resourceNames } = await accountsRes.json()
    const customerIds: string[] = (resourceNames || []).map((r: string) => r.replace("customers/", ""))

    for (const customerId of customerIds.slice(0, 10)) {
      // Busca nome da conta
      const infoRes = await fetch(
        `https://googleads.googleapis.com/v17/customers/${customerId}?fields=customer.descriptive_name,customer.id`,
        {
          headers: {
            Authorization: `Bearer ${access_token}`,
            "developer-token": GOOGLE_DEVELOPER_TOKEN,
            "login-customer-id": customerId,
          },
        }
      )

      let accountName = `Google Ads (${customerId})`
      if (infoRes.ok) {
        const info = await infoRes.json()
        accountName = info.customer?.descriptiveName || accountName
      }

      await supabase.from("ad_accounts").upsert({
        workspace_id: state.workspace_id,
        platform: "google",
        account_id: customerId,
        account_name: accountName,
        access_token,
        refresh_token,
        token_expires_at: expiresAt,
        is_active: true,
      }, { onConflict: "workspace_id,platform,account_id" })
    }
  }

  return NextResponse.redirect(new URL("/dashboard/configuracoes?success=google_connected", request.url))
}
