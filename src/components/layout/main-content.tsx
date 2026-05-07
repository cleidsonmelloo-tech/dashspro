"use client"

import { useUIStore } from "@/store/ui"
import { cn } from "@/lib/utils"

export function MainContent({ children }: { children: React.ReactNode }) {
  const { sidebarCollapsed } = useUIStore()

  return (
    <main
      className={cn(
        "pt-16 min-h-screen flex flex-col transition-all duration-300 overflow-x-hidden",
        // Mobile: sem padding lateral do sidebar
        "pl-0",
        // Desktop: offset pelo sidebar
        sidebarCollapsed ? "lg:pl-16" : "lg:pl-[260px]"
      )}
    >
      <div className="flex-1 p-3 sm:p-4 lg:p-6 max-w-full">{children}</div>

      {/* Rodapé */}
      <footer className="border-t border-[var(--border)] bg-[#0a0a0a] py-4 px-3 sm:px-4 lg:px-6 mt-6">
        <div className="flex items-center justify-center gap-2 text-xs text-[#71717a]">
          <span>Sistema criado por</span>
          <span className="font-bold text-[#FF8C42]">CLEIDSON DE MELO</span>
          <span className="hidden sm:inline text-[#52525b]">•</span>
          <span className="hidden sm:inline text-[#52525b]">© {new Date().getFullYear()}</span>
        </div>
      </footer>
    </main>
  )
}
