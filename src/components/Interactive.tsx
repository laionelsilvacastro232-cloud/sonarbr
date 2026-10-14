"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  duplicatePlaylist,
  loadTracks,
  toggleFollowArtist,
  toggleFollowUser,
  toggleLike,
  toggleSaveAlbum,
  toggleSavePlaylist,
} from "@/app/actions";
import { usePlayer } from "@/components/PlayerProvider";
import { useUi } from "@/components/UiProvider";
import { IconCopy, IconFlag, IconHeart, IconPause, IconPlay, IconShare, IconShuffle } from "@/components/Icons";
import type { TrackDTO } from "@/lib/queries";

/** Botão grande de reproduzir tudo (lista já carregada). */
export function PlayAllButton({ tracks, size = "lg" }: { tracks: TrackDTO[]; size?: "lg" | "md" }) {
  const p = usePlayer();
  const ui = useUi();
  const ids = new Set(tracks.map((t) => t.id));
  const isCurrentList = !!p.current && ids.has(p.current.id) && p.queue.length > 0 && p.queue.every((q) => ids.has(q.id) || true);
  const playingHere = isCurrentList && p.playing;
  const any = tracks.some((t) => t.audioUrl && t.availability === "available");
  const dim = size === "lg" ? "h-14 w-14" : "h-11 w-11";
  return (
    <button
      aria-label={playingHere ? "Pausar" : "Reproduzir"}
      title={any ? undefined : "Nenhuma faixa com áudio disponível"}
      disabled={!any}
      onClick={() => {
        if (!any) return ui.toast("Nenhuma faixa com áudio disponível nesta lista.", "error");
        if (isCurrentList) p.togglePlay();
        else p.playList(tracks, 0);
      }}
      className={`${dim} grid place-items-center rounded-full bg-white text-black transition hover:scale-105 active:scale-95 disabled:opacity-40`}
    >
      {playingHere ? <IconPause size={size === "lg" ? 24 : 18} /> : <IconPlay size={size === "lg" ? 24 : 18} />}
    </button>
  );
}

export function ShuffleAllButton({ tracks }: { tracks: TrackDTO[] }) {
  const p = usePlayer();
  const any = tracks.some((t) => t.audioUrl && t.availability === "available");
  return (
    <button aria-label="Reprodução aleatória" title="Reprodução aleatória" disabled={!any} onClick={() => p.playList(tracks, 0, true)} className="icon-btn disabled:opacity-40">
      <IconShuffle size={22} />
    </button>
  );
}

export function LikeButton({ track, className = "" }: { track: TrackDTO; className?: string }) {
  const ui = useUi();
  const p = usePlayer();
  const [liked, setLiked] = useState(track.liked);
  // sincroniza com o estado do player quando a faixa for a atual
  const live = p.queue.find((t) => t.id === track.id);
  const value = live ? live.liked : liked;
  return (
    <button
      aria-label={value ? "Remover das curtidas" : "Curtir"}
      aria-pressed={value}
      className={`icon-btn ${value ? "!text-white" : ""} ${className}`}
      onClick={async (e) => {
        e.stopPropagation();
        if (ui.needLogin()) return;
        const prev = value;
        setLiked(!prev);
        p.patchTrack(track.id, { liked: !prev });
        const r = await toggleLike(track.id);
        if (!r.ok) {
          setLiked(prev);
          p.patchTrack(track.id, { liked: prev });
          ui.toast(r.error, "error");
        }
      }}
    >
      <IconHeart size={19} filled={value} />
    </button>
  );
}

type ToggleResult = Promise<{ ok: true; [k: string]: unknown } | { ok: false; error: string }>;
function ToggleButton({
  initial,
  onLabel,
  offLabel,
  action,
  field,
  variant = "outline",
  after,
}: {
  initial: boolean;
  onLabel: string;
  offLabel: string;
  action: () => ToggleResult;
  field: string;
  variant?: "outline" | "solid";
  after?: () => void;
}) {
  const ui = useUi();
  const router = useRouter();
  const [on, setOn] = useState(initial);
  const [pending, start] = useTransition();
  return (
    <button
      disabled={pending}
      aria-pressed={on}
      onClick={() => {
        if (ui.needLogin()) return;
        const prev = on;
        setOn(!prev);
        start(async () => {
          const r = await action();
          if (!r.ok) {
            setOn(prev);
            ui.toast(r.error, "error");
          } else {
            setOn(Boolean(r[field]));
            after?.();
            router.refresh();
          }
        });
      }}
      className={variant === "solid" ? "btn-primary" : on ? "btn-outline !border-white !bg-white/10" : "btn-outline"}
    >
      {on ? onLabel : offLabel}
    </button>
  );
}

