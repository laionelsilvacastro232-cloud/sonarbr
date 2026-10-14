import Link from "next/link";
import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { playlistCollaborators, savedPlaylists, users } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { isUuid, playlistAccess, playlistTrackList, queryPlaylists } from "@/lib/queries";
import { Cover, PlaylistMosaic } from "@/components/Cover";
import { DuplicateButton, PlayAllButton, ReportButton, SavePlaylistButton, ShareButton, ShuffleAllButton } from "@/components/Interactive";
import { PlaylistSettings } from "@/components/PlaylistSettings";
import { TrackList } from "@/components/TrackList";
import { fmtTotal } from "@/lib/format";
import { IconGlobe, IconLock, IconUsers } from "@/components/Icons";
import { playlists } from "@/db/schema";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isUuid(id)) return { title: "Playlist" };
  const [p] = await db.select().from(playlists).where(eq(playlists.id, id)).limit(1);
  // não vaza dados de playlists privadas
  return p && p.isPublic ? { title: p.name, openGraph: { title: p.name, description: p.description || "Playlist", images: p.coverUrl ? [p.coverUrl] : [] } } : { title: "Playlist" };
}

export default async function PlaylistPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const user = await getCurrentUser();
  const acc = await playlistAccess(id, user?.id);
  if (!acc || !acc.canView) notFound();
  const pl = acc.playlist;
  const [list, [card], owner, saved, collabs] = await Promise.all([
    playlistTrackList(id, user?.id),
    queryPlaylists({ where: eq(playlists.id, id), limit: 1 }),
    pl.ownerId ? db.select({ username: users.username, displayName: users.displayName }).from(users).where(eq(users.id, pl.ownerId)).limit(1) : Promise.resolve([]),
    user ? db.select().from(savedPlaylists).where(and(eq(savedPlaylists.userId, user.id), eq(savedPlaylists.playlistId, id))).limit(1) : Promise.resolve([]),
    db
      .select({ id: users.id, username: users.username, displayName: users.displayName })
      .from(playlistCollaborators)
      .innerJoin(users, eq(users.id, playlistCollaborators.userId))
      .where(eq(playlistCollaborators.playlistId, id)),
  ]);
  const total = list.reduce((s, t) => s + t.durationSec, 0);
  const o = owner[0];

  return (
    <div className="mx-auto max-w-[1200px]">
      <header className="flex flex-col items-center gap-6 pt-4 sm:flex-row sm:items-end">
        <div className="w-56 shrink-0 shadow-2xl shadow-black sm:w-60">
          {pl.coverUrl ? <Cover src={pl.coverUrl} seed={pl.id} title={pl.name} /> : <PlaylistMosaic covers={card?.covers ?? []} seed={pl.id} name={pl.name} />}
        </div>
        <div className="min-w-0 text-center sm:text-left">
          <p className="flex items-center justify-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-white/50 sm:justify-start">
            {pl.editorial ? "Playlist editorial" : pl.isPublic ? <><IconGlobe size={14} /> Playlist pública</> : <><IconLock size={14} /> Playlist privada</>}
            {pl.collaborative && <><IconUsers size={14} /> Colaborativa</>}
          </p>
          <h1 className="mt-2 break-words text-4xl font-extrabold tracking-tighter sm:text-6xl">{pl.name}</h1>
          {pl.description && <p className="mt-3 max-w-2xl text-sm text-white/60">{pl.description}</p>}
          <p className="mt-3 text-sm text-white/70">
            {o ? <Link href={`/perfil/${o.username}`} className="font-semibold text-white hover:underline">{o.displayName}</Link> : <span className="font-semibold text-white">Curadoria da plataforma</span>}
            {" · "}{list.length} {list.length === 1 ? "música" : "músicas"}{total > 0 && <>, {fmtTotal(total)}</>}
          </p>
        </div>
      </header>

      <div className="my-7 flex flex-wrap items-center gap-3">
        <PlayAllButton tracks={list} />
        <ShuffleAllButton tracks={list} />
        {!acc.isOwner && <SavePlaylistButton playlistId={id} initial={saved.length > 0} />}
        {acc.isOwner && <PlaylistSettings playlist={{ id: pl.id, name: pl.name, description: pl.description, coverUrl: pl.coverUrl, isPublic: pl.isPublic, collaborative: pl.collaborative }} collaborators={collabs} />}
        <DuplicateButton playlistId={id} />
        {pl.isPublic && <ShareButton path={`/playlist/${id}`} title={pl.name} />}
        {!acc.isOwner && <ReportButton type="playlist" id={id} label={pl.name} />}
      </div>
      {!pl.isPublic && acc.isOwner && <p className="mb-4 text-xs text-white/45">Somente você{pl.collaborative ? " e os colaboradores" : ""} podem ver esta playlist. Torne-a pública em Editar para compartilhar.</p>}

      <TrackList
        tracks={list}
        playlistId={id}
        canEdit={acc.canEdit}
        emptyText={acc.canEdit ? "Playlist vazia. Use o menu “Adicionar à playlist” em qualquer música ou pesquise para começar." : "Esta playlist está vazia."}
      />
    </div>
  );
}
