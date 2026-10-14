import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { supportMessages, supportTickets, users } from "@/db/schema";
import { supportReply, supportSetStatus } from "@/app/admin/actions";
import { ABtn, AForm } from "@/components/AdminUi";
import { fmtDateTime } from "@/lib/format";
import Link from "next/link";

export const metadata = { title: "Suporte" };
export const dynamic = "force-dynamic";

const STATUS: Record<string, string> = { open: "Aguardando", answered: "Respondida", closed: "Encerrada" };

export default async function AdminSupport({ searchParams }: { searchParams: Promise<{ t?: string }> }) {
  const { t } = await searchParams;
  if (t) {
    const [tk] = await db.select().from(supportTickets).where(eq(supportTickets.id, t)).limit(1);
    if (!tk) return <p className="text-sm text-white/50">Conversa não encontrada. <Link className="underline" href="/admin/suporte">Voltar</Link></p>;
    const [msgs, uRows] = await Promise.all([
      db.select().from(supportMessages).where(eq(supportMessages.ticketId, t)).orderBy(supportMessages.createdAt).limit(200),
      tk.userId
        ? db.select({ username: users.username, email: users.email, displayName: users.displayName }).from(users).where(eq(users.id, tk.userId)).limit(1)
        : Promise.resolve([]),
    ]);
    const u = uRows[0];
    return (
      <div className="mx-auto max-w-[860px]">
        <Link href="/admin/suporte" className="mb-4 inline-block text-sm text-white/60 underline">← Voltar para o suporte</Link>
        <h1 className="mb-1 text-2xl font-extrabold tracking-tight">{tk.subject}</h1>
        <p className="mb-6 text-sm text-white/50">{u ? `${u.displayName} (@${u.username}) · ${u.email}` : "Conta removida"} · {STATUS[tk.status]} · {fmtDateTime(tk.createdAt)}</p>
        <div className="mb-6 space-y-3">
          {msgs.map((m) => (
            <div key={m.id} className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm ${m.fromSupport ? "ml-auto bg-white text-black" : "bg-white/10"}`}>
              <p className="mb-0.5 text-[11px] font-bold uppercase tracking-wider opacity-60">{m.fromSupport ? "Suporte" : u?.displayName ?? "Usuário"}</p>
              <p className="whitespace-pre-line">{m.body}</p>
              <p className="mt-1 text-[10px] opacity-50">{fmtDateTime(m.createdAt)}</p>
            </div>
          ))}
          {msgs.length === 0 && <p className="text-sm text-white/45">Sem mensagens.</p>}
        </div>
        <AForm action={supportReply} submit="Responder" className="panel space-y-3">
          <input type="hidden" name="ticketId" value={t} />
          <label className="label" htmlFor="rb">Responder como “Suporte do aplicativo” (sem nome pessoal)</label>
          <textarea id="rb" name="body" rows={5} maxLength={2000} required className="field" />
        </AForm>
      </div>
    );
  }

  const rows = await db
    .select({ tk: supportTickets, username: users.username, displayName: users.displayName })
    .from(supportTickets)
    .leftJoin(users, eq(users.id, supportTickets.userId))
    .orderBy(desc(supportTickets.updatedAt))
    .limit(100);
  return (
    <div className="mx-auto max-w-[1000px]">
      <h1 className="mb-5 text-3xl font-extrabold tracking-tight">Suporte</h1>
      <div className="panel overflow-x-auto !p-0">
        <table className="tbl">
          <thead><tr><th>Assunto</th><th>Usuário</th><th>Status</th><th>Atualizada</th><th>Ações</th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.tk.id}>
                <td><Link href={`/admin/suporte?t=${r.tk.id}`} className="font-semibold underline">{r.tk.subject}</Link></td>
                <td>{r.displayName ? `${r.displayName} (@${r.username})` : "—"}</td>
                <td>{STATUS[r.tk.status]}</td>
                <td>{fmtDateTime(r.tk.updatedAt)}</td>
                <td><div className="flex gap-2">
                  <Link className="btn-outline !h-8 !px-3 !text-xs" href={`/admin/suporte?t=${r.tk.id}`}>Abrir</Link>
                  <ABtn run={supportSetStatus.bind(null, r.tk.id, r.tk.status === "closed" ? "open" : "closed")} label={r.tk.status === "closed" ? "Reabrir" : "Encerrar"} />
                </div></td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={5} className="text-white/45">Nenhuma conversa aberta.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
