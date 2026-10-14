import { getCurrentUser, rateLimit, clientIp } from "@/lib/auth";
import { searchAll } from "@/lib/queries";
import { ensureBootstrap } from "@/lib/bootstrap";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const q = (new URL(req.url).searchParams.get("q") ?? "").trim().slice(0, 80);
  if (q.length < 2) return Response.json({ tracks: [], artists: [], albums: [], playlists: [], users: [] });
  if (!rateLimit(`suggest:${await clientIp()}`, 120, 60_000)) return Response.json({ error: "Muitas requisições" }, { status: 429 });
  try {
    void ensureBootstrap();
    const user = await getCurrentUser();
    const r = await searchAll(q, user?.id, 4);
    return Response.json(
      {
        tracks: r.tracks.map((t) => ({ id: t.id, title: t.title, sub: t.artistName, cover: t.coverUrl })),
        artists: r.artists.slice(0, 3).map((a) => ({ id: a.id, title: a.name, cover: a.imageUrl })),
        albums: r.albums.slice(0, 3).map((a) => ({ id: a.id, title: a.title, sub: a.artistName, cover: a.coverUrl })),
        playlists: r.playlists.slice(0, 3).map((p) => ({ id: p.id, title: p.name, sub: p.ownerName ?? "Editorial", cover: p.coverUrl ?? p.covers[0] ?? null })),
        users: r.users.slice(0, 3).map((u) => ({ id: u.username, title: u.displayName, sub: `@${u.username}`, cover: u.avatarUrl })),
      },
      { headers: { "Cache-Control": "private, max-age=10" } },
    );
  } catch {
    return Response.json({ error: "Falha ao buscar" }, { status: 500 });
  }
}
