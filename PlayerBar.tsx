"use client";

import Link from "next/link";
import { useState } from "react";
import { usePlayer } from "@/components/PlayerProvider";
import { useUi } from "@/components/UiProvider";
import { Cover } from "@/components/Cover";
import { LikeButton } from "@/components/Interactive";
import {
  IconChevronDown, IconClose, IconExternal, IconExpand, IconMore, IconMute, IconNext, IconPause, IconPlay, IconPlus,
  IconPrev, IconQueue, IconRepeat, IconShare, IconShuffle, IconVolume,
} from "@/components/Icons";
import { fmtDuration } from "@/lib/format";

function Seek({ className = "" }: { className?: string }) {
  const p = usePlayer();
  const max = p.duration || p.current?.durationSec || 0;
  const pct = max ? Math.min(100, (p.progress / max) * 100) : 0;
  return (
    <input
      type="range"
      aria-label="Progresso da faixa"
      className={`range ${className}`}
      min={0}
      max={max || 1}
      step={0.1}
      value={Math.min(p.progress, max || 1)}
      disabled={!max || !p.current}
      style={{ ["--pct" as string]: `${pct}%` }}
      onChange={(e) => p.seek(parseFloat(e.target.value))}
    />
  );
}

function Controls({ big = false }: { big?: boolean }) {
  const p = usePlayer();
  const ui = useUi();
  const none = !p.current;
  return (
    <div className={`flex items-center justify-center ${big ? "gap-5 sm:gap-7" : "gap-3"}`}>
      <button aria-label="Aleatório" aria-pressed={p.shuffle} disabled={none} onClick={p.toggleShuffle} className={`icon-btn ${p.shuffle ? "!text-white" : ""} relative`}>
        <IconShuffle size={big ? 22 : 18} />
        {p.shuffle && <span className="absolute -bottom-0.5 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-white" />}
      </button>
      <button aria-label="Anterior" disabled={none} onClick={p.prev} className="icon-btn !text-white">
        <IconPrev size={big ? 28 : 20} />
      </button>
      <button
        aria-label={p.playing ? "Pausar" : "Reproduzir"}
        disabled={none}
        onClick={() => (p.current ? p.togglePlay() : ui.toast("Escolha uma faixa para reproduzir.", "error"))}
        className={`grid place-items-center rounded-full bg-white text-black transition hover:scale-105 active:scale-95 disabled:opacity-40 ${big ? "h-16 w-16" : "h-9 w-9"}`}
      >
        {p.loading && p.playing ? (
          <span className={`animate-spin rounded-full border-2 border-black/30 border-t-black ${big ? "h-6 w-6" : "h-4 w-4"}`} />
        ) : p.playing ? (
          <IconPause size={big ? 28 : 16} />
        ) : (
          <IconPlay size={big ? 28 : 16} />
        )}
      </button>
      <button aria-label="Próxima" disabled={none} onClick={p.next} className="icon-btn !text-white">
        <IconNext size={big ? 28 : 20} />
      </button>
      <button aria-label={`Repetir: ${p.repeat === "off" ? "desligado" : p.repeat === "all" ? "todas" : "faixa"}`} aria-pressed={p.repeat !== "off"} disabled={none} onClick={p.cycleRepeat} className={`icon-btn relative ${p.repeat !== "off" ? "!text-white" : ""}`}>
        <IconRepeat size={big ? 22 : 18} />
        {p.repeat === "one" && <span className="absolute -right-0.5 -top-0.5 grid h-3.5 w-3.5 place-items-center rounded-full bg-white text-[9px] font-bold text-black">1</span>}
        {p.repeat !== "off" && <span className="absolute -bottom-0.5 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-white" />}
      </button>
    </div>
  );
}

