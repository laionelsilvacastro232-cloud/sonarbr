"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { addToPlaylist, createPlaylist, myPlaylistsForPicker, submitReport, toggleLike } from "@/app/actions";
import { usePlayer } from "@/components/PlayerProvider";
import type { TrackDTO } from "@/lib/queries";
import { IconCheck, IconClose, IconPlus } from "@/components/Icons";

export type AppUser = { id: string; username: string; displayName: string; avatarUrl: string | null; role: string } | null;
type MenuExtra = { label: string; onClick: () => void; danger?: boolean };
type Ctx = {
  user: AppUser;
  toast: (msg: string, kind?: "ok" | "error") => void;
  needLogin: () => boolean;
  openMenu: (e: React.MouseEvent | { clientX: number; clientY: number }, track: TrackDTO, extra?: MenuExtra[]) => void;
  openPicker: (track: TrackDTO) => void;
  openReport: (type: "user" | "playlist" | "track" | "artist", id: string, label: string) => void;
  share: (path: string, title: string) => Promise<void>;
  like: (t: TrackDTO) => Promise<void>;
};
const UiCtx = createContext<Ctx | null>(null);
export const useUi = () => {
  const c = useContext(UiCtx);
  if (!c) throw new Error("useUi fora do provider");
  return c;
};

export function UiProvider({ user, children }: { user: AppUser; children: ReactNode }) {
  const router = useRouter();
  const player = usePlayer();
  const [toasts, setToasts] = useState<{ id: number; msg: string; kind: "ok" | "error" }[]>([]);
  const [menu, setMenu] = useState<{ x: number; y: number; track: TrackDTO; extra: MenuExtra[] } | null>(null);
  const [picker, setPicker] = useState<TrackDTO | null>(null);
  const [report, setReport] = useState<{ type: "user" | "playlist" | "track" | "artist"; id: string; label: string } | null>(null);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const toast = useCallback((msg: string, kind: "ok" | "error" = "ok") => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t.slice(-2), { id, msg, kind }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4000);
  }, []);

  const needLogin = useCallback(() => {
    if (user) return false;
    toast("Entre na sua conta para usar este recurso.", "error");
    return true;
  }, [user, toast]);

  const share = useCallback(
    async (path: string, title: string) => {
      const url = path.startsWith("http") ? path : `${window.location.origin}${path}`;
      try {
        if (navigator.share && /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent)) {
          await navigator.share({ title, url });
          return;
        }
        await navigator.clipboard.writeText(url);
        toast("Link copiado para a área de transferência.");
      } catch (e) {
        if ((e as Error)?.name === "AbortError") return;
        window.prompt("Copie o link:", url);
      }
    },
    [toast],
  );

  const like = useCallback(
    async (t: TrackDTO) => {
      if (needLogin()) return;
      player.patchTrack(t.id, { liked: !t.liked });
      const r = await toggleLike(t.id);
      if (!r.ok) {
        player.patchTrack(t.id, { liked: t.liked });
        toast(r.error, "error");
      } else {
        toast(r.liked ? "Adicionada às músicas curtidas." : "Removida das músicas curtidas.");
        router.refresh();
      }
    },
    [needLogin, player, toast, router],
  );

  const openMenu: Ctx["openMenu"] = useCallback((e, track, extra = []) => {
    const w = 260;
    const x = Math.min(e.clientX, window.innerWidth - w - 8);
    const y = Math.min(e.clientY, window.innerHeight - 380);
    setMenu({ x: Math.max(8, x), y: Math.max(8, y), track, extra });
    if ("preventDefault" in e) e.preventDefault();
  }, []);

  const value = useMemo<Ctx>(
    () => ({ user, toast, needLogin, openMenu, openPicker: setPicker, openReport: (type, id, label) => setReport({ type, id, label }), share, like }),
    [user, toast, needLogin, openMenu, share, like],
  );

  return (
    <UiCtx.Provider value={value}>
      {children}
      {mounted &&
        createPortal(
          <>
            <div className="pointer-events-none fixed inset-x-0 bottom-28 z-[90] flex flex-col items-center gap-2 px-4 md:bottom-28" role="status" aria-live="polite">
              {toasts.map((t) => (
                <div key={t.id} className={`pointer-events-auto max-w-md animate-rise rounded-lg border px-4 py-2.5 text-sm shadow-2xl ${t.kind === "error" ? "border-white/30 bg-[#1c1c1c] text-white" : "border-white/10 bg-white text-black"}`}>
                  {t.msg}
                  {t.kind === "error" && !user && (
                    <Link href="/entrar" className="ml-3 font-semibold underline">Entrar</Link>
                  )}
                </div>
              ))}
            </div>
            {menu && <TrackMenu menu={menu} onClose={() => setMenu(null)} />}
            {picker && <PlaylistPicker track={picker} onClose={() => setPicker(null)} />}
            {report && <ReportModal target={report} onClose={() => setReport(null)} />}
          </>,
          document.body,
        )}
    </UiCtx.Provider>
  );
}

