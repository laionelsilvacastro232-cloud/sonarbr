import Link from "next/link";
import { desc, ilike, or } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { requireAdmin } from "@/lib/auth";
import { approveArtist, generateResetLink, reactivateUser, setUserRole } from "@/app/admin/actions";
import { ABtn, Reason } from "@/components/AdminUi";
import { fmtDate } from "@/lib/format";

export const metadata = { title: "Usuários" };
export const dynamic = "force-dynamic";
const PER = 40;

export default async function UsersPage({ searchParams }: { searchParams: Promise<{ q?: string; p?: string }> }) {
  const admin = await requireAdmin();
  const { q = "", p = "1" } = await searchParams;
  const page = Math.max(1, parseInt(p) || 1);
  const like = `%${q.trim()}%`;
  // Nunca seleciona passwordHash
  const rows = await db
    .select({ id: users.id, email: users.email, username: users.username, displayName: users.displayName, role: users.role, status: users.status, suspendedReason: users.suspendedReason, artistRequest: users.artistRequest, artistId: users.artistId, createdAt: users.createdAt, verified: users.emailVerifiedAt })
    .from(users)
    .where(q ? or(ilike(users.email, like), ilike(users.username, like), ilike(users.displayName, like)) : undefined)
    .orderBy(desc(users.createdAt))
    .limit(PER + 1)
    .offset((page - 1) * PER);
  return (
    <div className="mx-auto max-w-[1200px]">
      <h1 className="mb-5 text-3xl font-extrabold tracking-tight">Usuários</h1>
      <form className="mb-4 flex gap-2"><input name="q" defaultValue={q} placeholder="E-mail, usuário ou nome" className="field !w-72" /><button className="btn-outline">Buscar</button></form>
      <div className="panel overflow-x-auto !p-0">
        <table className="tbl">
          <thead><tr><th>Usuário</th><th>Papel</th><th>Status</th><th>Criado</th><th>Ações</th></tr></thead>
          <tbody>
            {rows.slice(0, PER).map((u) => (
              <tr key={u.id}>
                <td><Link href={`/perfil/${u.username}`} className="font-semibold hover:underline">{u.displayName}</Link><br /><span className="text-xs text-white/45">{u.email}{u.verified ? " · verificado" : ""}</span></td>
                <td>{u.role}{u.artistRequest && <span className="ml-2 rounded border border-white/30 px-1.5 text-[10px]">pede artista</span>}</td>
                <td>{u.status === "active" ? "Ativa" : <span title={u.suspendedReason ?? ""}>Suspensa</span>}</td>
                <td>{fmtDate(u.createdAt)}</td>
                <td>
                  {u.id === admin.id ? <span className="text-xs text-white/40">você</span> : (
                    <div className="flex flex-wrap items-start gap-2">
                      {(u.artistRequest || u.role === "user") && <ABtn run={approveArtist.bind(null, u.id)} label={u.artistRequest ? "Aprovar artista" : "Tornar artista"} />}
                      {u.role !== "admin" ? <ABtn run={setUserRole.bind(null, u.id, "admin")} label="Promover a admin" confirmText={`Dar acesso administrativo a ${u.email}?`} /> : <ABtn run={setUserRole.bind(null, u.id, "user")} label="Remover admin" confirmText="Remover acesso administrativo?" />}
                      <ABtn run={generateResetLink.bind(null, u.id)} label="Link de senha" />
                      {u.status === "active" ? <Reason label="Suspender" userId={u.id} /> : <ABtn run={reactivateUser.bind(null, u.id)} label="Reativar" />}
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-4 flex justify-between">
        {page > 1 ? <Link className="btn-outline" href={`/admin/usuarios?q=${encodeURIComponent(q)}&p=${page - 1}`}>Anterior</Link> : <span />}
        {rows.length > PER && <Link className="btn-outline" href={`/admin/usuarios?q=${encodeURIComponent(q)}&p=${page + 1}`}>Próxima</Link>}
      </div>
    </div>
  );
}
