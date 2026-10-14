"use client";

import Link from "next/link";
import { usePlayer } from "@/components/PlayerProvider";
import { useUi } from "@/components/UiProvider";
import { Cover } from "@/components/Cover";
import { IconPause, IconPlay } from "@/components/Icons";
import type { TrackDTO } from "@/lib/queries";

export function TrackCard({ track, list, className = "" }: { track: TrackDTO; list: TrackDTO[]; className?: string }) {
  const p = usePlayer();
  const ui = useUi();
  const playable = !!track.audioUrl && track.availability === "available";
  const active = p.current?.id === track.id;
  return (
    <div className={className} onContextMenu={(e) => ui.openMenu(e, track)}>
      <div className="relative">
        <Link href={`/musica/${track.id}`} className="block">
          <Cover src={track.coverUrl} seed={track.albumId ?? track.id} title={track.title} className="shadow-lg shadow-black/50" />
        </Link>
        <button
          aria-label={active && p.playing ? "Pausar" : `Reproduzir ${track.title}`}
          onClick={() => {
            if (!playable) return ui.toast("Faixa sem áudio disponível aqui.", "error");
            if (active) p.togglePlay();
            else p.playTrack(track, list);
          }}
          className="absolute bottom-2 right-2 grid h-11 w-11 translate-y-2 place-items-center rounded-full bg-white text-black opacity-0 shadow-xl transition focus:translate-y-0 focus:opacity-100 group-hover:translate-y-0 group-hover:opacity-100 max-md:h-9 max-md:w-9 max-md:translate-y-0 max-md:opacity-100"
        >
          {active && p.playing ? <IconPause size={18} /> : <IconPlay size={18} />}
        </button>
      </div>
      <Link href={`/musica/${track.id}`} className="mt-3 block truncate text-[14px] font-semibold">{track.title}</Link>
      <Link href={`/artista/${track.artistId}`} className="block truncate text-[12.5px] text-white/50 hover:text-white hover:underline">{track.artistName}</Link>
    </div>
  );
}
