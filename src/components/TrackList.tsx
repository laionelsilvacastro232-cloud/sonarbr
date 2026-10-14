"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { movePlaylistItem, removeFromPlaylist, removeHistoryItem } from "@/app/actions";
import { usePlayer } from "@/components/PlayerProvider";
import { useUi } from "@/components/UiProvider";
import { Cover } from "@/components/Cover";
import { LikeButton } from "@/components/Interactive";
import { IconDown, IconExternal, IconMore, IconPause, IconPlay, IconTrash, IconUp } from "@/components/Icons";
import { fmtDuration, timeAgo } from "@/lib/format";
import type { TrackDTO } from "@/lib/queries";

export type RowTrack = TrackDTO & { itemId?: string; historyId?: string; playedAt?: string | Date };

const canPlay = (t: TrackDTO) => !!t.audioUrl && t.availability === "available";

function Eq() {
  return (
    <span className="flex h-4 items-end gap-[2px]" aria-hidden>
      {[0, 1, 2].map((i) => (
        <span key={i} className="eq-bar w-[3px] bg-white" style={{ animationDelay: `${i * 0.18}s` }} />
      ))}
    </span>
  );
}

export function TrackList({
  tracks,
  playlistId,
  canEdit,
  showAlbum = true,
  showIndex = true,
  showDate = false,
  allowHistoryRemove = false,
  emptyText = "Nenhuma faixa por aqui ainda.",
}: {
  tracks: RowTrack[];
  playlistId?: string;
  canEdit?: boolean;
  showAlbum?: boolean;
  showIndex?: boolean;
  showDate?: boolean;
  allowHistoryRemove?: boolean;
  emptyText?: string;
}) {
  const p = usePlayer();
  const ui = useUi();
  const router = useRouter();
  if (!tracks.length) return <p className="py-10 text-center text-sm text-white/45">{emptyText}</p>;

  const list = tracks as TrackDTO[];
  async function run(fn: Promise<{ ok: boolean; error?: string }>) {
    const r = await fn;
    if (!r.ok) ui.toast(r.error ?? "Erro", "error");
    else router.refresh();
  }

  return (
    <div role="list">
      <div className="hidden items-center gap-4 border-b border-white/10 px-3 pb-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-white/40 md:grid md:grid-cols-[2rem_minmax(0,1fr)_minmax(0,0.8fr)_6rem]">
        <span className="text-center">#</span>
        <span>Título</span>
        <span>{showAlbum ? "Álbum" : ""}</span>
        <span className="pr-14 text-right">Duração</span>
      </div>
      {tracks.map((t, i) => {
        const active = p.current?.id === t.id;
        const playable = canPlay(t);
        return (
          <div
            key={`${t.id}-${t.itemId ?? t.historyId ?? i}`}
            role="listitem"
            onContextMenu={(e) => ui.openMenu(e, t, extras(t))}
            onDoubleClick={() => playable && p.playTrack(t, list)}
            className={`group grid cursor-default grid-cols-[2rem_minmax(0,1fr)_auto] items-center gap-3 rounded-lg px-3 py-2 hover:bg-white/[0.07] md:grid-cols-[2rem_minmax(0,1fr)_minmax(0,0.8fr)_6rem] md:gap-4 ${active ? "bg-white/[0.06]" : ""}`}
          >
            <button
              aria-label={active && p.playing ? "Pausar" : `Reproduzir ${t.title}`}
              onClick={() => {
                if (!playable) return ui.toast("Faixa sem áudio disponível aqui. Use o menu para abrir na fonte original.", "error");
                if (active) p.togglePlay();
                else p.playTrack(t, list);
              }}
              className="grid h-8 w-8 place-items-center text-sm tabular-nums text-white/50"
            >
              {active && p.playing ? (
                <span className="group-hover:hidden"><Eq /></span>
              ) : (
                <span className={`${active ? "font-semibold text-white" : ""} group-hover:hidden`}>{showIndex ? i + 1 : ""}</span>
              )}
              <span className="hidden text-white group-hover:block">{active && p.playing ? <IconPause size={16} /> : <IconPlay size={16} />}</span>
            </button>

            <div className="flex min-w-0 items-center gap-3">
              <div className="h-10 w-10 shrink-0">
                <Cover src={t.coverUrl} seed={t.albumId ?? t.id} title={t.title} />
              </div>
              <div className="min-w-0">
                <Link href={`/musica/${t.id}`} className={`block truncate text-[14.5px] font-medium hover:underline ${active ? "text-white" : "text-white/95"} ${playable ? "" : "!text-white/40"}`}>
                  {t.title}
                  {t.explicit && <span className="ml-2 rounded-[3px] bg-white/20 px-1 text-[9px] font-bold text-white/80">E</span>}
                </Link>
                <div className="truncate text-[13px] text-white/50">
                  <Link href={`/artista/${t.artistId}`} className="hover:text-white hover:underline">{t.artistName}</Link>
                  {t.featuring && <span> · feat. {t.featuring}</span>}
                  {!playable && <span className="ml-2 text-white/40">· {t.externalUrl ? "somente na fonte original" : "indisponível"}</span>}
                  {showDate && t.playedAt && <span> · {timeAgo(t.playedAt)}</span>}
                </div>
              </div>
            </div>

            <div className="hidden min-w-0 truncate text-[13px] text-white/50 md:block">
              {showAlbum && t.albumId && <Link href={`/album/${t.albumId}`} className="hover:text-white hover:underline">{t.albumTitle}</Link>}
            </div>

            <div className="flex items-center justify-end gap-0.5 text-white/55">
              {!playable && t.externalUrl && (
                <a href={t.externalUrl} target="_blank" rel="noopener noreferrer" className="icon-btn" aria-label="Abrir na fonte original" title="Abrir na fonte original" onClick={(e) => e.stopPropagation()}>
                  <IconExternal size={17} />
                </a>
              )}
              <LikeButton track={t} className="md:opacity-0 md:group-hover:opacity-100 data-[on=true]:opacity-100" />
              {playlistId && canEdit && t.itemId && (
                <span className="hidden gap-0.5 md:flex">
                  <button aria-label="Mover para cima" disabled={i === 0} className="icon-btn disabled:opacity-20" onClick={() => run(movePlaylistItem(playlistId, t.itemId!, "up"))}><IconUp size={16} /></button>
                  <button aria-label="Mover para baixo" disabled={i === tracks.length - 1} className="icon-btn disabled:opacity-20" onClick={() => run(movePlaylistItem(playlistId, t.itemId!, "down"))}><IconDown size={16} /></button>
                </span>
              )}
              {allowHistoryRemove && t.historyId && (
                <button aria-label="Remover do histórico" title="Remover do histórico" className="icon-btn" onClick={() => run(removeHistoryItem(t.historyId!))}><IconTrash size={17} /></button>
              )}
              <span className="w-10 text-right text-[13px] tabular-nums max-md:hidden">{fmtDuration(t.durationSec)}</span>
              <button aria-label="Mais opções" className="icon-btn" onClick={(e) => ui.openMenu(e, t, extras(t))}>
                <IconMore size={19} />
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );

  function extras(t: RowTrack) {
    const out: { label: string; onClick: () => void; danger?: boolean }[] = [];
    if (playlistId && canEdit && t.itemId) {
      out.push({ label: "Mover para cima", onClick: () => run(movePlaylistItem(playlistId, t.itemId!, "up")) });
      out.push({ label: "Mover para baixo", onClick: () => run(movePlaylistItem(playlistId, t.itemId!, "down")) });
      out.push({ label: "Remover desta playlist", onClick: () => run(removeFromPlaylist(playlistId, t.itemId!)) });
    }
    if (allowHistoryRemove && t.historyId) out.push({ label: "Remover do histórico", onClick: () => run(removeHistoryItem(t.historyId!)) });
    return out;
  }
}
