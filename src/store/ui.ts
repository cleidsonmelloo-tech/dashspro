import { create } from "zustand"
import { persist } from "zustand/middleware"

interface UIStore {
  sidebarCollapsed: boolean
  mobileSidebarOpen: boolean
  toggleSidebar: () => void
  setSidebarCollapsed: (v: boolean) => void
  setMobileSidebarOpen: (v: boolean) => void
  toggleMobileSidebar: () => void
}

export const useUIStore = create<UIStore>()(
  persist(
    (set) => ({
      sidebarCollapsed: false,
      mobileSidebarOpen: false,
      toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
      setSidebarCollapsed: (v) => set({ sidebarCollapsed: v }),
      setMobileSidebarOpen: (v) => set({ mobileSidebarOpen: v }),
      toggleMobileSidebar: () => set((s) => ({ mobileSidebarOpen: !s.mobileSidebarOpen })),
    }),
    { name: "dashspro-ui", partialize: (s) => ({ sidebarCollapsed: s.sidebarCollapsed }) }
  )
)
