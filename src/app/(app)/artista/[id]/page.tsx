import { notFound } from "next/navigation";
import { and, desc, eq, ne, sql } from "drizzle-orm";
import { db } from "@/db";
import { albums, artistFollows, artistPosts, artists, playlistTracks, playlists, tracks } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { isUuid, queryAlbums, queryArtists, queryPlaylists, queryTracks } from "@/lib/queries";
import { Cover } from "@/components/Cover";
import { AlbumCardC, ArtistCardC, PlaylistCardC, Shelf } from "@/components/Cards";
import { FollowArtistButton, PlayAllButton, ReportButton, ShareButton, ShuffleAllButton } from "@/components/Interactive";
import { TrackList } from "@/components/TrackList";

export const dynamic = "force-dynamic";

async function load(id: string) {
  if (!isUuid(id)) return null;
  const [a] = await db.select().from(artists).where(and(eq(artists.id, id), eq(artists.published, true))).limit(1);
  return a ?? null;
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const a = await load((await params).id);
  return a ? { title: a.name, openGraph: { title: a.name, description: a.bio.slice(0, 160), images: a.imageUrl ? [a.imageUrl] : [] } } : { title: "Artista não encontrado" };
}

export default async function ArtistPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [user, artist] = await Promise.all([getCurrentUser(), load(id)]);
  if (!artist) notFound();
  const [posts, top, discog, pls, followers, following, genres] = await Promise.all([
    db.select().from(artistPosts).where(and(eq(artistPosts.artistId, id), eq(artistPosts.status, "published"))).orderBy(desc(artistPosts.createdAt)).limit(12),
    queryTracks({ where: eq(tracks.artistId, id), userId: user?.id, limit: 10 }),
    queryAlbums({ where: eq(albums.artistId, id), limit: 60 }),
    queryPlaylists({
      where: and(eq(playlists.isPublic, true), sql`exists(select 1 from ${playlistTracks} pt join ${tracks} t on t.id = pt.track_id where pt.playlist_id = ${playlists.id} and t.artist_id = ${id})`),
      limit: 10,
    }),
    db.select({ n: sql<number>`count(*)::int` }).from(artistFollows).where(eq(artistFollows.artistId, id)),
    user ? db.select().from(artistFollows).where(and(eq(artistFollows.userId, user.id), eq(artistFollows.artistId, id))).limit(1) : Promise.resolve([]),
    db.execute<{ genre: string }>(sql`select genre from tracks where artist_id = ${id} and genre <> '' group by genre order by count(*) desc limit 3`),
  ]);
  // artistas relacionados: mesmos gêneros
  const gl = genres.rows.map((g) => g.genre);
  const related = gl.length
    ? await queryArtists({ where: and(ne(artists.id, id), sql`exists(select 1 from ${tracks} t where t.artist_id = ${artists.id} and t.genre in (${sql.join(gl.map((g) => sql`${g}`), sql`, `)}))`), limit: 10 })
    : [];
  void desc;
  const albs = discog.filter((a) => a.kind === "album");
  const singles = discog.filter((a) => a.kind === "single");
  const eps = discog.filter((a) => a.kind === "ep");
  const latest = discog[0];

  return (
    <div className="mx-auto max-w-[1400px]">
      <header className="relative -mx-4 mb-6 flex flex-col items-center gap-5 overflow-hidden px-4 pb-6 pt-8 sm:flex-row sm:items-end md:-mx-8 md:px-8">
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-white/[0.1] to-transparent" />
        <div className="relative w-44 shrink-0 shadow-2xl shadow-black sm:w-56"><Cover src={artist.imageUrl} seed={artist.id} title={artist.name} round /></div>
        <div className="relative min-w-0 text-center sm:text-left">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/60">Artista</p>
          <h1 className="mt-1 text-5xl font-extrabold tracking-tighter sm:text-7xl">{artist.name}</h1>
          <p className="mt-3 text-sm text-white/60">{followers[0].n} {followers[0].n === 1 ? "seguidor" : "seguidores"}{gl.length ? ` · ${gl.join(", ")}` : ""}</p>
        </div>
      </header>

      <div className="mb-8 flex flex-wrap items-center gap-4">
        <PlayAllButton tracks={top} />
        <ShuffleAllButton tracks={top} />
        <FollowArtistButton artistId={id} initial={following.length > 0} />
        <ShareButton path={`/artista/${id}`} title={artist.name} />
        <ReportButton type="artist" id={id} label={artist.name} />
      </div>

      {latest && (
        <a href={`/album/${latest.id}`} className="mb-8 flex max-w-xl items-center gap-4 rounded-xl border border-white/10 bg-white/[0.04] p-3 hover:bg-white/[0.09]">
          <div className="h-20 w-20 shrink-0"><Cover src={latest.coverUrl} seed={latest.id} title={latest.title} /></div>
          <div><p className="text-[11px] uppercase tracking-wider text-white/45">Lançamento mais recente</p><p className="font-bold">{latest.title}</p><p className="text-xs text-white/50">{latest.releaseDate?.slice(0, 4)}</p></div>
        </a>
      )}

      <section className="mb-10">
        <h2 className="mb-3 text-[22px] font-bold">Populares</h2>
        <TrackList tracks={top} emptyText="Este artista ainda não possui faixas publicadas." />
      </section>

      {posts.length > 0 && (
        <section className="mb-10">
          <h2 className="mb-3 text-[22px] font-bold">Novidades</h2>
          <div className="grid gap-3 md:grid-cols-2">
            {posts.map((p) => (
              <article key={p.id} className="panel !p-5">
                {p.coverUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.coverUrl} alt="" className="mb-3 aspect-video w-full rounded-lg object-cover" />
                )}
                <h3 className="font-bold">{p.title}</h3>
                {p.body && <p className="mt-1 whitespace-pre-line text-sm leading-relaxed text-white/65">{p.body}</p>}
                <p className="mt-2 text-xs text-white/35">{new Date(p.createdAt).toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" })}</p>
              </article>
            ))}
          </div>
        </section>
      )}

      {albs.length > 0 && <Shelf title="Álbuns">{albs.map((a) => <AlbumCardC key={a.id} a={a} />)}</Shelf>}
      {singles.length > 0 && <Shelf title="Singles">{singles.map((a) => <AlbumCardC key={a.id} a={a} />)}</Shelf>}
      {eps.length > 0 && <Shelf title="EPs">{eps.map((a) => <AlbumCardC key={a.id} a={a} />)}</Shelf>}
      {pls.length > 0 && <Shelf title={`Playlists com ${artist.name}`}>{pls.map((p) => <PlaylistCardC key={p.id} p={p} />)}</Shelf>}
      {related.length > 0 && <Shelf title="Artistas relacionados" subtitle="Gêneros em comum">{related.map((a) => <ArtistCardC key={a.id} a={a} />)}</Shelf>}

      <section className="mb-10 grid gap-6 md:grid-cols-2">
        <div className="panel">
          <h2 className="mb-2 font-bold">Sobre</h2>
          <p className="whitespace-pre-line text-sm leading-relaxed text-white/70">{artist.bio || "Biografia ainda não cadastrada."}</p>
        </div>
        {artist.links.length > 0 && (
          <div className="panel">
            <h2 className="mb-2 font-bold">Links oficiais</h2>
            <ul className="space-y-2 text-sm">
              {artist.links.filter((l) => /^https?:\/\//.test(l.url)).map((l) => (
                <li key={l.url}><a href={l.url} target="_blank" rel="noopener noreferrer" className="underline decoration-white/30 underline-offset-4 hover:decoration-white">{l.label}</a></li>
              ))}
            </ul>
          </div>
        )}
      </section>
    </div>
  );
}
