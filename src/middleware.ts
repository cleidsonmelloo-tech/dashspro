import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

const isSupabaseConfigured =
  SUPABASE_URL &&
  SUPABASE_ANON_KEY &&
  SUPABASE_URL !== "your_supabase_project_url" &&
  SUPABASE_ANON_KEY !== "your_supabase_anon_key"

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  const isAuthRoute =
    pathname.startsWith("/login") ||
    pathname.startsWith("/signup") ||
    pathname.startsWith("/forgot-password")

  // Se Supabase não está configurado, mostra o app sem autenticação
  if (!isSupabaseConfigured) {
    return NextResponse.next({ request })
  }

  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(SUPABASE_URL!, SUPABASE_ANON_KEY!, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value)
        )
        supabaseResponse = NextResponse.next({ request })
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options)
        )
      },
    },
  })

  const { data: { session } } = await supabase.auth.getSession()
  const user = session?.user ?? null

  if (!user && !isAuthRoute) {
    return NextResponse.redirect(new URL("/login", request.url))
  }

  if (user && isAuthRoute) {
    return NextResponse.redirect(new URL("/dashboard", request.url))
  }

  return supabaseResponse
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api/auth|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
}