function Volume() {
  const p = usePlayer();
  const v = p.muted ? 0 : p.volume;
  return (
    <div className="flex items-center gap-2">
      <button aria-label={p.muted ? "Ativar som" : "Silenciar"} onClick={p.toggleMute} className="icon-btn">
        {v === 0 ? <IconMute size={19} /> : <IconVolume size={19} />}
      </button>
      <input type="range" aria-label="Volume" className="range w-24" min={0} max={1} step={0.01} value={v} style={{ ["--pct" as string]: `${v * 100}%` }} onChange={(e) => p.setVolume(parseFloat(e.target.value))} />
    </div>
  );
}

export function PlayerBar() {
  const p = usePlayer();
  const ui = useUi();
  const t = p.current;

  return (
    <>
      {p.error && (
        <div role="alert" className="fixed inset-x-3 bottom-[8.4rem] z-[60] mx-auto flex max-w-xl items-start gap-3 rounded-xl border border-white/25 bg-[#1b1b1b] px-4 py-3 text-sm shadow-2xl md:bottom-[6.2rem]">
          <p className="flex-1 text-white/85">{p.error}</p>
          {t?.externalUrl && <a href={t.externalUrl} target="_blank" rel="noopener noreferrer" className="shrink-0 font-semibold underline">Abrir fonte</a>}
          <button onClick={p.dismissError} aria-label="Fechar aviso" className="shrink-0 text-white/60 hover:text-white"><IconClose size={16} /></button>
        </div>
      )}

      {/* Barra desktop */}
      <div className="fixed inset-x-0 bottom-0 z-50 hidden h-[84px] items-center gap-4 border-t border-white/10 bg-black/95 px-4 backdrop-blur md:grid md:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)_minmax(0,1fr)]">
        <div className="flex min-w-0 items-center gap-3">
          {t ? (
            <>
              <button onClick={() => p.setExpanded(true)} className="h-14 w-14 shrink-0" aria-label="Abrir tela de reprodução">
                <Cover src={t.coverUrl} seed={t.albumId ?? t.id} title={t.title} />
              </button>
              <div className="min-w-0">
                <Link href={`/musica/${t.id}`} className="block truncate text-sm font-semibold hover:underline">{t.title}</Link>
                <Link href={`/artista/${t.artistId}`} className="block truncate text-xs text-white/55 hover:text-white hover:underline">{t.artistName}</Link>
              </div>
              <LikeButton track={t} />
            </>
          ) : (
            <p className="text-sm text-white/40">Nenhuma faixa selecionada</p>
          )}
        </div>
        <div className="flex flex-col items-center gap-1.5">
          <Controls />
          <div className="flex w-full max-w-xl items-center gap-2 text-[11px] tabular-nums text-white/50">
            <span className="w-9 text-right">{fmtDuration(p.progress)}</span>
            <Seek className="flex-1" />
            <span className="w-9">{fmtDuration(p.duration || t?.durationSec || 0)}</span>
          </div>
        </div>
        <div className="flex items-center justify-end gap-1">
          {t && (
            <>
              <button aria-label="Adicionar à playlist" title="Adicionar à playlist" className="icon-btn" onClick={() => !ui.needLogin() && ui.openPicker(t)}><IconPlus size={19} /></button>
              <button aria-label="Mais opções" className="icon-btn" onClick={(e) => ui.openMenu(e, t)}><IconMore size={19} /></button>
            </>
          )}
          <button aria-label="Fila de reprodução" title="Fila" className="icon-btn" onClick={() => { p.setQueueOpen(true); p.setExpanded(true); }}><IconQueue size={19} /></button>
          <Volume />
          <button aria-label="Tela cheia" title="Tela de reprodução" className="icon-btn" disabled={!t} onClick={() => p.setExpanded(true)}><IconExpand size={18} /></button>
        </div>
      </div>

      {/* Mini player mobile */}
      {t && (
        <div className="fixed inset-x-2 bottom-[calc(3.9rem+env(safe-area-inset-bottom))] z-50 overflow-hidden rounded-xl border border-white/10 bg-[#1a1a1a] md:hidden">
          <div className="flex items-center gap-3 px-2.5 py-2">
            <button onClick={() => p.setExpanded(true)} className="flex min-w-0 flex-1 items-center gap-3 text-left" aria-label="Abrir tela de reprodução">
              <div className="h-11 w-11 shrink-0"><Cover src={t.coverUrl} seed={t.albumId ?? t.id} title={t.title} /></div>
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold">{t.title}</div>
                <div className="truncate text-xs text-white/55">{t.artistName}</div>
              </div>
            </button>
            <LikeButton track={t} />
            <button aria-label={p.playing ? "Pausar" : "Reproduzir"} onClick={p.togglePlay} className="grid h-10 w-10 place-items-center rounded-full bg-white text-black">
              {p.playing ? <IconPause size={18} /> : <IconPlay size={18} />}
            </button>
          </div>
          <div className="h-[2px] bg-white/10"><div className="h-full bg-white" style={{ width: `${(p.duration ? p.progress / p.duration : 0) * 100}%` }} /></div>
        </div>
      )}

      {p.expanded && t && <Expanded />}
    </>
  );
}

