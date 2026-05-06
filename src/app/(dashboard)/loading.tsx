import { Loader2 } from "lucide-react"

export default function DashboardLoading() {
  return (
    <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <Loader2 className="w-8 h-8 text-[#FF5F1A] animate-spin" />
        <p className="text-sm text-[#71717a]">Carregando...</p>
      </div>
    </div>
  )
}