function TrackMenu({ menu, onClose }: { menu: { x: number; y: number; track: TrackDTO; extra: MenuExtra[] }; onClose: () => void }) {
  const ui = useUi();
  const player = usePlayer();
  const router = useRouter();
  const t = menu.track;
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const close = (e: Event) => {
      if (ref.current && e.target instanceof Node && ref.current.contains(e.target)) return;
      onClose();
    };
    const key = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("mousedown", close);
    document.addEventListener("scroll", onClose, true);
    window.addEventListener("keydown", key);
    window.addEventListener("resize", onClose);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("scroll", onClose, true);
      window.removeEventListener("keydown", key);
      window.removeEventListener("resize", onClose);
    };
  }, [onClose]);

  const canPlay = !!t.audioUrl && t.availability === "available";
  const items: ({ label: string; onClick: () => void; danger?: boolean } | "sep")[] = [
    ...(canPlay
      ? [
          { label: "Tocar em seguida", onClick: () => { player.playNext(t); ui.toast("Será a próxima da fila."); } },
          { label: "Adicionar à fila", onClick: () => { player.addToQueue(t); ui.toast("Adicionada à fila."); } },
        ]
      : []),
    { label: t.liked ? "Remover das curtidas" : "Curtir", onClick: () => ui.like(t) },
    { label: "Adicionar à playlist", onClick: () => !ui.needLogin() && ui.openPicker(t) },
    "sep",
    { label: "Ir para o artista", onClick: () => router.push(`/artista/${t.artistId}`) },
    ...(t.albumId ? [{ label: "Ir para o álbum", onClick: () => router.push(`/album/${t.albumId}`) }] : []),
    { label: "Detalhes e créditos", onClick: () => router.push(`/musica/${t.id}`) },
    { label: "Compartilhar", onClick: () => ui.share(`/musica/${t.id}`, `${t.title} — ${t.artistName}`) },
    ...(t.externalUrl ? [{ label: "Abrir na fonte original", onClick: () => window.open(t.externalUrl!, "_blank", "noopener,noreferrer") }] : []),
    ...(menu.extra.length ? ["sep" as const, ...menu.extra] : []),
    "sep",
    { label: "Denunciar", onClick: () => !ui.needLogin() && ui.openReport("track", t.id, t.title), danger: true },
  ];
  return (
    <div ref={ref} role="menu" style={{ left: menu.x, top: menu.y }} className="fixed z-[95] w-[260px] animate-rise overflow-hidden rounded-xl border border-white/10 bg-[#161616] py-1.5 shadow-2xl shadow-black">
      {items.map((it, i) =>
        it === "sep" ? (
          <div key={i} className="my-1 h-px bg-white/10" />
        ) : (
          <button key={i} role="menuitem" className={`block w-full px-4 py-2 text-left text-[13.5px] hover:bg-white/10 ${it.danger ? "text-white/60" : "text-white"}`} onClick={() => { onClose(); it.onClick(); }}>
            {it.label}
          </button>
        ),
      )}
    </div>
  );
}

