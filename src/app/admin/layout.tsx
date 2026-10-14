import type { ReactNode } from "react";
import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { Brand } from "@/components/Brand";

export const dynamic = "force-dynamic";
export const metadata = { title: { default: "Administração", template: "%s · Admin" } };

const NAV = [
  ["/admin", "Visão geral"],
  ["/admin/conteudo", "Conteúdo musical"],
  ["/admin/usuarios", "Usuários"],
  ["/admin/denuncias", "Denúncias"],
  ["/admin/suporte", "Suporte"],
  ["/admin/home", "Página inicial"],
  ["/admin/configuracoes", "Configurações"],
  ["/admin/auditoria", "Auditoria"],
];

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const admin = await requireAdmin();
  const s = await getSettings();
  return (
    <div className="min-h-dvh bg-black md:flex">
      <aside className="border-b border-white/10 bg-[#0b0b0b] p-4 md:sticky md:top-0 md:h-dvh md:w-64 md:shrink-0 md:overflow-y-auto md:border-b-0 md:border-r">
        <Brand name={s.siteName} logoUrl={s.logoUrl} size={24} href="/admin" />
        <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-white/40">Painel administrativo</p>
        <nav className="mt-4 flex gap-1 overflow-x-auto md:flex-col" aria-label="Admin">
          {NAV.map(([h, l]) => <Link key={h} href={h} className="shrink-0 rounded-lg px-3 py-2 text-sm font-medium text-white/65 hover:bg-white/10 hover:text-white">{l}</Link>)}
        </nav>
        <div className="mt-4 border-t border-white/10 pt-4 text-xs text-white/45 md:mt-8">
          <p className="truncate">{admin.email}</p>
          <Link href="/" className="mt-2 inline-block underline hover:text-white">Voltar ao app</Link>
        </div>
      </aside>
      <main className="min-w-0 flex-1 p-4 md:p-8">{children}</main>
    </div>
  );
}