function Expanded() {
  const p = usePlayer();
  const ui = useUi();
  const t = p.current!;
  const [tab, setTab] = useState<"queue" | "about">(p.queueOpen ? "queue" : "about");
  const close = () => {
    p.setExpanded(false);
    p.setQueueOpen(false);
  };
  const upcoming = p.queue.slice(p.index + 1);

  return (
    <div className="fixed inset-0 z-[80] flex animate-fade flex-col overflow-hidden bg-black" role="dialog" aria-modal="true" aria-label="Tela de reprodução">
      <div className="pointer-events-none absolute inset-0 opacity-40" style={{ background: "radial-gradient(60% 50% at 20% 10%, rgba(255,255,255,0.14), transparent 70%)" }} />
      <div className="relative flex items-center justify-between px-4 py-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <button onClick={close} aria-label="Minimizar" className="icon-btn"><IconChevronDown size={26} /></button>
        <div className="text-center text-[11px] font-semibold uppercase tracking-[0.18em] text-white/50">
          Tocando {t.albumTitle ? `de ${t.albumTitle}` : ""}
        </div>
        <button onClick={(e) => ui.openMenu(e, t)} aria-label="Mais opções" className="icon-btn"><IconMore size={22} /></button>
      </div>

      <div className="relative mx-auto grid min-h-0 w-full max-w-6xl flex-1 gap-8 overflow-y-auto px-5 pb-8 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] md:items-center md:overflow-hidden md:px-10">
        <div className="mx-auto flex w-full max-w-md flex-col">
          <div className="mx-auto w-full max-w-[min(100%,52dvh)] shadow-2xl shadow-black">
            <Cover src={t.coverUrl} seed={t.albumId ?? t.id} title={t.title} />
          </div>
          <div className="mt-6 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <h2 className="truncate text-2xl font-extrabold tracking-tight">{t.title}</h2>
              <Link onClick={close} href={`/artista/${t.artistId}`} className="block truncate text-white/60 hover:text-white hover:underline">
                {t.artistName}{t.featuring ? ` · feat. ${t.featuring}` : ""}
              </Link>
            </div>
            <LikeButton track={t} />
          </div>
          <div className="mt-4">
            <Seek className="w-full" />
            <div className="mt-1 flex justify-between text-[11px] tabular-nums text-white/50">
              <span>{fmtDuration(p.progress)}</span>
              <span>{fmtDuration(p.duration || t.durationSec)}</span>
            </div>
          </div>
          <div className="mt-3"><Controls big /></div>
          <div className="mt-6 flex items-center justify-between">
            <button className="icon-btn" aria-label="Adicionar à playlist" onClick={() => !ui.needLogin() && ui.openPicker(t)}><IconPlus size={22} /></button>
            <Volume />
            <button className="icon-btn" aria-label="Compartilhar" onClick={() => ui.share(`/musica/${t.id}`, `${t.title} — ${t.artistName}`)}><IconShare size={21} /></button>
          </div>
        </div>

        <div className="mx-auto flex h-full min-h-0 w-full max-w-md flex-col md:max-w-none md:pt-6">
          <div className="mb-4 flex gap-2 border-b border-white/10">
            {(["queue", "about"] as const).map((k) => (
              <button key={k} onClick={() => setTab(k)} className={`-mb-px border-b-2 px-3 py-2 text-sm font-semibold ${tab === k ? "border-white text-white" : "border-transparent text-white/45 hover:text-white"}`}>
                {k === "queue" ? "Fila" : "Sobre a faixa"}
              </button>
            ))}
          </div>
          {tab === "queue" ? (
            <div className="min-h-0 flex-1 overflow-y-auto pr-1">
              <p className="mb-2 text-xs uppercase tracking-wider text-white/40">Tocando agora {p.shuffle && "· aleatório"} {p.repeat !== "off" && `· repetir ${p.repeat === "one" ? "faixa" : "fila"}`}</p>
              <QueueRow i={p.index} active />
              <div className="mb-2 mt-5 flex items-center justify-between">
                <p className="text-xs uppercase tracking-wider text-white/40">A seguir ({upcoming.length})</p>
                {upcoming.length > 0 && <button onClick={p.clearQueue} className="text-xs font-semibold text-white/60 hover:text-white">Limpar fila</button>}
              </div>
              {upcoming.length === 0 && <p className="py-4 text-sm text-white/45">Não há mais faixas na fila.{p.repeat === "all" ? " A fila recomeça ao final." : ""}</p>}
              {p.queue.map((_, i) => (i > p.index ? <QueueRow key={`${p.queue[i].id}-${i}`} i={i} /> : null))}
            </div>
          ) : (
            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto pr-1 text-sm">
              <dl className="grid grid-cols-[7rem_1fr] gap-y-2 text-white/70">
                <dt className="text-white/40">Artista</dt><dd>{t.artistName}</dd>
                {t.albumTitle && (<><dt className="text-white/40">Álbum</dt><dd>{t.albumTitle}</dd></>)}
                {t.genre && (<><dt className="text-white/40">Gênero</dt><dd>{t.genre}</dd></>)}
                <dt className="text-white/40">Fonte</dt>
                <dd>{t.sourceType === "preview" ? "Prévia oficial de 30s (API pública)" : t.sourceType === "upload" ? "Enviado pelo artista" : t.sourceType === "jamendo" ? "Jamendo (licença Creative Commons)" : "Fonte licenciada"}</dd>
              </dl>
              <div className="flex flex-wrap gap-3 pt-2">
                <Link onClick={close} href={`/musica/${t.id}`} className="btn-outline">Créditos e detalhes</Link>
                {t.externalUrl && (
                  <a href={t.externalUrl} target="_blank" rel="noopener noreferrer" className="btn-outline"><IconExternal size={16} /> Abrir na fonte original</a>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function QueueRow({ i, active }: { i: number; active?: boolean }) {
  const p = usePlayer();
  const t = p.queue[i];
  if (!t) return null;
  return (
    <div className={`group flex items-center gap-3 rounded-lg px-2 py-1.5 ${active ? "bg-white/10" : "hover:bg-white/[0.07]"}`}>
      <button onClick={() => (active ? p.togglePlay() : p.jumpTo(i))} className="flex min-w-0 flex-1 items-center gap-3 text-left" aria-label={`Tocar ${t.title}`}>
        <div className="h-10 w-10 shrink-0"><Cover src={t.coverUrl} seed={t.albumId ?? t.id} title={t.title} /></div>
        <div className="min-w-0">
          <div className="truncate text-sm font-medium">{t.title}</div>
          <div className="truncate text-xs text-white/50">{t.artistName}</div>
        </div>
      </button>
      <span className="text-xs tabular-nums text-white/40">{fmtDuration(t.durationSec)}</span>
      {!active && <button aria-label="Remover da fila" onClick={() => p.removeFromQueue(i)} className="icon-btn md:opacity-0 md:group-hover:opacity-100"><IconClose size={16} /></button>}
    </div>
  );
}
