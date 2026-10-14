import Link from "next/link";
import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import { albums, artists, homeSections, playlists, tracks } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import {
  friendActivity, queryAlbums, queryArtists, queryPlaylists, queryTracks, recentTracks, recommendedTracks, tracksByIds,
} from "@/lib/queries";
import { AlbumCardC, ArtistCardC, GenreTile, PlaylistCardC, Shelf, TrackShelf } from "@/components/Cards";
import { Cover } from "@/components/Cover";
import { timeAgo } from "@/lib/format";
import { BrandMark } from "@/components/Brand";
import { IconMic } from "@/components/Icons";

export const dynamic = "force-dynamic";

export default async function Home() {
  const [user, settings] = await Promise.all([getCurrentUser(), getSettings()]);
  const sections = await db.select().from(homeSections).where(eq(homeSections.enabled, true)).orderBy(asc(homeSections.position));
  const uid = user?.id ?? null;
  const [{ maxPlays }] = await db.select({ maxPlays: sql<number>`coalesce(max(${tracks.playCount}),0)::int` }).from(tracks);

  const mine = user ? await queryPlaylists({ where: eq(playlists.ownerId, user.id), limit: 6 }) : [];

  if (!user) {
    return <Welcome name={settings.siteName} tagline={settings.tagline} open={settings.registrationOpen === "true"} logoUrl={settings.logoUrl} />;
  }

  return (
    <div className="mx-auto max-w-[1400px]">

      {user && (
        <section className="mb-9" aria-label="Atalhos">
          <h1 className="mb-4 px-1 text-3xl font-extrabold tracking-tight">{greeting()}, {user.displayName.split(" ")[0]}</h1>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-4">
            <Shortcut href="/biblioteca?aba=curtidas" label="Músicas curtidas" />
            <Shortcut href="/historico" label="Histórico" />
            {mine.slice(0, 6).map((p) => (
              <Shortcut key={p.id} href={`/playlist/${p.id}`} label={p.name} cover={p.coverUrl ?? p.covers[0]} id={p.id} />
            ))}
          </div>
        </section>
      )}

      {await Promise.all(
        sections.map(async (s) => {
          const node = await renderSection(s, uid, settings.socialEnabled === "true", maxPlays);
          return node ? <div key={s.id}>{node}</div> : null;
        }),
      )}
    </div>
  );
}

const greeting = () => {
  const h = new Date().getHours();
  return h < 12 ? "Bom dia" : h < 18 ? "Boa tarde" : "Boa noite";
};

function Shortcut({ href, label, cover, id }: { href: string; label: string; cover?: string | null; id?: string }) {
  return (
    <Link href={href} className="group flex items-center gap-3 overflow-hidden rounded-lg bg-white/[0.07] pr-3 transition hover:bg-white/[0.14]">
      <div className="h-14 w-14 shrink-0">
        <Cover src={cover} seed={id ?? label} title={label} className="!rounded-none" />
      </div>
      <span className="truncate text-sm font-bold">{label}</span>
    </Link>
  );
}

