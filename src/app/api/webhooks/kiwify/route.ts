import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"

// POST /api/webhooks/kiwify?workspace_id=WORKSPACE_ID
// Kiwify sends events here on every sale/refund
export async function POST(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const workspaceId = searchParams.get("workspace_id")

  if (!workspaceId) {
    return NextResponse.json({ error: "workspace_id required" }, { status: 400 })
  }

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  // Kiwify webhook payload structure
  const type        = (body.type as string) || "order.approved"
  const order       = (body.data as Record<string, unknown>) || body
  const product     = (order.product as Record<string, unknown>) || {}
  const payment     = (order.payment as Record<string, unknown>) || {}
  const customer    = (order.customer as Record<string, unknown>) || {}
  const orderId     = (order.id || order.order_id || order.checkout_id) as string
  const productName = (order.product_name || product.name || "Produto") as string
  const productId   = (order.product_id || product.id || "") as string
  const amount      = parseFloat(String(order.amount || order.price || order.total || 0))
  const commission  = parseFloat(String(order.commission || order.producer_value || 0))
  const status      = (order.status === "refunded" || type === "order.refunded") ? "refunded" : "paid"
  const payMethod   = (order.payment_method || payment.method || "") as string
  const custName    = (customer.name || order.buyer_name || "") as string
  const custEmail   = (customer.email || order.buyer_email || "") as string

  if (!orderId) {
    console.warn("[kiwify/webhook] No order_id found in payload", JSON.stringify(body))
    return NextResponse.json({ ok: true, skipped: true })
  }

  const supabase = createAdminClient()
  const { error } = await supabase.from("kiwify_sales").upsert({
    workspace_id:   workspaceId,
    order_id:       orderId,
    event_type:     type,
    product_name:   productName,
    product_id:     productId,
    amount,
    commission,
    status,
    payment_method: payMethod,
    customer_name:  custName,
    customer_email: custEmail,
    raw_payload:    body,
    created_at:     new Date().toISOString(),
  }, { onConflict: "workspace_id,order_id" })

  if (error) {
    console.error("[kiwify/webhook] upsert error:", error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  console.log(`[kiwify/webhook] saved order ${orderId} (${status}) R$ ${amount}`)
  return NextResponse.json({ ok: true })
}

// Kiwify sometimes sends a GET to verify the endpoint
export async function GET() {
  return NextResponse.json({ ok: true, service: "dashspro-kiwify-webhook" })
}
