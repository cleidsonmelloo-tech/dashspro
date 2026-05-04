"use client"

import { useState, useTransition } from "react"
import Link from "next/link"
import { Mail, BarChart3, ArrowLeft, CheckCircle2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { forgotPassword } from "@/app/actions/auth"

export default function ForgotPasswordPage() {
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")
  const [isPending, startTransition] = useTransition()

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError("")
    const formData = new FormData(e.currentTarget)

    startTransition(async () => {
      const result = await forgotPassword(formData)
      if (result?.error) setError(result.error)
      if (result?.success) setSuccess(result.success)
    })
  }

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col items-center gap-3">
        <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-[#6366f1]">
          <BarChart3 className="w-6 h-6 text-white" />
        </div>
        <div className="text-center">
          <h1 className="text-2xl font-bold text-white">Recuperar senha</h1>
          <p className="text-sm text-[#71717a] mt-1">Enviaremos um link para seu email</p>
        </div>
      </div>

      <div className="rounded-2xl border border-[#27272a] bg-[#111118] p-8 flex flex-col gap-6">
        {success ? (
          <div className="flex flex-col items-center gap-4 text-center py-2">
            <div className="w-14 h-14 rounded-full bg-emerald-500/10 flex items-center justify-center">
              <CheckCircle2 className="w-7 h-7 text-emerald-400" />
            </div>
            <p className="text-sm text-[#a1a1aa]">{success}</p>
          </div>
        ) : (
          <>
            {error && (
              <div className="rounded-lg bg-red-500/10 border border-red-500/20 px-4 py-3 text-sm text-red-400">
                {error}
              </div>
            )}
            <form onSubmit={handleSubmit} className="flex flex-col gap-5">
              <Input
                name="email"
                label="Email cadastrado"
                type="email"
                placeholder="seu@email.com"
                leftIcon={<Mail className="w-4 h-4" />}
                required
              />
              <Button type="submit" loading={isPending} className="w-full h-11">
                {isPending ? "Enviando..." : "Enviar link de recuperação"}
              </Button>
            </form>
          </>
        )}

        <Link
          href="/login"
          className="flex items-center justify-center gap-2 text-sm text-[#71717a] hover:text-[#f4f4f5] transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Voltar ao login
        </Link>
      </div>
    </div>
  )
}
