import { NextRequest, NextResponse } from "next/server"

// Vercel Cron Job — runs every hour (see vercel.json)
// Calls the optimization run endpoint for all active workspaces
export async function GET(request: NextRequest) {
  // Vercel cron jobs call with Authorization: Bearer <CRON_SECRET>
  const authHeader = request.headers.get("authorization")
  const cronSecret = process.env.CRON_SECRET

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || `https://${request.headers.get("host")}`
    const res = await fetch(`${baseUrl}/api/optimization/run`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-cron-secret": cronSecret || "",
      },
      body: JSON.stringify({ cron: true }),
    })

    const data = await res.json()
    console.log("[cron/optimization] result:", JSON.stringify(data))
    return NextResponse.json({ ok: true, ...data })
  } catch (err) {
    console.error("[cron/optimization] error:", err)
    return NextResponse.json({ error: "Internal error" }, { status: 500 })
  }
}
