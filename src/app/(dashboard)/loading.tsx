import { Loader2 } from "lucide-react"

export default function DashboardLoading() {
  return (
    <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <Loader2 className="w-8 h-8 text-[#6366f1] animate-spin" />
        <p className="text-sm text-[#71717a]">Carregando...</p>
      </div>
    </div>
  )
}
