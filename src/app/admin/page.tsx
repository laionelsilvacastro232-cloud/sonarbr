import { desc, sql } from "drizzle-orm";
import { db } from "@/db";
import { eventLogs } from "@/db/schema";
import { emailConfigured } from "@/lib/email";
import { fmtDateTime } from "@/lib/format";
import { access, constants } from "node:fs/promises";
import { STORAGE_DIR } from "@/lib/storage";
import { mkdir } from "node:fs/promises";

export const dynamic = "force-dynamic";

async function ping(url: string) {
  const t = Date.now();
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(5000), cache: "no-store" });
    return { ok: r.ok, ms: Date.now() - t };
  } catch {
    return { ok: false, ms: Date.now() - t };
  }
}

export default async function Overview() {
  const q = await db.execute<Record<string, number>>(sql`
    select
      (select count(*)::int from users) users,
      (select count(*)::int from users where status = 'suspended') suspended,
      (select count(distinct user_id)::int from play_history where played_at > now() - interval '7 days') active7,
      (select count(*)::int from tracks where status = 'published') tracks_pub,
      (select count(*)::int from tracks) tracks_all,
      (select count(*)::int from tracks where status = 'pending') tracks_pending,
      (select count(*)::int from artists) artists,
      (select count(*)::int from albums) albums,
      (select count(*)::int from playlists) playlists,
      (select coalesce(sum(play_count),0)::int from tracks) plays,
      (select count(*)::int from play_history where played_at > now() - interval '24 hours') plays24,
      (select count(*)::int from event_logs where created_at > now() - interval '24 hours') errors24,
      (select count(*)::int from reports where status = 'open') reports_open
  `);
  const s = q.rows[0];
  const errors = await db.select().from(eventLogs).orderBy(desc(eventLogs.createdAt)).limit(10);
  await mkdir(STORAGE_DIR, { recursive: true }).catch(() => {});
  const [itunes, dbMs, storageOk] = await Promise.all([
    ping("https://itunes.apple.com/search?term=test&limit=1"),
    (async () => { const t = Date.now(); await db.execute(sql`select 1`); return Date.now() - t; })(),
    access(STORAGE_DIR, constants.W_OK).then(() => true).catch(() => false),
  ]);
  const cards: [string, number | string, string?][] = [
    ["Usuários", s.users, `${s.suspended} suspensos`],
    ["Ativos (7 dias)", s.active7, "com reproduções registradas"],
    ["Faixas publicadas", s.tracks_pub, `${s.tracks_all} no total · ${s.tracks_pending} em revisão`],
    ["Artistas", s.artists],
    ["Álbuns", s.albums],
    ["Playlists", s.playlists],
    ["Reproduções (total)", s.plays, `${s.plays24} registradas em 24 h`],
    ["Erros (24 h)", s.errors24],
    ["Denúncias abertas", s.reports_open],
  ];
  const services: [string, boolean, string][] = [
    ["Banco de dados PostgreSQL", true, `${dbMs} ms`],
    ["iTunes Search API (prévias)", itunes.ok, `${itunes.ms} ms`],
    ["Jamendo (JAMENDO_CLIENT_ID)", !!process.env.JAMENDO_CLIENT_ID, process.env.JAMENDO_CLIENT_ID ? "configurado" : "pendente de configuração"],
    ["E-mail (RESEND_API_KEY + EMAIL_FROM)", emailConfigured(), emailConfigured() ? "configurado" : "pendente de configuração"],
    ["Armazenamento de uploads (disco local)", storageOk, STORAGE_DIR],
  ];
  return (
    <div className="mx-auto max-w-[1200px]">
      <h1 className="mb-6 text-3xl font-extrabold tracking-tight">Visão geral</h1>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        {cards.map(([l, v, sub]) => (
          <div key={l} className="panel">
            <p className="text-xs font-semibold uppercase tracking-wider text-white/45">{l}</p>
            <p className="mt-2 text-3xl font-extrabold tabular-nums">{v}</p>
            {sub && <p className="mt-1 text-xs text-white/45">{sub}</p>}
          </div>
        ))}
      </div>
      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <section className="panel">
          <h2 className="mb-3 font-bold">Serviços conectados</h2>
          <ul className="divide-y divide-white/10 text-sm">
            {services.map(([n, ok, d]) => (
              <li key={n} className="flex items-center justify-between gap-3 py-2.5">
                <span>{n}</span>
                <span className={`text-right text-xs ${ok ? "text-white" : "text-white/45"}`}>{ok ? "● " : "○ "}{d}</span>
              </li>
            ))}
          </ul>
        </section>
        <section className="panel">
          <h2 className="mb-3 font-bold">Erros recentes</h2>
          {errors.length === 0 ? <p className="text-sm text-white/45">Nenhum erro registrado.</p> : (
            <ul className="space-y-2 text-xs">
              {errors.map((e) => <li key={e.id} className="rounded-lg bg-white/5 p-2.5"><span className="text-white/40">{fmtDateTime(e.createdAt)} · {e.source}</span><br />{e.message}</li>)}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
