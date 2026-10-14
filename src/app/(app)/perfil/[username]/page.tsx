import Link from "next/link";
import { notFound } from "next/navigation";
import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { userFollows, users, playlists } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { historyData, queryPlaylists, userCounts } from "@/lib/queries";
import { Cover } from "@/components/Cover";
import { Empty, PlaylistCardC, Shelf } from "@/components/Cards";
import { FollowUserButton, ReportButton, ShareButton } from "@/components/Interactive";
import { TrackList } from "@/components/TrackList";

export const dynamic = "force-dynamic";

/** O parâmetro da URL pode chegar percent-encoded (nomes com acento/espaço). */
function safeDecode(v: string) {
  try {
    return decodeURIComponent(v);
  } catch {
    return v;
  }
}

export async function generateMetadata({ params }: { params: Promise<{ username: string }> }) {
  const raw = (await params).username;
  const name = safeDecode(raw);
  const [u] = await db.select().from(users).where(sql`lower(${users.username}) = lower(${name})`).limit(1);
  return u && u.profilePublic ? { title: `${u.displayName} (@${u.username})` } : { title: "Perfil" };
}

export default async function Profile({ params, searchParams }: { params: Promise<{ username: string }>; searchParams: Promise<{ lista?: string }> }) {
  const { username } = await params;
  const { lista } = await searchParams;
  const [viewer, settings] = await Promise.all([getCurrentUser(), getSettings()]);
  const name = safeDecode(username);
  const [u] = await db.select().from(users).where(and(sql`lower(${users.username}) = lower(${name})`, eq(users.status, "active"))).limit(1);
  if (!u) notFound();
  const self = viewer?.id === u.id;
  if (settings.socialEnabled !== "true" && !self) notFound();
  const isPrivate = !u.profilePublic && !self;
  const [counts, following] = await Promise.all([
    userCounts(u.id),
    viewer && !self ? db.select().from(userFollows).where(and(eq(userFollows.followerId, viewer.id), eq(userFollows.followingId, u.id))).limit(1) : Promise.resolve([]),
  ]);

  const head = (
    <header className="relative -mx-4 flex flex-col items-center gap-5 px-4 pb-6 pt-8 sm:flex-row sm:items-end md:-mx-8 md:px-8">
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-white/[0.1] to-transparent" />
      <div className="relative w-40 shrink-0 shadow-2xl shadow-black sm:w-48"><Cover src={u.avatarUrl} seed={u.id} title={u.displayName} round /></div>
      <div className="relative min-w-0 text-center sm:text-left">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/60">Perfil</p>
        <h1 className="mt-1 text-4xl font-extrabold tracking-tighter sm:text-6xl">{u.displayName}</h1>
        <p className="mt-1 text-white/50">@{u.username}</p>
        {!isPrivate && u.bio && <p className="mt-3 max-w-xl text-sm text-white/70">{u.bio}</p>}
        {!isPrivate && (
          <p className="mt-3 text-sm text-white/60">
            <Link href={`/perfil/${u.username}?lista=seguidores`} className="hover:underline"><b className="text-white">{counts.followers}</b> seguidores</Link> ·{" "}
            <Link href={`/perfil/${u.username}?lista=seguindo`} className="hover:underline"><b className="text-white">{counts.following}</b> seguindo</Link> · <b className="text-white">{counts.playlists}</b> playlists públicas
          </p>
        )}
      </div>
    </header>
  );

  if (isPrivate) {
    return <div className="mx-auto max-w-[1100px]">{head}<Empty title="Este perfil é privado" text="A pessoa escolheu não exibir o perfil publicamente." /></div>;
  }

  if (lista === "seguidores" || lista === "seguindo") {
    const rows = await db
      .select({ username: users.username, displayName: users.displayName, avatarUrl: users.avatarUrl })
      .from(userFollows)
      .innerJoin(users, eq(users.id, lista === "seguidores" ? userFollows.followerId : userFollows.followingId))
      .where(and(eq(lista === "seguidores" ? userFollows.followingId : userFollows.followerId, u.id), eq(users.status, "active"), eq(users.profilePublic, true)))
      .orderBy(desc(userFollows.createdAt))
      .limit(100);
    return (
      <div className="mx-auto max-w-[1100px]">
        {head}
        <h2 className="mb-4 text-xl font-bold">{lista === "seguidores" ? "Seguidores" : "Seguindo"}</h2>
        {rows.length === 0 ? <Empty title="Ninguém por aqui ainda" /> : (
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {rows.map((r) => (
              <Link key={r.username} href={`/perfil/${r.username}`} className="flex items-center gap-3 rounded-xl bg-white/[0.06] p-3 hover:bg-white/[0.12]">
                <div className="h-12 w-12"><Cover src={r.avatarUrl} seed={r.username} title={r.displayName} round /></div>
                <div className="min-w-0"><div className="truncate font-semibold">{r.displayName}</div><div className="text-xs text-white/45">@{r.username}</div></div>
              </Link>
            ))}
          </div>
        )}
        <Link href={`/perfil/${u.username}`} className="mt-6 inline-block text-sm text-white/60 underline">Voltar ao perfil</Link>
      </div>
    );
  }

  const pls = await queryPlaylists({ where: and(eq(playlists.ownerId, u.id), eq(playlists.isPublic, true)), limit: 20 });
  const showRecent = !u.historyPrivate && u.showActivity && (self || !!viewer || true);
  const recent = showRecent ? (await historyData(u.id, 8)).map((r) => ({ ...r, liked: false })) : [];

  return (
    <div className="mx-auto max-w-[1400px]">
      {head}
      <div className="mb-8 flex flex-wrap items-center gap-3">
        {self ? (
          <Link href="/configuracoes" className="btn-outline">Editar perfil</Link>
        ) : (
          <>
            <FollowUserButton userId={u.id} initial={following.length > 0} />
            <ReportButton type="user" id={u.id} label={`@${u.username}`} />
          </>
        )}
        <ShareButton path={`/perfil/${u.username}`} title={u.displayName} />
      </div>
      {pls.length > 0 ? <Shelf title="Playlists públicas">{pls.map((p) => <PlaylistCardC key={p.id} p={p} />)}</Shelf> : <p className="mb-8 text-sm text-white/45">Nenhuma playlist pública.</p>}
      {recent.length > 0 && (
        <section className="mb-8">
          <h2 className="mb-3 text-[22px] font-bold">Ouvidas recentemente</h2>
          <TrackList tracks={recent} showDate showIndex={false} />
        </section>
      )}
    </div>
  );
}
