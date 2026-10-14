import Link from "next/link";
import { and, eq, sql } from "drizzle-orm";
import { playlists } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { queryAlbums, queryArtists, queryPlaylists, queryTracks } from "@/lib/queries";
import { AlbumCardC, ArtistCardC, PageHeader, PlaylistCardC } from "@/components/Cards";
import { TrackList } from "@/components/TrackList";

export const metadata = { title: "Explorar" };
export const dynamic = "force-dynamic";
const PER = 30;

export default async function Explore({ searchParams }: { searchParams: Promise<{ tipo?: string; p?: string }> }) {
  const { tipo = "musicas", p = "1" } = await searchParams;
  const page = Math.max(1, parseInt(p) || 1);
  const user = await getCurrentUser();
  const off = (page - 1) * PER;
  const grid = "grid grid-cols-2 gap-1 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6 [&>div]:!w-full";
  let body;
  let n = 0;
  if (tipo === "albuns") {
    const l = await queryAlbums({ limit: PER + 1, offset: off });
    n = l.length;
    body = <div className={grid}>{l.slice(0, PER).map((a) => <AlbumCardC key={a.id} a={a} />)}</div>;
  } else if (tipo === "artistas") {
    const l = await queryArtists({ limit: PER + 1, offset: off });
    n = l.length;
    body = <div className={grid}>{l.slice(0, PER).map((a) => <ArtistCardC key={a.id} a={a} />)}</div>;
  } else if (tipo === "playlists") {
    const l = await queryPlaylists({ where: and(eq(playlists.isPublic, true), sql`exists(select 1 from playlist_tracks pt where pt.playlist_id = ${playlists.id})`), limit: PER + 1, offset: off });
    n = l.length;
    body = <div className={grid}>{l.slice(0, PER).map((x) => <PlaylistCardC key={x.id} p={x} />)}</div>;
  } else {
    const l = await queryTracks({ userId: user?.id, limit: PER + 1, offset: off });
    n = l.length;
    body = <TrackList tracks={l.slice(0, PER)} />;
  }
  const tabs = [["musicas", "Músicas"], ["albuns", "Álbuns"], ["artistas", "Artistas"], ["playlists", "Playlists"]];
  return (
    <div className="mx-auto max-w-[1400px]">
      <PageHeader eyebrow="Descobrir" title="Explorar o catálogo" />
      <div className="mb-6 flex gap-2 overflow-x-auto no-scrollbar">
        {tabs.map(([k, l]) => <Link key={k} href={`/explorar?tipo=${k}`} data-active={tipo === k} className="chip shrink-0">{l}</Link>)}
      </div>
      {body}
      <div className="mt-6 flex justify-between">
        {page > 1 ? <Link className="btn-outline" href={`/explorar?tipo=${tipo}&p=${page - 1}`}>Anterior</Link> : <span />}
        {n > PER && <Link className="btn-outline" href={`/explorar?tipo=${tipo}&p=${page + 1}`}>Próxima</Link>}
      </div>
    </div>
  );
}
