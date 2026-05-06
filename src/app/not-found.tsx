import Link from "next/link"
import { BarChart3, Home, ArrowLeft } from "lucide-react"

export default function NotFound() {
  return (
    <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center px-4">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-[600px] h-[600px] rounded-full bg-[#FF5F1A]/5 blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-[600px] h-[600px] rounded-full bg-[#FF7A33]/5 blur-3xl" />
      </div>

      <div className="relative z-10 text-center flex flex-col items-center gap-6 max-w-md">
        <div className="flex items-center justify-center w-14 h-14 rounded-2xl bg-[#FF5F1A]/10 border border-[#FF5F1A]/20">
          <BarChart3 className="w-7 h-7 text-[#FF5F1A]" />
        </div>

        <div>
          <p className="text-8xl font-black text-[#1a1410] select-none">404</p>
          <h1 className="text-2xl font-bold text-white mt-2">Página não encontrada</h1>
          <p className="text-sm text-[#71717a] mt-2">
            A página que você está procurando não existe ou foi removida.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/dashboard"
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#FF5F1A] text-white text-sm font-medium hover:bg-[#4f52d1] transition-colors"
          >
            <Home className="w-4 h-4" />
            Ir ao Dashboard
          </Link>
          <Link
            href="javascript:history.back()"
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl border border-[var(--border)] bg-[#131313] text-[#a1a1aa] text-sm font-medium hover:text-white hover:bg-[#1a1410] transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Voltar
          </Link>
        </div>
      </div>
    </div>
  )
}