/* Boas-vindas (visitantes): coluna central estreita, marca no topo e três ações — Entrar, Criar conta e Sou artista. */
function Welcome({ name, tagline, open, logoUrl }: { name: string; tagline: string; open: boolean; logoUrl: string }) {
  return (
    <div className="relative -mx-4 -mt-3 flex min-h-[calc(100dvh-6rem)] flex-col items-center justify-center px-6 py-10 md:-mx-8 md:-mt-2">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[42dvh] opacity-60 blur-[90px]" style={{ background: "radial-gradient(50% 60% at 70% 0%, rgba(255,255,255,0.35), transparent 70%)" }} />
      <div className="relative w-full max-w-[330px] text-center">
        <div className="mb-7 flex items-center justify-center gap-3">
          <BrandMark logoUrl={logoUrl} size={60} />
        </div>
        {logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logoUrl} alt={name} className="mx-auto mb-6 h-16 w-auto object-contain" />
        ) : (
          <p className="mb-6 text-2xl font-extrabold tracking-tight">{name}</p>
        )}
        <h1 className="text-[23px] font-bold leading-snug tracking-tight">Suas músicas<br />favoritas em um<br />único lugar.</h1>
        <p className="mx-auto mt-4 max-w-[260px] text-[13px] leading-relaxed text-white/45">{tagline}</p>

        <div className="mt-9 flex flex-col gap-2.5">
          <Link href="/entrar" className="flex h-11 w-full items-center justify-center rounded-[13px] bg-white text-[17px] font-medium text-black transition active:scale-[0.98]">Entrar</Link>
          {open && (
            <Link href="/cadastro" className="flex h-11 w-full items-center justify-center rounded-[13px] border border-white/25 bg-transparent text-[17px] font-medium transition hover:bg-white/8 active:scale-[0.98]">Criar conta</Link>
          )}
          {open && (
            <Link href="/cadastro?artista=1" className="flex h-11 w-full items-center justify-center gap-2 rounded-[13px] border border-white/25 bg-transparent text-[17px] font-medium transition hover:bg-white/8 active:scale-[0.98]">
              <IconMic size={19} /> Sou artista
            </Link>
          )}
        </div>

        <p className="mt-9 text-[11px] uppercase tracking-[0.14em] text-white/30">Mais de música</p>
        <div className="mt-3 flex flex-wrap justify-center gap-x-4 gap-y-1 text-[13px] text-white/50">
          <Link href="/explorar" className="hover:text-white">Explorar</Link>
          <Link href="/buscar" className="hover:text-white">Buscar</Link>
          <Link href="/sobre" className="hover:text-white">Sobre</Link>
          <Link href="/termos" className="hover:text-white">Termos</Link>
          <Link href="/privacidade" className="hover:text-white">Privacidade</Link>
        </div>
      </div>
    </div>
  );
}

type Section = typeof homeSections.$inferSelect;

