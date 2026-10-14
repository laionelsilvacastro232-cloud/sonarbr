import Link from "next/link";
import { notFound } from "next/navigation";
import { and, asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { albums, artists, savedAlbums, tracks } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { isUuid, queryAlbums, queryTracks } from "@/lib/queries";
import { Cover } from "@/components/Cover";
import { AlbumCardC, Shelf } from "@/components/Cards";
import { PlayAllButton, SaveAlbumButton, ShareButton, ShuffleAllButton } from "@/components/Interactive";
import { TrackList } from "@/components/TrackList";
import { fmtDate, fmtTotal } from "@/lib/format";

export const dynamic = "force-dynamic";

async function load(id: string) {
  if (!isUuid(id)) return null;
  const [a] = await db
    .select({ id: albums.id, title: albums.title, kind: albums.kind, coverUrl: albums.coverUrl, releaseDate: albums.releaseDate, credits: albums.credits, artistId: albums.artistId, artistName: artists.name })
    .from(albums)
    .innerJoin(artists, eq(artists.id, albums.artistId))
    .where(and(eq(albums.id, id), eq(albums.published, true), eq(artists.published, true)))
    .limit(1);
  return a ?? null;
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const a = await load((await params).id);
  return a ? { title: `${a.title} — ${a.artistName}`, openGraph: { title: a.title, description: a.artistName, images: a.coverUrl ? [a.coverUrl] : [] } } : { title: "Álbum não encontrado" };
}

export default async function AlbumPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  const album = await load(id);
  if (!album) notFound();
  const [list, saved, more] = await Promise.all([
    queryTracks({ where: eq(tracks.albumId, id), order: [asc(tracks.trackNumber), asc(tracks.title)], userId: user?.id, limit: 300 }),
    user ? db.select().from(savedAlbums).where(and(eq(savedAlbums.userId, user.id), eq(savedAlbums.albumId, id))).limit(1) : Promise.resolve([]),
    queryAlbums({ where: eq(albums.artistId, album.artistId), limit: 12 }),
  ]);
  const total = list.reduce((s, t) => s + t.durationSec, 0);
  const kind = album.kind === "single" ? "Single" : album.kind === "ep" ? "EP" : "Álbum";
  const others = more.filter((a) => a.id !== id);

  return (
    <div className="mx-auto max-w-[1200px]">
      <header className="flex flex-col items-center gap-6 pt-4 sm:flex-row sm:items-end">
        <div className="w-56 shrink-0 shadow-2xl shadow-black sm:w-60"><Cover src={album.coverUrl} seed={album.id} title={album.title} /></div>
        <div className="min-w-0 text-center sm:text-left">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/50">{kind}</p>
          <h1 className="mt-2 text-4xl font-extrabold tracking-tighter sm:text-6xl">{album.title}</h1>
          <p className="mt-3 text-sm text-white/70">
            <Link href={`/artista/${album.artistId}`} className="font-semibold text-white hover:underline">{album.artistName}</Link>
            {album.releaseDate && <> · {fmtDate(album.releaseDate)}</>} · {list.length} {list.length === 1 ? "faixa" : "faixas"}
            {total > 0 && <>, {fmtTotal(total)}</>}
          </p>
        </div>
      </header>
      <div className="my-7 flex flex-wrap items-center gap-4">
        <PlayAllButton tracks={list} />
        <ShuffleAllButton tracks={list} />
        <SaveAlbumButton albumId={id} initial={saved.length > 0} />
        <ShareButton path={`/album/${id}`} title={`${album.title} — ${album.artistName}`} />
      </div>
      <TrackList tracks={list} showAlbum={false} emptyText="Este álbum ainda não possui faixas publicadas." />
      <section className="mt-10 grid gap-6 md:grid-cols-2">
        <div className="panel">
          <h2 className="mb-2 font-bold">Créditos</h2>
          <p className="whitespace-pre-line text-sm text-white/70">{album.credits || "Créditos não informados."}</p>
        </div>
      </section>
      {others.length > 0 && <div className="mt-10"><Shelf title={`Mais de ${album.artistName}`}>{others.map((a) => <AlbumCardC key={a.id} a={a} />)}</Shelf></div>}
    </div>
  );
}
