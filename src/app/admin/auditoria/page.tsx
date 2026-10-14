import Link from "next/link";
import { desc } from "drizzle-orm";
import { db } from "@/db";
import { auditLogs } from "@/db/schema";
import { fmtDateTime } from "@/lib/format";

export const metadata = { title: "Auditoria" };
export const dynamic = "force-dynamic";
const PER = 50;

export default async function Audit({ searchParams }: { searchParams: Promise<{ p?: string }> }) {
  const page = Math.max(1, parseInt((await searchParams).p ?? "1") || 1);
  const rows = await db.select().from(auditLogs).orderBy(desc(auditLogs.createdAt)).limit(PER + 1).offset((page - 1) * PER);
  return (
    <div className="mx-auto max-w-[1100px]">
      <h1 className="mb-5 text-3xl font-extrabold tracking-tight">Auditoria</h1>
      <div className="panel overflow-x-auto !p-0">
        <table className="tbl">
          <thead><tr><th>Quando</th><th>Administrador</th><th>Ação</th><th>Alvo</th><th>Detalhes</th></tr></thead>
          <tbody>
            {rows.slice(0, PER).map((r) => (
              <tr key={r.id}><td className="whitespace-nowrap">{fmtDateTime(r.createdAt)}</td><td>{r.actorEmail ?? "—"}</td><td className="font-mono text-xs">{r.action}</td><td className="max-w-[160px] truncate font-mono text-xs text-white/50">{r.target ?? "—"}</td><td className="max-w-[260px] truncate text-xs text-white/50">{Object.keys(r.meta).length ? JSON.stringify(r.meta) : ""}</td></tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={5} className="text-white/45">Sem registros.</td></tr>}
          </tbody>
        </table>
      </div>
      <div className="mt-4 flex justify-between">
        {page > 1 ? <Link className="btn-outline" href={`/admin/auditoria?p=${page - 1}`}>Anterior</Link> : <span />}
        {rows.length > PER && <Link className="btn-outline" href={`/admin/auditoria?p=${page + 1}`}>Próxima</Link>}
      </div>
    </div>
  );
}
