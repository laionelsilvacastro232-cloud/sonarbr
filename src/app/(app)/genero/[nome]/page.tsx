import { eq } from "drizzle-orm";
import { tracks } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { queryTracks } from "@/lib/queries";
import { PageHeader } from "@/components/Cards";
import { PlayAllButton, ShuffleAllButton } from "@/components/Interactive";
import { TrackList } from "@/components/TrackList";

export const dynamic = "force-dynamic";

export default async function Genre({ params }: { params: Promise<{ nome: string }> }) {
  const name = decodeURIComponent((await params).nome);
  const user = await getCurrentUser();
  const list = await queryTracks({ where: eq(tracks.genre, name), userId: user?.id, limit: 100 });
  return (
    <div className="mx-auto max-w-[1100px]">
      <PageHeader eyebrow="Gênero" title={name} />
      <div className="mb-6 flex items-center gap-4"><PlayAllButton tracks={list} /><ShuffleAllButton tracks={list} /></div>
      <TrackList tracks={list} emptyText="Nenhuma música neste gênero." />
    </div>
  );
}
