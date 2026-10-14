import type { ReactNode } from "react";
import Link from "next/link";
import { getSettings } from "@/lib/settings";
import { Brand } from "@/components/Brand";

export const dynamic = "force-dynamic";

export default async function AuthLayout({ children }: { children: ReactNode }) {
  const s = await getSettings();
  return (
    <div className="relative flex min-h-dvh flex-col items-center overflow-hidden bg-black px-6 py-10">
      <div className="pointer-events-none absolute -right-32 -top-32 h-[460px] w-[460px] animate-drift rounded-full opacity-60 blur-[80px]" style={{ background: "radial-gradient(circle, rgba(255,255,255,0.25), transparent 70%)" }} />
      <div className="pointer-events-none absolute -bottom-40 -left-32 h-[420px] w-[420px] animate-drift rounded-full opacity-35 blur-[90px]" style={{ background: "radial-gradient(circle, rgba(255,255,255,0.2), transparent 70%)", animationDelay: "-7s" }} />
      <div className="relative flex w-full max-w-[380px] flex-1 flex-col justify-center">
        <div className="mb-8 flex justify-center"><Brand name={s.siteName} logoUrl={s.logoUrl} size={48} /></div>
        {children}
      </div>
      <footer className="relative mt-10 flex flex-wrap justify-center gap-5 text-xs text-white/40">
        <span>© {new Date().getFullYear()} {s.siteName}</span>
        <Link href="/sobre-o-aplicativo" className="hover:text-white">Sobre o aplicativo</Link>
        <Link href="/termos" className="hover:text-white">Termos</Link>
        <Link href="/privacidade" className="hover:text-white">Privacidade</Link>
      </footer>
    </div>
  );
}
