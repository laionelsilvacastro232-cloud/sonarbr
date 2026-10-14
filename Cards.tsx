import Link from "next/link";
import type { ReactNode } from "react";
import { Cover, PlaylistMosaic } from "@/components/Cover";
import { CardPlay } from "@/components/Interactive";
import { TrackCard } from "@/components/TrackCard";
import type { AlbumCard as A, ArtistCard as AR, PlaylistCard as PL, TrackDTO } from "@/lib/queries";

export function Shelf({ title, subtitle, href, children, badge }: { title: string; subtitle?: string; href?: string; children: ReactNode; badge?: string }) {
  return (
    <section className="mb-9">
      <div className="mb-3 flex items-end justify-between gap-4 px-1">
        <div className="min-w-0">
          <h2 className="truncate text-[22px] font-bold tracking-tight">{title}</h2>
          {(subtitle || badge) && (
            <p className="mt-0.5 text-[13px] text-white/45">
              {badge && <span className="mr-2 rounded border border-white/25 px-1.5 py-px text-[10px] uppercase tracking-wider text-white/70">{badge}</span>}
              {subtitle}
            </p>
          )}
        </div>
        {href && <Link href={href} className="shrink-0 text-[13px] font-semibold text-white/55 hover:text-white hover:underline">Mostrar tudo</Link>}
      </div>
      <div className="no-scrollbar -mx-4 flex snap-x gap-4 overflow-x-auto px-4 pb-2 md:mx-0 md:px-0">{children}</div>
    </section>
  );
}

const cardCls = "group relative w-[148px] shrink-0 snap-start rounded-xl p-3 transition hover:bg-white/[0.07] sm:w-[172px]";

export function AlbumCardC({ a }: { a: A }) {
  return (
    <div className={cardCls}>
      <Link href={`/album/${a.id}`} className="block">
        <div className="relative">
          <Cover src={a.coverUrl} seed={a.id} title={a.title} className="shadow-lg shadow-black/50" />
          <CardPlay kind="album" id={a.id} />
        </div>
        <div className="mt-3 truncate text-[14px] font-semibold">{a.title}</div>
        <div className="truncate text-[12.5px] text-white/50">
          {a.releaseDate?.slice(0, 4)} · {a.kind === "single" ? "Single" : a.kind === "ep" ? "EP" : "Álbum"} · {a.artistName}
        </div>
      </Link>
    </div>
  );
}

export function ArtistCardC({ a }: { a: AR }) {
  return (
    <div className={cardCls}>
      <Link href={`/artista/${a.id}`} className="block">
        <div className="relative">
          <Cover src={a.imageUrl} seed={a.id} title={a.name} round className="shadow-lg shadow-black/50" />
          <CardPlay kind="artist" id={a.id} />
        </div>
        <div className="mt-3 truncate text-[14px] font-semibold">{a.name}</div>
        <div className="text-[12.5px] text-white/50">Artista</div>
      </Link>
    </div>
  );
}

export function PlaylistCardC({ p }: { p: PL }) {
  return (
    <div className={cardCls}>
      <Link href={`/playlist/${p.id}`} className="block">
        <div className="relative">
          {p.coverUrl ? <Cover src={p.coverUrl} seed={p.id} title={p.name} /> : <PlaylistMosaic covers={p.covers} seed={p.id} name={p.name} />}
          <CardPlay kind="playlist" id={p.id} />
        </div>
        <div className="mt-3 truncate text-[14px] font-semibold">{p.name}</div>
        <div className="truncate text-[12.5px] text-white/50">
          {p.editorial ? "Editorial" : p.ownerName ?? "Playlist"} · {p.trackCount} {p.trackCount === 1 ? "faixa" : "faixas"}
        </div>
      </Link>
    </div>
  );
}

export function TrackShelf({ tracks }: { tracks: TrackDTO[] }) {
  return (
    <>
      {tracks.map((t) => (
        <TrackCard key={t.id} track={t} list={tracks} className={cardCls} />
      ))}
    </>
  );
}

export function GenreTile({ name, index }: { name: string; index: number }) {
  const shades = ["#1d1d1d", "#262626", "#161616", "#2d2d2d", "#202020"];
  return (
    <Link
      href={`/genero/${encodeURIComponent(name)}`}
      className="relative flex h-[104px] w-[180px] shrink-0 snap-start items-end overflow-hidden rounded-xl border border-white/10 p-4 text-lg font-bold tracking-tight transition hover:border-white/40"
      style={{ background: shades[index % shades.length] }}
    >
      <svg className="absolute -right-4 -top-4 h-24 w-24 text-white/10" viewBox="0 0 100 100" fill="none" stroke="currentColor"><circle cx="50" cy="50" r="46" /><circle cx="50" cy="50" r="30" /><circle cx="50" cy="50" r="14" /></svg>
      <span className="relative">{name}</span>
    </Link>
  );
}

export function Empty({ title, text, action }: { title: string; text?: string; action?: ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-white/15 px-6 py-12 text-center">
      <p className="text-base font-semibold">{title}</p>
      {text && <p className="mx-auto mt-1 max-w-md text-sm text-white/50">{text}</p>}
      {action && <div className="mt-5 flex justify-center">{action}</div>}
    </div>
  );
}

export function PageHeader({ eyebrow, title, children }: { eyebrow?: string; title: string; children?: ReactNode }) {
  return (
    <header className="mb-7 flex flex-wrap items-end justify-between gap-4">
      <div>
        {eyebrow && <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-white/40">{eyebrow}</p>}
        <h1 className="text-3xl font-extrabold tracking-tight md:text-4xl">{title}</h1>
      </div>
      {children}
    </header>
  );
}
