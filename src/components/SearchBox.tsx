"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { clearSearchHistory, getSearchHistory, saveSearch } from "@/app/actions";
import { Cover } from "@/components/Cover";
import { IconClock, IconClose, IconSearch } from "@/components/Icons";

type Item = { id: string; title: string; sub?: string; cover?: string | null };
type Sug = { tracks: Item[]; artists: Item[]; albums: Item[]; playlists: Item[]; users: Item[] };
const GROUPS: { key: keyof Sug; label: string; href: (id: string) => string }[] = [
  { key: "tracks", label: "Músicas", href: (id) => `/musica/${id}` },
  { key: "artists", label: "Artistas", href: (id) => `/artista/${id}` },
  { key: "albums", label: "Álbuns", href: (id) => `/album/${id}` },
  { key: "playlists", label: "Playlists", href: (id) => `/playlist/${id}` },
  { key: "users", label: "Perfis", href: (id) => `/perfil/${id}` },
];

export function SearchBox({ initial = "", autoFocus = false, className = "", loggedIn = false }: { initial?: string; autoFocus?: boolean; className?: string; loggedIn?: boolean }) {
  const router = useRouter();
  const [q, setQ] = useState(initial);
  const [open, setOpen] = useState(false);
  const [sug, setSug] = useState<Sug | null>(null);
  const [state, setState] = useState<"idle" | "loading" | "error">("idle");
  const [history, setHistory] = useState<string[]>([]);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => setQ(initial), [initial]);

  useEffect(() => {
    if (q.trim().length < 2) {
      setSug(null);
      setState("idle");
      return;
    }
    setState("loading");
    const ctrl = new AbortController();
    const id = setTimeout(async () => {
      try {
        const r = await fetch(`/api/suggest?q=${encodeURIComponent(q.trim())}`, { signal: ctrl.signal });
        if (!r.ok) throw new Error();
        setSug(await r.json());
        setState("idle");
      } catch (e) {
        if ((e as Error).name !== "AbortError") setState("error");
      }
    }, 220);
    return () => {
      clearTimeout(id);
      ctrl.abort();
    };
  }, [q]);

  useEffect(() => {
    const h = (e: MouseEvent) => box.current && !box.current.contains(e.target as Node) && setOpen(false);
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  function submit(term = q) {
    const v = term.trim();
    if (!v) return;
    setOpen(false);
    saveSearch(v);
    router.push(`/buscar?q=${encodeURIComponent(v)}`);
  }

  const hasAny = sug && GROUPS.some((g) => sug[g.key].length);

  return (
    <div ref={box} className={`relative ${className}`}>
      <form
        role="search"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
        className="flex h-12 items-center gap-3 rounded-full border border-white/10 bg-[#1a1a1a] px-4 transition focus-within:border-white/60 hover:bg-[#202020]"
      >
        <IconSearch size={20} className="shrink-0 text-white/60" />
        <input
          value={q}
          autoFocus={autoFocus}
          onChange={(e) => {
            setQ(e.target.value);
            setOpen(true);
          }}
          onFocus={() => {
            setOpen(true);
            if (loggedIn) getSearchHistory().then(setHistory);
          }}
          placeholder="Músicas, artistas, álbuns, playlists e pessoas"
          aria-label="Pesquisar"
          className="min-w-0 flex-1 bg-transparent text-[15px] outline-none placeholder:text-white/40"
        />
        {q && (
          <button type="button" aria-label="Limpar" onClick={() => { setQ(""); setSug(null); }} className="text-white/50 hover:text-white">
            <IconClose size={18} />
          </button>
        )}
      </form>

      {open && (
        <div className="absolute inset-x-0 top-14 z-40 max-h-[70dvh] overflow-y-auto rounded-2xl border border-white/10 bg-[#141414] p-2 shadow-2xl shadow-black">
          {q.trim().length < 2 ? (
            history.length ? (
              <>
                <div className="flex items-center justify-between px-3 py-2">
                  <span className="text-xs font-semibold uppercase tracking-wider text-white/40">Buscas recentes</span>
                  <button onClick={async () => { await clearSearchHistory(); setHistory([]); }} className="text-xs font-semibold text-white/60 hover:text-white">Limpar histórico</button>
                </div>
                {history.map((h) => (
                  <button key={h} onClick={() => { setQ(h); submit(h); }} className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm hover:bg-white/8">
                    <IconClock size={16} className="text-white/40" /> {h}
                  </button>
                ))}
              </>
            ) : (
              <p className="px-3 py-4 text-sm text-white/45">Digite ao menos 2 letras para ver sugestões.</p>
            )
          ) : state === "loading" && !sug ? (
            <p className="px-3 py-4 text-sm text-white/45">Buscando…</p>
          ) : state === "error" ? (
            <p className="px-3 py-4 text-sm text-white/70">Não foi possível buscar agora. Tente novamente.</p>
          ) : !hasAny ? (
            <p className="px-3 py-4 text-sm text-white/45">Nada encontrado para “{q}”.</p>
          ) : (
            <>
              {GROUPS.map((g) =>
                sug![g.key].length ? (
                  <div key={g.key} className="mb-1">
                    <div className="px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wider text-white/40">{g.label}</div>
                    {sug![g.key].map((it) => (
                      <button
                        key={it.id}
                        onClick={() => { setOpen(false); saveSearch(q); router.push(g.href(it.id)); }}
                        className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left hover:bg-white/8"
                      >
                        <div className="h-9 w-9 shrink-0"><Cover src={it.cover} seed={it.id} title={it.title} round={g.key === "artists" || g.key === "users"} /></div>
                        <div className="min-w-0">
                          <div className="truncate text-sm font-medium">{it.title}</div>
                          {it.sub && <div className="truncate text-xs text-white/45">{it.sub}</div>}
                        </div>
                      </button>
                    ))}
                  </div>
                ) : null,
              )}
              <button onClick={() => submit()} className="mt-1 w-full rounded-lg border-t border-white/10 px-3 py-3 text-left text-sm font-semibold hover:bg-white/8">
                Ver todos os resultados para “{q}”
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
