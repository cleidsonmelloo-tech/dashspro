"use client"

import { useEffect } from "react"
import { BarChart3, RefreshCw, Home } from "lucide-react"

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center px-4">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-[600px] h-[600px] rounded-full bg-red-500/5 blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-[600px] h-[600px] rounded-full bg-[#8b5cf6]/5 blur-3xl" />
      </div>

      <div className="relative z-10 text-center flex flex-col items-center gap-6 max-w-md">
        <div className="flex items-center justify-center w-14 h-14 rounded-2xl bg-red-500/10 border border-red-500/20">
          <BarChart3 className="w-7 h-7 text-red-400" />
        </div>

        <div>
          <h1 className="text-2xl font-bold text-white">Algo deu errado</h1>
          <p className="text-sm text-[#71717a] mt-2">
            Ocorreu um erro inesperado. Tente novamente ou volte ao dashboard.
          </p>
          {error.digest && (
            <p className="text-xs text-[#52525b] mt-2 font-mono">ID: {error.digest}</p>
          )}
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={reset}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#6366f1] text-white text-sm font-medium hover:bg-[#4f52d1] transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Tentar novamente
          </button>
          <a
            href="/dashboard"
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl border border-[var(--border)] bg-[#111118] text-[#a1a1aa] text-sm font-medium hover:text-white hover:bg-[#1e1e2e] transition-colors"
          >
            <Home className="w-4 h-4" />
            Ir ao Dashboard
          </a>
        </div>
      </div>
    </div>
  )
}
