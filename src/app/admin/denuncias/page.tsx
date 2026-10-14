import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { reports, users } from "@/db/schema";
import { resolveReport } from "@/app/admin/actions";
import { ABtn } from "@/components/AdminUi";
import { fmtDateTime } from "@/lib/format";
import Link from "next/link";

export const metadata = { title: "Denúncias" };
export const dynamic = "force-dynamic";

const href = (t: string, id: string) => (t === "track" ? `/musica/${id}` : t === "playlist" ? `/playlist/${id}` : t === "artist" ? `/artista/${id}` : null);

export default async function Reports({ searchParams }: { searchParams: Promise<{ s?: string }> }) {
  const { s = "open" } = await searchParams;
  const rows = await db
    .select({ r: reports, reporter: users.username })
    .from(reports)
    .leftJoin(users, eq(users.id, reports.reporterId))
    .where(s === "all" ? undefined : eq(reports.status, s))
    .orderBy(desc(reports.createdAt))
    .limit(100);
  return (
    <div className="mx-auto max-w-[1100px]">
      <h1 className="mb-5 text-3xl font-extrabold tracking-tight">Denúncias</h1>
      <div className="mb-5 flex gap-2">{[["open", "Abertas"], ["resolved", "Resolvidas"], ["dismissed", "Arquivadas"], ["all", "Todas"]].map(([k, l]) => <Link key={k} href={`/admin/denuncias?s=${k}`} data-active={s === k} className="chip">{l}</Link>)}</div>
      <div className="space-y-3">
        {rows.map(({ r, reporter }) => (
          <div key={r.id} className="panel">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold">{r.reason} <span className="font-normal text-white/45">· {r.targetType} · {fmtDateTime(r.createdAt)} · por {reporter ? `@${reporter}` : "conta removida"}</span></p>
                {r.details && <p className="mt-1 text-sm text-white/65">{r.details}</p>}
                {href(r.targetType, r.targetId) && <Link className="mt-1 inline-block text-xs underline" href={href(r.targetType, r.targetId)!}>Abrir conteúdo</Link>}
                {r.status !== "open" && <p className="mt-1 text-xs text-white/45">{r.status === "resolved" ? "Resolvida" : "Arquivada"}: {r.resolution}</p>}
              </div>
              {r.status === "open" && (
                <div className="flex flex-wrap gap-2">
                  <ABtn run={resolveReport.bind(null, r.id, "resolved", true)} label="Remover/restringir conteúdo" danger confirmText="Aplicar medida ao alvo (despublicar/tornar privado/suspender)?" />
                  <ABtn run={resolveReport.bind(null, r.id, "resolved", false)} label="Marcar resolvida" />
                  <ABtn run={resolveReport.bind(null, r.id, "dismissed", false)} label="Arquivar" />
                </div>
              )}
            </div>
          </div>
        ))}
        {rows.length === 0 && <p className="text-sm text-white/45">Nenhuma denúncia nesta categoria.</p>}
      </div>
    </div>
  );
}
