import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "DashsPro — Gestão de Tráfego Pago",
  description: "Dashboard profissional para gestores de tráfego, agências e infoprodutores",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR" className={inter.className}>
      <body className="min-h-screen bg-[#0a0a0f] text-[#f4f4f5] antialiased">
        {children}
      </body>
    </html>
  );
}
