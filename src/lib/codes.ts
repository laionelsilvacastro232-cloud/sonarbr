import "server-only";
import { randomInt } from "node:crypto";
import { and, desc, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { authTokens } from "@/db/schema";
import { rateLimit, sha256 } from "@/lib/auth";

export type CodeKind = "verify" | "reset";

const CODE_TTL_MS = 15 * 60_000;
const MAX_ATTEMPTS = 5;

const hashCode = (userId: string, kind: CodeKind, code: string) => sha256(`${kind}:${userId}:${code}`);

/** Gera um novo código de 6 dígitos, invalidando os anteriores do mesmo tipo. */
export async function issueCode(userId: string, kind: CodeKind) {
  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  await db.delete(authTokens).where(and(eq(authTokens.userId, userId), eq(authTokens.kind, kind), isNull(authTokens.usedAt)));
  await db.insert(authTokens).values({
    userId,
    kind,
    tokenHash: hashCode(userId, kind, code),
    expiresAt: new Date(Date.now() + CODE_TTL_MS),
  });
  return code;
}

/** Confere e consome o código. Retorna mensagem de erro ou null se válido. */
export async function consumeCode(userId: string, kind: CodeKind, rawCode: string): Promise<string | null> {
  const code = rawCode.replace(/\D/g, "");
  if (code.length !== 6) return "Digite o código de 6 dígitos.";
  if (!rateLimit(`code:${kind}:${userId}`, MAX_ATTEMPTS, CODE_TTL_MS))
    return "Muitas tentativas. Solicite um novo código e tente novamente em alguns minutos.";
  const [t] = await db
    .select()
    .from(authTokens)
    .where(and(eq(authTokens.userId, userId), eq(authTokens.kind, kind), isNull(authTokens.usedAt)))
    .orderBy(desc(authTokens.createdAt))
    .limit(1);
  if (!t || t.expiresAt < new Date()) return "Código expirado. Solicite um novo.";
  if (t.tokenHash !== hashCode(userId, kind, code)) return "Código incorreto. Confira o e-mail e tente de novo.";
  await db.update(authTokens).set({ usedAt: new Date() }).where(eq(authTokens.id, t.id));
  return null;
}
