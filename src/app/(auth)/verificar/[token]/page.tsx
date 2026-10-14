import Link from "next/link";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { authTokens, users } from "@/db/schema";
import { sha256 } from "@/lib/auth";

export const metadata = { title: "Verificar e-mail" };
export const dynamic = "force-dynamic";

export default async function Verify({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const [t] = await db.select().from(authTokens).where(and(eq(authTokens.tokenHash, sha256(token)), eq(authTokens.kind, "verify"))).limit(1);
  let ok = false;
  if (t && !t.usedAt && t.expiresAt > new Date()) {
    await db.update(users).set({ emailVerifiedAt: new Date() }).where(eq(users.id, t.userId));
    await db.update(authTokens).set({ usedAt: new Date() }).where(eq(authTokens.id, t.id));
    ok = true;
  }
  return (
    <div className="text-center">
      <h1 className="mb-3 text-2xl font-extrabold">{ok ? "E-mail verificado" : "Link inválido ou expirado"}</h1>
      <Link href="/" className="btn-primary mt-4">Ir para o início</Link>
    </div>
  );
}
