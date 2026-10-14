"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPlaylist, logoutAction } from "@/app/actions";
import { Brand } from "@/components/Brand";
import { Cover } from "@/components/Cover";
import { SearchBox } from "@/components/SearchBox";
import { PlayerBar } from "@/components/PlayerBar";
import { useUi } from "@/components/UiProvider";
import {
  IconBell, IconChevronLeft, IconChevronRight, IconClock, IconHeart, IconHome, IconLibrary, IconPlus, IconSearch, IconUser,
} from "@/components/Icons";

type ShellProps = {
  user: { id: string; username: string; displayName: string; avatarUrl: string | null; role: string } | null;
  siteName: string;
  logoUrl: string;
  links: { label: string; url: string }[];
  unread: number;
  social: boolean;
  announcement: string;
  playlists: { id: string; name: string; cover: string | null }[];
  children: ReactNode;
};

export function Shell({ user, siteName, logoUrl, links, unread, social, announcement, playlists, children }: ShellProps) {
  const path = usePathname();
  const router = useRouter();
  const ui = useUi();
  const [menu, setMenu] = useState(false);
  const [installEvt, setInstallEvt] = useState<(Event & { prompt: () => Promise<void> }) | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const h = (e: Event) => {
      e.preventDefault();
      setInstallEvt(e as Event & { prompt: () => Promise<void> });
    };
    window.addEventListener("beforeinstallprompt", h);
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(() => {});
    return () => window.removeEventListener("beforeinstallprompt", h);
  }, []);
  useEffect(() => setMenu(false), [path]);
  useEffect(() => {
    const h = (e: MouseEvent) => menuRef.current && !menuRef.current.contains(e.target as Node) && setMenu(false);
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  const active = (href: string) => (href === "/" ? path === "/" : path.startsWith(href));
  const nav = [
    { href: "/", label: "Início", icon: IconHome },
    { href: "/buscar", label: "Buscar", icon: IconSearch },
    { href: "/biblioteca", label: "Biblioteca", icon: IconLibrary },
  ];

  async function newPlaylist() {
    if (ui.needLogin()) return;
    const r = await createPlaylist("Nova playlist");
    if (!r.ok) return ui.toast(r.error, "error");
    router.push(`/playlist/${r.id}`);
    router.refresh();
  }

  const avatar = user && (
    <button onClick={() => setMenu((m) => !m)} aria-label="Menu da conta" aria-expanded={menu} className="grid h-10 w-10 place-items-center overflow-hidden rounded-full border border-white/20 bg-[#222] text-sm font-bold transition hover:border-white">
      {user.avatarUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={user.avatarUrl} alt="" className="h-full w-full object-cover" />
      ) : (
        user.displayName.charAt(0).toUpperCase()
      )}
    </button>
  );

  return (
    <div className="mx-auto min-h-dvh w-full max-w-[1600px] md:h-dvh md:overflow-hidden">
      <div className="flex min-h-dvh gap-2 md:h-full md:p-2 md:pb-[92px]">
        {/* Barra lateral */}
        <aside className="hidden w-[300px] shrink-0 flex-col gap-2 lg:flex xl:w-[330px]">
          <div className="rounded-xl bg-[#0c0c0c] p-5">
            <Brand name={siteName} logoUrl={logoUrl} />
            <nav className="mt-6 space-y-1" aria-label="Principal">
              {nav.slice(0, 2).map((n) => (
                <Link key={n.href} href={n.href} className={`flex items-center gap-4 rounded-lg px-2 py-2 text-[15px] font-semibold transition ${active(n.href) ? "text-white" : "text-white/55 hover:text-white"}`}>
                  <n.icon size={24} /> {n.label}
                </Link>
              ))}
            </nav>
          </div>
          <div className="flex min-h-0 flex-1 flex-col rounded-xl bg-[#0c0c0c]">
            <div className="flex items-center justify-between px-5 pb-2 pt-4">
              <Link href="/biblioteca" className={`flex items-center gap-3 text-[15px] font-semibold ${active("/biblioteca") ? "text-white" : "text-white/55 hover:text-white"}`}>
                <IconLibrary size={24} /> Sua biblioteca
              </Link>
              <button onClick={newPlaylist} aria-label="Criar playlist" title="Criar playlist" className="icon-btn !h-9 !w-9 bg-white/5"><IconPlus size={18} /></button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-2">
              {user ? (
                <>
                  <Link href="/biblioteca?aba=curtidas" className="flex items-center gap-3 rounded-lg p-2 hover:bg-white/[0.07]">
                    <span className="grid h-12 w-12 place-items-center rounded-md bg-white text-black"><IconHeart size={20} filled /></span>
                    <span><span className="block text-sm font-semibold">Músicas curtidas</span><span className="text-xs text-white/45">Playlist automática</span></span>
                  </Link>
                  <Link href="/historico" className="flex items-center gap-3 rounded-lg p-2 hover:bg-white/[0.07]">
                    <span className="grid h-12 w-12 place-items-center rounded-md bg-[#1f1f1f]"><IconClock size={20} /></span>
                    <span><span className="block text-sm font-semibold">Histórico</span><span className="text-xs text-white/45">O que você ouviu</span></span>
                  </Link>
                  {playlists.map((p) => (
                    <Link key={p.id} href={`/playlist/${p.id}`} className={`flex items-center gap-3 rounded-lg p-2 hover:bg-white/[0.07] ${path === `/playlist/${p.id}` ? "bg-white/[0.07]" : ""}`}>
                      <div className="h-12 w-12 shrink-0"><Cover src={p.cover} seed={p.id} title={p.name} /></div>
                      <span className="min-w-0"><span className="block truncate text-sm font-semibold">{p.name}</span><span className="text-xs text-white/45">Playlist</span></span>
                    </Link>
                  ))}
                  {playlists.length === 0 && <p className="px-3 py-4 text-sm text-white/45">Crie sua primeira playlist com o botão +.</p>}
                </>
              ) : (
                <div className="m-2 rounded-xl bg-[#1a1a1a] p-5">
                  <p className="font-bold">Crie sua biblioteca</p>
                  <p className="mt-1 text-sm text-white/55">Entre para curtir músicas, criar playlists e seguir artistas.</p>
                  <Link href="/cadastro" className="btn-primary mt-4">Criar conta</Link>
                </div>
              )}
            </div>
            <footer className="flex flex-wrap gap-x-4 gap-y-1 border-t border-white/10 px-5 py-3 text-[11px] text-white/40">
              <Link href="/ajuda" className="hover:text-white">Ajuda e suporte</Link>
              <Link href="/sobre-o-aplicativo" className="font-semibold text-white/60 hover:text-white">Sobre o aplicativo</Link>
              <Link href="/termos" className="hover:text-white">Termos</Link>
              <Link href="/privacidade" className="hover:text-white">Privacidade</Link>
              <Link href="/sobre" className="hover:text-white">Sobre</Link>
              {links.map((l) => (
                <a key={l.url} href={l.url} className="hover:text-white" {...(l.url.startsWith("http") ? { target: "_blank", rel: "noopener noreferrer" } : {})}>{l.label}</a>
              ))}
            </footer>
          </div>
        </aside>

        {/* Conteúdo */}
        <div className="relative flex min-w-0 flex-1 flex-col md:overflow-hidden md:rounded-xl md:bg-[#101010]">
          <header className="sticky top-0 z-30 flex items-center gap-3 bg-black/85 px-4 py-3 backdrop-blur-md md:static md:bg-transparent md:px-6 md:py-4">
            <div className="hidden gap-2 md:flex">
              <button aria-label="Voltar" onClick={() => router.back()} className="grid h-9 w-9 place-items-center rounded-full bg-black/60 hover:bg-black"><IconChevronLeft size={20} /></button>
              <button aria-label="Avançar" onClick={() => router.forward()} className="grid h-9 w-9 place-items-center rounded-full bg-black/60 hover:bg-black"><IconChevronRight size={20} /></button>
            </div>
            <div className="lg:hidden"><Brand name={siteName} logoUrl={logoUrl} size={26} /></div>
            <div className="mx-auto hidden w-full max-w-xl md:block">
              <SearchBox loggedIn={!!user} />
            </div>
            <div className="ml-auto flex items-center gap-2 md:ml-0">
              {user ? (
                <>
                  <Link href="/notificacoes" aria-label={`Notificações${unread ? ` (${unread} novas)` : ""}`} className="relative grid h-10 w-10 place-items-center rounded-full text-white/75 hover:bg-white/10 hover:text-white">
                    <IconBell size={21} />
                    {unread > 0 && <span className="absolute right-1.5 top-1.5 grid h-4 min-w-4 place-items-center rounded-full bg-white px-1 text-[10px] font-bold text-black">{unread > 9 ? "9+" : unread}</span>}
                  </Link>
                  <div ref={menuRef} className="relative">
                    {avatar}
                    {menu && (
                      <div role="menu" className="absolute right-0 top-12 z-50 w-60 animate-rise overflow-hidden rounded-xl border border-white/10 bg-[#161616] py-1.5 shadow-2xl shadow-black">
                        <div className="border-b border-white/10 px-4 py-3">
                          <div className="truncate text-sm font-semibold">{user.displayName}</div>
                          <div className="truncate text-xs text-white/45">@{user.username}</div>
                        </div>
                        <MenuLink href={`/perfil/${user.username}`}>Perfil</MenuLink>
                        <MenuLink href="/configuracoes">Configurações</MenuLink>
                        <MenuLink href="/historico">Histórico</MenuLink>
                        <MenuLink href="/biblioteca">Biblioteca</MenuLink>
                        <MenuLink href="/ajuda">Ajuda e suporte</MenuLink>
                        <MenuLink href="/sobre-o-aplicativo">Sobre o aplicativo</MenuLink>
                        {(user.role === "artist" || user.role === "admin") && <MenuLink href="/estudio">Estúdio do artista</MenuLink>}
                        {user.role === "admin" && <MenuLink href="/admin">Painel administrativo</MenuLink>}
                        {installEvt && (
                          <button onClick={() => installEvt.prompt()} className="block w-full px-4 py-2 text-left text-sm hover:bg-white/10">Instalar aplicativo</button>
                        )}
                        <form action={logoutAction} className="border-t border-white/10">
                          <button className="block w-full px-4 py-2.5 text-left text-sm hover:bg-white/10">Sair</button>
                        </form>
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <>
                  {installEvt && <button onClick={() => installEvt.prompt()} className="btn-outline hidden sm:inline-flex">Instalar app</button>}
                  <Link href="/cadastro" className="hidden px-3 text-sm font-bold text-white/70 hover:text-white sm:block">Criar conta</Link>
                  <Link href="/entrar" className="btn-primary !h-10 !px-5">Entrar</Link>
                </>
              )}
            </div>
          </header>

          {announcement && <div className="border-y border-white/10 bg-white/5 px-6 py-2 text-center text-sm text-white/80">{announcement}</div>}

          <main id="conteudo" className="flex-1 px-4 pb-[calc(11rem+env(safe-area-inset-bottom))] pt-3 md:overflow-y-auto md:px-8 md:pb-10 md:pt-2">
            {children}
            {!social && null}
          </main>
        </div>
      </div>

      <PlayerBar />

      {/* Navegação inferior (celular e tablet) */}
      <nav aria-label="Navegação" className="fixed inset-x-0 bottom-0 z-40 flex border-t border-white/10 bg-black/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden">
        {[...nav, user ? { href: `/perfil/${user.username}`, label: "Perfil", icon: IconUser } : { href: "/entrar", label: "Entrar", icon: IconUser }].map((n) => (
          <Link key={n.href} href={n.href} aria-current={active(n.href) ? "page" : undefined} className={`flex flex-1 flex-col items-center gap-1 py-2.5 text-[11px] font-medium ${active(n.href) ? "text-white" : "text-white/45"}`}>
            <n.icon size={22} />
            {n.label}
          </Link>
        ))}
      </nav>
      <div className="hidden md:block lg:hidden" />
    </div>
  );
}

function MenuLink({ href, children }: { href: string; children: ReactNode }) {
  return <Link href={href} role="menuitem" className="block px-4 py-2 text-sm hover:bg-white/10">{children}</Link>;
}