async function renderSection(s: Section, uid: string | null, social: boolean, maxPlays: number) {
  const ids = s.itemIds ?? [];
  switch (s.kind) {
    case "continue": {
      if (!uid) return null;
      const list = await recentTracks(uid, 12);
      return list.length ? <Shelf title={s.title} subtitle={s.subtitle}><TrackShelf tracks={list} /></Shelf> : null;
    }
    case "recommended": {
      const r = await recommendedTracks(uid, 12);
      return r.tracks.length ? (
        <Shelf title={s.title} subtitle={r.personalized ? s.subtitle : "Faça login e ouça mais para personalizar"} badge={r.personalized ? undefined : "Sugestões iniciais"}>
          <TrackShelf tracks={r.tracks} />
        </Shelf>
      ) : null;
    }
    case "my_playlists": {
      if (!uid) return null;
      const list = await queryPlaylists({ where: eq(playlists.ownerId, uid), limit: 12 });
      return list.length ? <Shelf title={s.title} subtitle={s.subtitle} href="/biblioteca?aba=playlists">{list.map((p) => <PlaylistCardC key={p.id} p={p} />)}</Shelf> : null;
    }
    case "activity": {
      if (!uid || !social) return null;
      const list = await friendActivity(uid, 8);
      if (!list.length) return null;
      return (
        <section className="mb-9">
          <h2 className="mb-3 px-1 text-[22px] font-bold tracking-tight">{s.title}</h2>
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
            {list.map((a) => (
              <Link key={a.userId} href={`/musica/${a.track!.id}`} className="flex items-center gap-3 rounded-xl bg-white/[0.06] p-3 hover:bg-white/[0.12]">
                <div className="h-14 w-14 shrink-0"><Cover src={a.track!.coverUrl} seed={a.track!.id} title={a.track!.title} /></div>
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold">{a.track!.title}</div>
                  <div className="truncate text-xs text-white/50">{a.track!.artistName}</div>
                  <div className="mt-1 truncate text-[11px] text-white/40">{a.displayName} · {timeAgo(a.playedAt)}</div>
                </div>
              </Link>
            ))}
          </div>
        </section>
      );
    }
    case "new_releases": {
      const list = await queryAlbums({ limit: 14 });
      return list.length ? <Shelf title={s.title} subtitle={s.subtitle} href="/explorar?tipo=albuns">{list.map((a) => <AlbumCardC key={a.id} a={a} />)}</Shelf> : null;
    }
    case "popular_tracks": {
      const list = await queryTracks({ userId: uid, limit: 14 });
      return list.length ? <Shelf title={s.title} subtitle={s.subtitle} badge={maxPlays === 0 ? "Sugestões iniciais" : undefined} href="/explorar?tipo=musicas"><TrackShelf tracks={list} /></Shelf> : null;
    }
    case "editorial_playlists": {
      const list = ids.length ? await queryPlaylists({ where: inArray(playlists.id, ids), limit: 20 }) : await queryPlaylists({ where: eq(playlists.editorial, true), limit: 20 });
      return list.length ? <Shelf title={s.title} subtitle={s.subtitle}>{list.map((p) => <PlaylistCardC key={p.id} p={p} />)}</Shelf> : null;
    }
    case "public_playlists": {
      const list = await queryPlaylists({ where: and(eq(playlists.isPublic, true), eq(playlists.editorial, false), sql`exists(select 1 from playlist_tracks pt where pt.playlist_id = ${playlists.id})`), limit: 14 });
      return list.length ? <Shelf title={s.title} subtitle={s.subtitle} href="/explorar?tipo=playlists">{list.map((p) => <PlaylistCardC key={p.id} p={p} />)}</Shelf> : null;
    }
    case "artists": {
      const list = await queryArtists({ limit: 14, order: [sql`(select count(*) from artist_follows af where af.artist_id = ${artists.id}) desc`, asc(artists.name)] });
      return list.length ? <Shelf title={s.title} subtitle={s.subtitle} href="/explorar?tipo=artistas">{list.map((a) => <ArtistCardC key={a.id} a={a} />)}</Shelf> : null;
    }
    case "genres": {
      const rows = await db.execute<{ genre: string }>(sql`select genre from tracks where status = 'published' and genre <> '' group by genre order by count(*) desc limit 14`);
      return rows.rows.length ? <Shelf title={s.title} subtitle={s.subtitle}>{rows.rows.map((g, i) => <GenreTile key={g.genre} name={g.genre} index={i} />)}</Shelf> : null;
    }
    case "manual_tracks": {
      const list = await tracksByIds(ids, uid);
      return list.length ? <Shelf title={s.title} subtitle={s.subtitle}><TrackShelf tracks={list} /></Shelf> : null;
    }
    case "manual_albums": {
      const list = ids.length ? await queryAlbums({ where: inArray(albums.id, ids), limit: 30 }) : [];
      return list.length ? <Shelf title={s.title} subtitle={s.subtitle}>{list.map((a) => <AlbumCardC key={a.id} a={a} />)}</Shelf> : null;
    }
    case "manual_artists": {
      const list = ids.length ? await queryArtists({ where: inArray(artists.id, ids), limit: 30 }) : [];
      return list.length ? <Shelf title={s.title} subtitle={s.subtitle}>{list.map((a) => <ArtistCardC key={a.id} a={a} />)}</Shelf> : null;
    }
    case "manual_playlists": {
      const list = ids.length ? await queryPlaylists({ where: and(inArray(playlists.id, ids), eq(playlists.isPublic, true)), limit: 30 }) : [];
      return list.length ? <Shelf title={s.title} subtitle={s.subtitle}>{list.map((p) => <PlaylistCardC key={p.id} p={p} />)}</Shelf> : null;
    }
    case "banner": {
      const c = s.config ?? {};
      const href = c.href && /^(https?:\/\/|\/)/.test(c.href) ? c.href : null;
      const body = (
        <div className="relative flex min-h-[200px] items-end overflow-hidden rounded-2xl border border-white/10 bg-[#161616] p-6 sm:p-9">
          {c.imageUrl && /^(https?:\/\/|\/)/.test(c.imageUrl) && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={c.imageUrl} alt="" className="absolute inset-0 h-full w-full object-cover opacity-50 grayscale" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent" />
          <div className="relative max-w-xl">
            <h2 className="text-2xl font-extrabold tracking-tight sm:text-4xl">{s.title}</h2>
            {c.text && <p className="mt-2 text-white/70">{c.text}</p>}
            {href && <span className="btn-primary mt-4">{c.cta || "Saiba mais"}</span>}
          </div>
        </div>
      );
      return <div className="mb-9">{href ? <Link href={href}>{body}</Link> : body}</div>;
    }
    default:
      return null;
  }
}
