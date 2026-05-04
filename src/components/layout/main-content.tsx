"use client"

import { useUIStore } from "@/store/ui"
import { cn } from "@/lib/utils"

export function MainContent({ children }: { children: React.ReactNode }) {
  const { sidebarCollapsed } = useUIStore()

  return (
    <main
      className={cn(
        "pt-16 min-h-screen transition-all duration-300",
        // Mobile: sem padding lateral do sidebar
        "pl-0",
        // Desktop: offset pelo sidebar
        sidebarCollapsed ? "lg:pl-16" : "lg:pl-[260px]"
      )}
    >
      <div className="p-4 sm:p-6">{children}</div>
    </main>
  )
}
