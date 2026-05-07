export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col bg-[#0a0a0a] relative">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-[600px] h-[600px] rounded-full bg-[#FF5F1A]/5 blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-[600px] h-[600px] rounded-full bg-[#FF7A33]/5 blur-3xl" />
      </div>

      {/* Conteúdo centralizado */}
      <div className="relative z-10 flex-1 flex items-center justify-center px-4 py-8">
        <div className="w-full max-w-md">
          {children}
        </div>
      </div>

      {/* Rodapé */}
      <footer className="relative z-10 py-4 px-4 text-center">
        <p className="text-xs text-[#71717a]">
          Sistema criado por <span className="font-bold text-[#FF8C42]">CLEIDSON DE MELO</span>
          <span className="hidden sm:inline text-[#52525b]"> • © {new Date().getFullYear()}</span>
        </p>
      </footer>
    </div>
  )
}