export function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    const key = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", key);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", key);
      document.body.style.overflow = "";
    };
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/70 backdrop-blur-sm sm:items-center" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div role="dialog" aria-modal="true" aria-label={title} className="max-h-[85dvh] w-full max-w-md animate-rise overflow-hidden rounded-t-2xl border border-white/10 bg-[#121212] sm:rounded-2xl">
        <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
          <h2 className="text-base font-bold">{title}</h2>
          <button onClick={onClose} aria-label="Fechar" className="rounded-full p-1.5 text-white/60 hover:bg-white/10 hover:text-white"><IconClose size={18} /></button>
        </div>
        <div className="max-h-[70dvh] overflow-y-auto p-5">{children}</div>
      </div>
    </div>
  );
}

function PlaylistPicker({ track, onClose }: { track: TrackDTO; onClose: () => void }) {
  const ui = useUi();
  const router = useRouter();
  const [list, setList] = useState<{ id: string; name: string; has: boolean }[] | null>(null);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    myPlaylistsForPicker(track.id).then(setList).catch(() => setList([]));
  }, [track.id]);

  async function add(id: string, has: boolean) {
    if (has) return ui.toast("Esta faixa já está nessa playlist.", "error");
    setBusy(true);
    const r = await addToPlaylist(id, track.id);
    setBusy(false);
    if (!r.ok) return ui.toast(r.error, "error");
    ui.toast("Adicionada à playlist.");
    setList((l) => l?.map((p) => (p.id === id ? { ...p, has: true } : p)) ?? l);
    router.refresh();
  }
  async function create() {
    setBusy(true);
    const r = await createPlaylist(name || track.title, track.id);
    setBusy(false);
    if (!r.ok) return ui.toast(r.error, "error");
    ui.toast("Playlist criada.");
    onClose();
    router.refresh();
  }
  return (
    <Modal title="Adicionar à playlist" onClose={onClose}>
      <p className="mb-4 truncate text-sm text-white/55">{track.title} · {track.artistName}</p>
      <div className="mb-4 flex gap-2">
        <input value={name} onChange={(e) => setName(e.target.value)} maxLength={100} placeholder="Nome da nova playlist" className="field flex-1" />
        <button disabled={busy} onClick={create} className="btn-primary shrink-0 !px-4"><IconPlus size={16} /> Criar</button>
      </div>
      {list === null ? (
        <p className="py-6 text-center text-sm text-white/50">Carregando…</p>
      ) : list.length === 0 ? (
        <p className="py-6 text-center text-sm text-white/50">Você ainda não tem playlists. Crie a primeira acima.</p>
      ) : (
        <ul className="space-y-1">
          {list.map((p) => (
            <li key={p.id}>
              <button disabled={busy} onClick={() => add(p.id, p.has)} className="flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left text-sm hover:bg-white/8">
                <span className="truncate">{p.name}</span>
                {p.has && <IconCheck size={16} />}
              </button>
            </li>
          ))}
        </ul>
      )}
    </Modal>
  );
}

const REASONS = ["Conteúdo ofensivo ou abusivo", "Violação de direitos autorais", "Spam ou conteúdo enganoso", "Perfil falso ou personificação", "Outro motivo"];

function ReportModal({ target, onClose }: { target: { type: "user" | "playlist" | "track" | "artist"; id: string; label: string }; onClose: () => void }) {
  const ui = useUi();
  const [reason, setReason] = useState(REASONS[0]);
  const [details, setDetails] = useState("");
  const [busy, setBusy] = useState(false);
  async function send() {
    setBusy(true);
    const r = await submitReport(target.type, target.id, reason, details);
    setBusy(false);
    if (!r.ok) return ui.toast(r.error, "error");
    ui.toast("Denúncia enviada para a moderação.");
    onClose();
  }
  return (
    <Modal title="Denunciar" onClose={onClose}>
      <p className="mb-4 text-sm text-white/55">Alvo: {target.label}</p>
      <label className="label">Motivo</label>
      <select value={reason} onChange={(e) => setReason(e.target.value)} className="field mb-4">
        {REASONS.map((r) => <option key={r}>{r}</option>)}
      </select>
      <label className="label">Detalhes (opcional)</label>
      <textarea value={details} onChange={(e) => setDetails(e.target.value)} maxLength={1000} rows={4} className="field mb-4" />
      <button disabled={busy} onClick={send} className="btn-primary w-full">{busy ? "Enviando…" : "Enviar denúncia"}</button>
    </Modal>
  );
}