export const FollowArtistButton = ({ artistId, initial }: { artistId: string; initial: boolean }) => (
  <ToggleButton initial={initial} onLabel="Seguindo" offLabel="Seguir" field="following" action={() => toggleFollowArtist(artistId)} />
);
export const FollowUserButton = ({ userId, initial }: { userId: string; initial: boolean }) => (
  <ToggleButton initial={initial} onLabel="Seguindo" offLabel="Seguir" field="following" action={() => toggleFollowUser(userId)} />
);
export const SaveAlbumButton = ({ albumId, initial }: { albumId: string; initial: boolean }) => (
  <ToggleButton initial={initial} onLabel="Salvo na biblioteca" offLabel="Salvar álbum" field="saved" action={() => toggleSaveAlbum(albumId)} />
);
export const SavePlaylistButton = ({ playlistId, initial }: { playlistId: string; initial: boolean }) => (
  <ToggleButton initial={initial} onLabel="Salva na biblioteca" offLabel="Salvar playlist" field="saved" action={() => toggleSavePlaylist(playlistId)} />
);

export function ShareButton({ path, title, label }: { path: string; title: string; label?: string }) {
  const ui = useUi();
  return (
    <button aria-label="Compartilhar" title="Compartilhar" onClick={() => ui.share(path, title)} className={label ? "btn-outline" : "icon-btn"}>
      <IconShare size={20} /> {label}
    </button>
  );
}

export function ReportButton({ type, id, label }: { type: "user" | "playlist" | "track" | "artist"; id: string; label: string }) {
  const ui = useUi();
  return (
    <button aria-label="Denunciar" title="Denunciar" onClick={() => !ui.needLogin() && ui.openReport(type, id, label)} className="icon-btn">
      <IconFlag size={19} />
    </button>
  );
}

export function DuplicateButton({ playlistId }: { playlistId: string }) {
  const ui = useUi();
  const router = useRouter();
  return (
    <button
      className="icon-btn"
      title="Duplicar playlist"
      aria-label="Duplicar playlist"
      onClick={async () => {
        if (ui.needLogin()) return;
        const r = await duplicatePlaylist(playlistId);
        if (!r.ok) return ui.toast(r.error, "error");
        ui.toast("Playlist duplicada na sua biblioteca.");
        router.push(`/playlist/${r.id}`);
      }}
    >
      <IconCopy size={20} />
    </button>
  );
}

/** Botão de play sobreposto nos cartões: carrega as faixas sob demanda e reproduz. */
export function CardPlay({ kind, id }: { kind: "album" | "playlist" | "artist"; id: string }) {
  const p = usePlayer();
  const ui = useUi();
  const [busy, setBusy] = useState(false);
  return (
    <button
      aria-label="Reproduzir"
      disabled={busy}
      onClick={async (e) => {
        e.preventDefault();
        e.stopPropagation();
        setBusy(true);
        try {
          const list = await loadTracks(kind, id);
          if (!list.some((t) => t.audioUrl && t.availability === "available")) ui.toast("Nenhuma faixa com áudio disponível aqui.", "error");
          else p.playList(list, 0);
        } catch {
          ui.toast("Não foi possível carregar as faixas.", "error");
        }
        setBusy(false);
      }}
      className="absolute bottom-2 right-2 grid h-11 w-11 translate-y-2 place-items-center rounded-full bg-white text-black opacity-0 shadow-xl transition focus:translate-y-0 focus:opacity-100 group-hover:translate-y-0 group-hover:opacity-100 max-md:translate-y-0 max-md:opacity-100 max-md:h-9 max-md:w-9"
    >
      <IconPlay size={18} />
    </button>
  );
}
