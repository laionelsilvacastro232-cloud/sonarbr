"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { and, asc, count, desc, eq, inArray, ne, or, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  albums, artistFollows, artistPosts, artists, authTokens, eventLogs, likedTracks, notifications, playHistory,
  playlistCollaborators, playlistTracks, playlists, reports, savedAlbums, savedPlaylists, searchHistory,
  sessions, supportMessages, supportTickets, tracks, userFollows, users,
} from "@/db/schema";
import {
  actionUser, audit, clientIp, createSession, destroySession, getCurrentUser, hashPassword, isStrongPassword,
  randomToken, rateLimit, sha256, verifyPassword,
} from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { appOrigin, emailConfigured, sendEmail } from "@/lib/email";
import { playlistAccess, isUuid, playlistTrackList, queryTracks } from "@/lib/queries";
import { safeUrl, saveUpload } from "@/lib/storage";

export type FormState = { error?: string; ok?: string; values?: { displayName?: string; username?: string; email?: string } } | undefined;
type R<T = object> = ({ ok: true } & T) | { ok: false; error: string };
const fail = (e: unknown): { ok: false; error: string } => ({ ok: false, error: e instanceof Error ? e.message : "Erro inesperado." });
const str = (f: FormData, k: string, max = 500) => String(f.get(k) ?? "").trim().slice(0, max);

/* ================= AUTENTICAÇÃO ================= */
export async function registerAction(_: FormState, f: FormData): Promise<FormState> {
  const settings = await getSettings();
  if (settings.registrationOpen !== "true") return { error: "Novos cadastros estão temporariamente fechados." };
  // preserva o que a pessoa digitou em caso de erro
  const keep = () => ({
    values: { displayName: str(f, "displayName", 60), username: str(f, "username", 40), email: str(f, "email", 200) },
  });
  const bad = (error: string) => ({ error, ...keep() });
  const regLimit = Math.max(10, parseInt(process.env.REGISTRATIONS_PER_HOUR ?? "60") || 60);
  if (!rateLimit(`reg:${await clientIp()}`, regLimit, 3600_000))
    return bad(`Muitos cadastros a partir desta rede (${regLimit} por hora, para evitar spam). Seus dados continuam preenchidos: aguarde alguns minutos e clique em "Criar conta" de novo.`);
  const email = str(f, "email", 200).toLowerCase();
  const username = str(f, "username", 40).replace(/\s+/g, " ").trim();
  const displayName = str(f, "displayName", 60) || username;
  const password = String(f.get("password") ?? "");
  const artistRequest = f.get("artist") === "1";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return bad("Informe um e-mail válido.");
  if (username.length < 3 || username.length > 30 || !/^[\p{L}\p{N} ._\-'()+!]+$/u.test(username))
    return bad("Escolha um nome de usuário com 3 a 30 caracteres. Pode usar letras (com acento), números, espaço, ponto, hífen, _ e apóstrofo.");
  if (!isStrongPassword(password)) return bad("A senha precisa ter 8+ caracteres, com letras e números.");
  if (f.get("terms") !== "on") return bad("Aceite os Termos de Uso e a Política de Privacidade.");
  const dup = await db
    .select({ id: users.id })
    .from(users)
    .where(or(eq(users.email, email), sql`lower(${users.username}) = lower(${username})`))
    .limit(1);
  if (dup.length) return bad("Este e-mail ou este nome de usuário já está em uso. Troque só o campo em questão e clique em Criar conta — nada do resto foi perdido.");
  const [{ n }] = await db.select({ n: count() }).from(users);
  const isFirst = n === 0 || (!!process.env.ADMIN_EMAIL && process.env.ADMIN_EMAIL.toLowerCase() === email);
  const [u] = await db
    .insert(users)
    .values({ email, username, displayName, passwordHash: hashPassword(password), role: isFirst ? "admin" : "user", artistRequest })
    .returning();
  if (isFirst) await audit(u, "admin.bootstrap", u.id);
  await sendVerification(u.id, email);
  await createSession(u.id);
  redirect(artistRequest ? "/estudio" : "/");
}

async function sendVerification(userId: string, email: string) {
  if (!emailConfigured()) return;
  const token = randomToken();
  await db.insert(authTokens).values({ userId, kind: "verify", tokenHash: sha256(token), expiresAt: new Date(Date.now() + 2 * 86400_000) });
  await sendEmail(email, "Confirme seu e-mail", `Confirme seu e-mail acessando: ${await appOrigin()}/verificar/${token}`);
}

export async function resendVerification(): Promise<R> {
  try {
    const u = await actionUser();
    if (u.emailVerifiedAt) return { ok: true };
    if (!emailConfigured()) throw new Error("O envio de e-mails ainda não foi configurado pelo administrador.");
    if (!rateLimit(`ver:${u.id}`, 3, 3600_000)) throw new Error("Aguarde antes de reenviar.");
    await sendVerification(u.id, u.email);
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function loginAction(_: FormState, f: FormData): Promise<FormState> {
  const email = str(f, "email", 200).toLowerCase();
  const password = String(f.get("password") ?? "");
  const ip = await clientIp();
  if (!rateLimit(`login:${ip}`, 20, 15 * 60_000) || !rateLimit(`login:${email}`, 8, 15 * 60_000))
    return { error: "Muitas tentativas de login. Aguarde alguns minutos." };
  const [u] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  const ok = u ? verifyPassword(password, u.passwordHash) : (verifyPassword(password, "scrypt$00$00"), false);
  if (!u || !ok) return { error: "E-mail ou senha incorretos." };
  if (u.status !== "active") return { error: `Conta suspensa${u.suspendedReason ? `: ${u.suspendedReason}` : "."}` };
  await createSession(u.id);
  const next = str(f, "next", 200);
  redirect(next.startsWith("/") && !next.startsWith("//") ? next : "/");
}

export async function logoutAction() {
  await destroySession();
  redirect("/");
}

export async function requestResetAction(_: FormState, f: FormData): Promise<FormState> {
  const email = str(f, "email", 200).toLowerCase();
  if (!rateLimit(`reset:${await clientIp()}`, 5, 3600_000)) return { error: "Muitas solicitações. Tente mais tarde." };
  const [u] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (u && u.status === "active" && emailConfigured()) {
    const token = randomToken();
    await db.insert(authTokens).values({ userId: u.id, kind: "reset", tokenHash: sha256(token), expiresAt: new Date(Date.now() + 3600_000) });
    await sendEmail(email, "Redefinição de senha", `Redefina sua senha em até 1 hora: ${await appOrigin()}/redefinir/${token}`);
  }
  return {
    ok: emailConfigured()
      ? "Se o e-mail existir, enviamos um link de redefinição válido por 1 hora."
      : "O envio automático de e-mails não está configurado nesta instalação. Peça a um administrador para gerar seu link de redefinição (Admin → Usuários).",
  };
}

export async function resetPasswordAction(_: FormState, f: FormData): Promise<FormState> {
  const token = str(f, "token", 100);
  const password = String(f.get("password") ?? "");
  if (!isStrongPassword(password)) return { error: "A senha precisa ter 8+ caracteres, com letras e números." };
  const [t] = await db.select().from(authTokens).where(and(eq(authTokens.tokenHash, sha256(token)), eq(authTokens.kind, "reset"))).limit(1);
  if (!t || t.usedAt || t.expiresAt < new Date()) return { error: "Link inválido ou expirado. Solicite um novo." };
  await db.update(users).set({ passwordHash: hashPassword(password) }).where(eq(users.id, t.userId));
  await db.update(authTokens).set({ usedAt: new Date() }).where(eq(authTokens.id, t.id));
  await db.delete(sessions).where(eq(sessions.userId, t.userId));
  redirect("/entrar?reset=1");
}

export async function changePasswordAction(_: FormState, f: FormData): Promise<FormState> {
  const u = await getCurrentUser();
  if (!u) return { error: "Sessão expirada." };
  if (!rateLimit(`chpw:${u.id}`, 6, 3600_000)) return { error: "Muitas tentativas." };
  if (!verifyPassword(String(f.get("current") ?? ""), u.passwordHash)) return { error: "Senha atual incorreta." };
  const np = String(f.get("password") ?? "");
  if (!isStrongPassword(np)) return { error: "A nova senha precisa ter 8+ caracteres, com letras e números." };
  await db.update(users).set({ passwordHash: hashPassword(np) }).where(eq(users.id, u.id));
  await createSessionKeepCurrent(u.id);
  return { ok: "Senha alterada. Outras sessões foram encerradas." };
}

async function createSessionKeepCurrent(userId: string) {
  await db.delete(sessions).where(eq(sessions.userId, userId));
  await createSession(userId);
}

export async function deleteAccountAction(_: FormState, f: FormData): Promise<FormState> {
  const u = await getCurrentUser();
  if (!u) return { error: "Sessão expirada." };
  if (!verifyPassword(String(f.get("password") ?? ""), u.passwordHash)) return { error: "Senha incorreta." };
  if (u.role === "admin") {
    const [{ n }] = await db.select({ n: count() }).from(users).where(and(eq(users.role, "admin"), ne(users.id, u.id)));
    if (n === 0) return { error: "Você é o único administrador. Promova outra conta antes de excluir esta." };
  }
  await db.delete(playlists).where(and(eq(playlists.ownerId, u.id), eq(playlists.collaborative, false)));
  await db.delete(users).where(eq(users.id, u.id));
  await destroySession();
  redirect("/?conta=excluida");
}

/* ================= PERFIL / PREFERÊNCIAS ================= */
export async function updateProfileAction(_: FormState, f: FormData): Promise<FormState> {
  const u = await getCurrentUser();
  if (!u) return { error: "Sessão expirada." };
  try {
    const displayName = str(f, "displayName", 60);
    if (displayName.length < 2) return { error: "Informe um nome de exibição." };
    const patch: Partial<typeof users.$inferInsert> = { displayName, bio: str(f, "bio", 300) };
    const username = str(f, "username", 40).replace(/\s+/g, " ").trim();
    if (username && username !== u.username) {
      if (username.length < 3 || !/^[\p{L}\p{N} ._\-'()+!]+$/u.test(username)) return { error: "Nome de usuário inválido (3 a 30 caracteres)." };
      const dup = await db.select({ id: users.id }).from(users).where(sql`lower(${users.username}) = lower(${username})`).limit(1);
      if (dup.length) return { error: "Nome de usuário já em uso." };
      patch.username = username;
    }
    const file = f.get("avatar");
    if (file instanceof File && file.size > 0) patch.avatarUrl = await saveUpload(file, "image");
    if (f.get("removeAvatar") === "1") patch.avatarUrl = null;
    await db.update(users).set(patch).where(eq(users.id, u.id));
    revalidatePath("/", "layout");
    return { ok: "Perfil atualizado." };
  } catch (e) {
    return { error: fail(e).error };
  }
}

export async function updatePrivacyAction(_: FormState, f: FormData): Promise<FormState> {
  const u = await getCurrentUser();
  if (!u) return { error: "Sessão expirada." };
  await db
    .update(users)
    .set({
      profilePublic: f.get("profilePublic") === "on",
      historyPrivate: f.get("historyPrivate") === "on",
      showActivity: f.get("showActivity") === "on",
      recordHistory: f.get("recordHistory") === "on",
    })
    .where(eq(users.id, u.id));
  revalidatePath("/", "layout");
  return { ok: "Preferências salvas." };
}

/* ================= BIBLIOTECA ================= */
export async function toggleLike(trackId: string): Promise<R<{ liked: boolean }>> {
  try {
    const u = await actionUser();
    if (!isUuid(trackId)) throw new Error("Faixa inválida.");
    const del = await db.delete(likedTracks).where(and(eq(likedTracks.userId, u.id), eq(likedTracks.trackId, trackId))).returning();
    if (!del.length) await db.insert(likedTracks).values({ userId: u.id, trackId }).onConflictDoNothing();
    revalidatePath("/biblioteca");
    return { ok: true, liked: !del.length };
  } catch (e) {
    return fail(e);
  }
}

export async function toggleFollowArtist(artistId: string): Promise<R<{ following: boolean }>> {
  try {
    const u = await actionUser();
    const del = await db.delete(artistFollows).where(and(eq(artistFollows.userId, u.id), eq(artistFollows.artistId, artistId))).returning();
    if (!del.length) await db.insert(artistFollows).values({ userId: u.id, artistId }).onConflictDoNothing();
    revalidatePath("/biblioteca");
    return { ok: true, following: !del.length };
  } catch (e) {
    return fail(e);
  }
}

export async function toggleSaveAlbum(albumId: string): Promise<R<{ saved: boolean }>> {
  try {
    const u = await actionUser();
    const del = await db.delete(savedAlbums).where(and(eq(savedAlbums.userId, u.id), eq(savedAlbums.albumId, albumId))).returning();
    if (!del.length) await db.insert(savedAlbums).values({ userId: u.id, albumId }).onConflictDoNothing();
    revalidatePath("/biblioteca");
    return { ok: true, saved: !del.length };
  } catch (e) {
    return fail(e);
  }
}

export async function toggleSavePlaylist(playlistId: string): Promise<R<{ saved: boolean }>> {
  try {
    const u = await actionUser();
    const acc = await playlistAccess(playlistId, u.id);
    if (!acc || !acc.canView) throw new Error("Playlist indisponível.");
    const del = await db.delete(savedPlaylists).where(and(eq(savedPlaylists.userId, u.id), eq(savedPlaylists.playlistId, playlistId))).returning();
    if (!del.length) {
      await db.insert(savedPlaylists).values({ userId: u.id, playlistId }).onConflictDoNothing();
      if (acc.playlist.ownerId && acc.playlist.ownerId !== u.id)
        await notify(acc.playlist.ownerId, "playlist_saved", `${u.displayName} salvou sua playlist "${acc.playlist.name}".`, `/playlist/${playlistId}`);
    }
    revalidatePath("/biblioteca");
    return { ok: true, saved: !del.length };
  } catch (e) {
    return fail(e);
  }
}

export async function toggleFollowUser(targetId: string): Promise<R<{ following: boolean }>> {
  try {
    const u = await actionUser();
    if (u.id === targetId) throw new Error("Você não pode seguir a si mesmo.");
    const [t] = await db.select().from(users).where(and(eq(users.id, targetId), eq(users.status, "active"))).limit(1);
    if (!t || !t.profilePublic) throw new Error("Perfil indisponível.");
    const del = await db.delete(userFollows).where(and(eq(userFollows.followerId, u.id), eq(userFollows.followingId, targetId))).returning();
    if (!del.length) {
      await db.insert(userFollows).values({ followerId: u.id, followingId: targetId }).onConflictDoNothing();
      await notify(targetId, "follow", `${u.displayName} começou a seguir você.`, `/perfil/${u.username}`);
    }
    revalidatePath(`/perfil/${t.username}`);
    return { ok: true, following: !del.length };
  } catch (e) {
    return fail(e);
  }
}

async function notify(userId: string, kind: string, message: string, href?: string) {
  await db.insert(notifications).values({ userId, kind, message, href });
}

/* ================= PLAYLISTS ================= */
export async function createPlaylist(name: string, trackId?: string): Promise<R<{ id: string }>> {
  try {
    const u = await actionUser();
    const n = name.trim().slice(0, 100) || "Nova playlist";
    if (!rateLimit(`pl:${u.id}`, 60, 3600_000)) throw new Error("Limite de criação atingido.");
    const [pl] = await db.insert(playlists).values({ ownerId: u.id, name: n }).returning();
    if (trackId && isUuid(trackId)) await db.insert(playlistTracks).values({ playlistId: pl.id, trackId, position: 0, addedBy: u.id });
    revalidatePath("/biblioteca");
    return { ok: true, id: pl.id };
  } catch (e) {
    return fail(e);
  }
}

export async function updatePlaylistAction(_: FormState, f: FormData): Promise<FormState> {
  try {
    const u = await actionUser();
    const id = str(f, "id", 50);
    const acc = await playlistAccess(id, u.id);
    if (!acc?.isOwner) return { error: "Apenas o dono pode editar os detalhes." };
    const name = str(f, "name", 100);
    if (!name) return { error: "Informe um nome." };
    const patch: Partial<typeof playlists.$inferInsert> = {
      name,
      description: str(f, "description", 300),
      isPublic: f.get("isPublic") === "on",
      collaborative: f.get("collaborative") === "on",
      updatedAt: new Date(),
    };
    const file = f.get("cover");
    if (file instanceof File && file.size > 0) patch.coverUrl = await saveUpload(file, "image");
    else if (str(f, "coverUrl", 500)) patch.coverUrl = safeUrl(str(f, "coverUrl", 500));
    if (f.get("removeCover") === "1") patch.coverUrl = null;
    await db.update(playlists).set(patch).where(eq(playlists.id, id));
    revalidatePath(`/playlist/${id}`);
    revalidatePath("/biblioteca");
    return { ok: "Playlist atualizada." };
  } catch (e) {
    return { error: fail(e).error };
  }
}

export async function deletePlaylist(id: string): Promise<R> {
  try {
    const u = await actionUser();
    const acc = await playlistAccess(id, u.id);
    if (!acc?.isOwner) throw new Error("Sem permissão.");
    await db.delete(playlists).where(eq(playlists.id, id));
    revalidatePath("/biblioteca");
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function duplicatePlaylist(id: string): Promise<R<{ id: string }>> {
  try {
    const u = await actionUser();
    const acc = await playlistAccess(id, u.id);
    if (!acc?.canView) throw new Error("Playlist indisponível.");
    const [copy] = await db.insert(playlists).values({ ownerId: u.id, name: `${acc.playlist.name} (cópia)`, description: acc.playlist.description, coverUrl: acc.playlist.coverUrl }).returning();
    const items = await db.select().from(playlistTracks).where(eq(playlistTracks.playlistId, id)).orderBy(asc(playlistTracks.position));
    if (items.length) await db.insert(playlistTracks).values(items.map((i, p) => ({ playlistId: copy.id, trackId: i.trackId, position: p, addedBy: u.id })));
    revalidatePath("/biblioteca");
    return { ok: true, id: copy.id };
  } catch (e) {
    return fail(e);
  }
}

export async function addToPlaylist(playlistId: string, trackId: string): Promise<R<{ duplicate?: boolean }>> {
  try {
    const u = await actionUser();
    const acc = await playlistAccess(playlistId, u.id);
    if (!acc?.canEdit) throw new Error("Você não pode editar esta playlist.");
    const dup = await db.select({ id: playlistTracks.id }).from(playlistTracks).where(and(eq(playlistTracks.playlistId, playlistId), eq(playlistTracks.trackId, trackId))).limit(1);
    if (dup.length) return { ok: true, duplicate: true };
    const [{ m }] = await db.select({ m: sql<number>`coalesce(max(${playlistTracks.position}), -1)` }).from(playlistTracks).where(eq(playlistTracks.playlistId, playlistId));
    await db.insert(playlistTracks).values({ playlistId, trackId, position: Number(m) + 1, addedBy: u.id });
    await db.update(playlists).set({ updatedAt: new Date() }).where(eq(playlists.id, playlistId));
    revalidatePath(`/playlist/${playlistId}`);
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function removeFromPlaylist(playlistId: string, itemId: string): Promise<R> {
  try {
    const u = await actionUser();
    const acc = await playlistAccess(playlistId, u.id);
    if (!acc?.canEdit) throw new Error("Sem permissão.");
    await db.delete(playlistTracks).where(and(eq(playlistTracks.id, itemId), eq(playlistTracks.playlistId, playlistId)));
    revalidatePath(`/playlist/${playlistId}`);
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function movePlaylistItem(playlistId: string, itemId: string, dir: "up" | "down"): Promise<R> {
  try {
    const u = await actionUser();
    const acc = await playlistAccess(playlistId, u.id);
    if (!acc?.canEdit) throw new Error("Sem permissão.");
    const items = await db.select().from(playlistTracks).where(eq(playlistTracks.playlistId, playlistId)).orderBy(asc(playlistTracks.position), asc(playlistTracks.addedAt));
    const i = items.findIndex((x) => x.id === itemId);
    const j = dir === "up" ? i - 1 : i + 1;
    if (i < 0 || j < 0 || j >= items.length) return { ok: true };
    [items[i], items[j]] = [items[j], items[i]];
    await db.transaction(async (tx) => {
      for (let p = 0; p < items.length; p++) await tx.update(playlistTracks).set({ position: p }).where(eq(playlistTracks.id, items[p].id));
    });
    revalidatePath(`/playlist/${playlistId}`);
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function addCollaborator(playlistId: string, username: string): Promise<R> {
  try {
    const u = await actionUser();
    const acc = await playlistAccess(playlistId, u.id);
    if (!acc?.isOwner) throw new Error("Apenas o dono pode convidar.");
    if (!acc.playlist.collaborative) throw new Error("Ative 'Playlist colaborativa' nas configurações da playlist.");
    const [t] = await db.select().from(users).where(and(sql`lower(${users.username}) = lower(${username.trim()})`, eq(users.status, "active"))).limit(1);
    if (!t) throw new Error("Usuário não encontrado.");
    if (t.id === u.id) throw new Error("Você já é o dono.");
    await db.insert(playlistCollaborators).values({ playlistId, userId: t.id }).onConflictDoNothing();
    await notify(t.id, "collab", `${u.displayName} convidou você para colaborar em "${acc.playlist.name}".`, `/playlist/${playlistId}`);
    revalidatePath(`/playlist/${playlistId}`);
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function removeCollaborator(playlistId: string, userId: string): Promise<R> {
  try {
    const u = await actionUser();
    const acc = await playlistAccess(playlistId, u.id);
    if (!acc?.isOwner && u.id !== userId) throw new Error("Sem permissão.");
    await db.delete(playlistCollaborators).where(and(eq(playlistCollaborators.playlistId, playlistId), eq(playlistCollaborators.userId, userId)));
    revalidatePath(`/playlist/${playlistId}`);
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function myPlaylistsForPicker(trackId?: string) {
  const u = await getCurrentUser();
  if (!u) return [];
  const rows = await db
    .select({
      id: playlists.id,
      name: playlists.name,
      has: trackId
        ? sql<boolean>`exists(select 1 from ${playlistTracks} pt where pt.playlist_id = ${playlists.id} and pt.track_id = ${trackId})`
        : sql<boolean>`false`,
    })
    .from(playlists)
    .where(or(eq(playlists.ownerId, u.id), sql`(${playlists.collaborative} and exists(select 1 from ${playlistCollaborators} pc where pc.playlist_id = ${playlists.id} and pc.user_id = ${u.id}))`))
    .orderBy(desc(playlists.updatedAt))
    .limit(100);
  return rows;
}

/* ================= REPRODUÇÃO / HISTÓRICO ================= */
export async function recordPlay(trackId: string, listenedSec: number): Promise<R> {
  try {
    if (!isUuid(trackId)) throw new Error("Faixa inválida.");
    const u = await getCurrentUser();
    const key = u?.id ?? (await clientIp());
    if (!rateLimit(`play:${key}`, 240, 3600_000)) throw new Error("Limite atingido.");
    const sec = Math.max(0, Math.min(Math.floor(listenedSec), 36000));
    if (sec < 10) return { ok: true }; // só conta reprodução real (limiar definido pelo player)
    await db.update(tracks).set({ playCount: sql`${tracks.playCount} + 1` }).where(eq(tracks.id, trackId));
    if (u && u.recordHistory) await db.insert(playHistory).values({ userId: u.id, trackId, listenedSec: sec });
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function reportDuration(trackId: string, sec: number) {
  if (!isUuid(trackId) || !(sec > 5 && sec < 7200)) return;
  if (!rateLimit(`dur:${await clientIp()}`, 120, 3600_000)) return;
  await db.update(tracks).set({ durationSec: Math.round(sec) }).where(and(eq(tracks.id, trackId), eq(tracks.durationSec, 0)));
}

export async function logPlayError(trackId: string | null, message: string) {
  if (!rateLimit(`perr:${await clientIp()}`, 60, 3600_000)) return;
  await db.insert(eventLogs).values({ level: "error", source: "player", message: message.slice(0, 300), trackId: trackId && isUuid(trackId) ? trackId : null });
}

export async function removeHistoryItem(id: string): Promise<R> {
  try {
    const u = await actionUser();
    await db.delete(playHistory).where(and(eq(playHistory.id, id), eq(playHistory.userId, u.id)));
    revalidatePath("/historico");
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function clearHistory(): Promise<R> {
  try {
    const u = await actionUser();
    await db.delete(playHistory).where(eq(playHistory.userId, u.id));
    revalidatePath("/historico");
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

/* ================= BUSCA ================= */
export async function saveSearch(q: string) {
  const u = await getCurrentUser();
  const query = q.trim().slice(0, 100);
  if (!u || query.length < 2) return;
  await db.delete(searchHistory).where(and(eq(searchHistory.userId, u.id), eq(searchHistory.query, query)));
  await db.insert(searchHistory).values({ userId: u.id, query });
}

export async function getSearchHistory() {
  const u = await getCurrentUser();
  if (!u) return [];
  const rows = await db.select({ query: searchHistory.query }).from(searchHistory).where(eq(searchHistory.userId, u.id)).orderBy(desc(searchHistory.createdAt)).limit(8);
  return rows.map((r) => r.query);
}

export async function clearSearchHistory(): Promise<R> {
  try {
    const u = await actionUser();
    await db.delete(searchHistory).where(eq(searchHistory.userId, u.id));
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

/* ================= DENÚNCIAS / NOTIFICAÇÕES ================= */
export async function submitReport(targetType: string, targetId: string, reason: string, details: string): Promise<R> {
  try {
    const u = await actionUser();
    if (!["user", "playlist", "track", "artist"].includes(targetType) || !isUuid(targetId)) throw new Error("Alvo inválido.");
    if (!reason.trim()) throw new Error("Selecione um motivo.");
    if (!rateLimit(`rep:${u.id}`, 15, 3600_000)) throw new Error("Limite de denúncias atingido.");
    await db.insert(reports).values({ reporterId: u.id, targetType, targetId, reason: reason.slice(0, 80), details: details.slice(0, 1000) });
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function markNotificationsRead(): Promise<R> {
  try {
    const u = await actionUser();
    await db.update(notifications).set({ readAt: new Date() }).where(and(eq(notifications.userId, u.id), sql`${notifications.readAt} is null`));
    revalidatePath("/notificacoes");
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

/* ================= CENTRAL DE AJUDA (SUPORTE) ================= */
export async function createSupportTicket(_: FormState, f: FormData): Promise<FormState> {
  try {
    const u = await actionUser();
    if (!rateLimit(`sup:${u.id}`, 10, 3600_000)) return { error: "Muitas conversas abertas agora. Aguarde alguns minutos." };
    const subject = str(f, "subject", 120);
    const body = str(f, "body", 2000);
    if (subject.length < 3) return { error: "Descreva o assunto em pelo menos 3 caracteres." };
    if (body.length < 10) return { error: "Escreva sua mensagem com pelo menos 10 caracteres para que possamos ajudar." };
    const [t] = await db.insert(supportTickets).values({ userId: u.id, subject, status: "answered" }).returning();
    await db.insert(supportMessages).values({ ticketId: t.id, userId: u.id, fromSupport: false, body });
    revalidatePath("/ajuda");
    return { ok: "Mensagem enviada ao suporte. A resposta aparece aqui mesmo, nesta página." };
  } catch (e) {
    console.error("[createSupportTicket]", e);
    return { error: fail(e).error };
  }
}

export async function replySupportTicket(ticketId: string, body: string): Promise<FormState> {
  try {
    const u = await actionUser();
    if (!rateLimit(`sup:${u.id}`, 20, 3600_000)) return { error: "Muitas mensagens enviadas. Aguarde alguns minutos." };
    const text = body.trim().slice(0, 2000);
    if (text.length < 2) return { error: "Escreva uma mensagem." };
    const [t] = await db.select().from(supportTickets).where(eq(supportTickets.id, ticketId)).limit(1);
    if (!t || t.userId !== u.id) throw new Error("Conversa não encontrada.");
    if (t.status === "closed") return { error: "Esta conversa foi encerrada. Abra uma nova em Ajuda e suporte." };
    await db.insert(supportMessages).values({ ticketId, userId: u.id, fromSupport: false, body: text });
    await db.update(supportTickets).set({ status: "answered", updatedAt: new Date() }).where(eq(supportTickets.id, ticketId));
    revalidatePath("/ajuda");
    return { ok: "Mensagem enviada." };
  } catch (e) {
    return { error: fail(e).error };
  }
}

export async function mySupportTickets() {
  const u = await getCurrentUser();
  if (!u) return [];
  const rows = await db.select().from(supportTickets).where(eq(supportTickets.userId, u.id)).orderBy(desc(supportTickets.updatedAt)).limit(50);
  return rows;
}

export async function supportConversation(ticketId: string) {
  const u = await getCurrentUser();
  if (!u) return null;
  const [t] = await db.select().from(supportTickets).where(eq(supportTickets.id, ticketId)).limit(1);
  if (!t || t.userId !== u.id) return null;
  const msgs = await db.select().from(supportMessages).where(eq(supportMessages.ticketId, ticketId)).orderBy(supportMessages.createdAt).limit(200);
  return { ticket: t, messages: msgs };
}

/* ================= ESTÚDIO DO ARTISTA ================= */
export async function studioCreateTrack(_: FormState, f: FormData): Promise<FormState> {
  try {
    const u = await actionUser();
    if (u.role !== "artist" && u.role !== "admin") return { error: "Disponível apenas para contas de artista aprovadas." };
    if (!u.artistId) return { error: "Sua conta de artista ainda não está vinculada a um perfil." };
    if (f.get("rights") !== "on") return { error: "Confirme que você possui os direitos de distribuição desta obra." };
    const title = str(f, "title", 150);
    const file = f.get("audio");
    if (!title) return { error: "Informe o título." };
    const linkOnly = str(f, "externalUrl", 800);
    if (!(file instanceof File) || !file.size) {
      if (!linkOnly) return { error: "Envie o arquivo de áudio ou informe o link da faixa na fonte original." };
      if (f.get("rights") !== "on") return { error: "Confirme que você possui os direitos de distribuição desta obra nesta plataforma." };
      await db.insert(tracks).values({
        title, artistId: u.artistId, genre: str(f, "genre", 40), featuring: str(f, "featuring", 150),
        credits: str(f, "credits", 500), externalUrl: linkOnly, sourceType: "external", availability: "external_only",
        status: "published", licenseNote: "Link enviado pelo próprio artista; a reprodução ocorre na fonte original.",
        releaseDate: new Date().toISOString().slice(0, 10),
      });
      revalidatePath("/estudio");
      return { ok: "Link publicado no seu perfil. Ele abre na fonte original." };
    }
    if (!rateLimit(`studio:${u.id}`, 20, 3600_000)) return { error: "Limite de envios por hora atingido." };
    const audioUrl = await saveUpload(file, "audio");
    const cover = f.get("cover");
    const coverUrl = cover instanceof File && cover.size > 0 ? await saveUpload(cover, "image") : null;
    await db.insert(tracks).values({
      title,
      artistId: u.artistId,
      genre: str(f, "genre", 40),
      featuring: str(f, "featuring", 150),
      credits: str(f, "credits", 500),
      coverUrl,
      audioUrl,
      externalUrl: safeUrl(str(f, "externalUrl", 800)),
      sourceType: "upload",
      status: "pending",
      licenseNote: `Enviado pelo artista (${u.email}) com declaração de direitos.`,
      releaseDate: new Date().toISOString().slice(0, 10),
    });
    revalidatePath("/estudio");
    return { ok: "Faixa enviada. Ela será publicada após revisão da equipe." };
  } catch (e) {
    return { error: fail(e).error };
  }
}

export async function studioUpdateArtist(_: FormState, f: FormData): Promise<FormState> {
  try {
    const u = await actionUser();
    if (u.role !== "artist" || !u.artistId) return { error: "Sem permissão." };
    const name = str(f, "name", 120);
    if (!name) return { error: "Informe o nome artístico." };
    const patch: Partial<typeof artists.$inferInsert> = { name, bio: str(f, "bio", 2000) };
    const file = f.get("image");
    if (file instanceof File && file.size > 0) patch.imageUrl = await saveUpload(file, "image");
    const links = str(f, "links", 1200).split("\n").map((l) => l.trim()).filter(Boolean).map((l) => { const [label, ...u2] = l.split("|"); return { label: label.trim(), url: u2.join("|").trim() }; }).filter((l) => /^https?:\/\//.test(l.url));
    patch.links = links;
    await db.update(artists).set(patch).where(eq(artists.id, u.artistId));
    await db.update(users).set({ displayName: name.slice(0, 60) }).where(and(eq(users.id, u.id), eq(users.role, "artist"))).catch(() => undefined);
    revalidatePath("/estudio");
    return { ok: "Perfil de artista atualizado. As mudanças já aparecem para os ouvintes." };
  } catch (e) {
    return { error: fail(e).error };
  }
}

async function ownedArtistId(userId: string) {
  const [u] = await db.select({ artistId: users.artistId, role: users.role }).from(users).where(eq(users.id, userId)).limit(1);
  return u?.artistId && (u.role === "artist" || u.role === "admin") ? u.artistId : null;
}

export async function studioUpdateTrack(_: FormState, f: FormData): Promise<FormState> {
  try {
    const u = await actionUser();
    const artistId = await ownedArtistId(u.id);
    if (!artistId) return { error: "Sem permissão." };
    const id = str(f, "id", 50);
    const [t] = await db.select().from(tracks).where(eq(tracks.id, id)).limit(1);
    if (!t || t.artistId !== artistId) return { error: "Esta faixa não pertence ao seu perfil de artista." };
    const title = str(f, "title", 150);
    if (!title) return { error: "Informe o título." };
    const externalUrl = safeUrl(str(f, "externalUrl", 800));
    const audio = f.get("audio");
    const uploaded = audio instanceof File && audio.size > 0 ? await saveUpload(audio, "audio") : null;
    const audioUrl = uploaded ?? (t.audioUrl && !t.audioUrl.startsWith("/media/") ? safeUrl(str(f, "audioUrl", 800)) : t.audioUrl);
    if (!audioUrl && !externalUrl) return { error: "Informe um arquivo de áudio, uma URL de áudio licenciada ou um link da fonte original." };
    await db.update(tracks).set({
      title,
      genre: str(f, "genre", 40),
      featuring: str(f, "featuring", 150),
      credits: str(f, "credits", 1200),
      externalUrl,
      audioUrl: audioUrl ?? null,
      availability: audioUrl ? (str(f, "availability") === "external_only" ? "external_only" : "available") : "external_only",
      sourceType: uploaded ? "upload" : t.sourceType,
      licenseNote: str(f, "licenseNote", 500) || t.licenseNote,
      releaseDate: str(f, "releaseDate", 10) || t.releaseDate,
    }).where(eq(tracks.id, id));
    revalidatePath("/estudio");
    return { ok: "Faixa atualizada." };
  } catch (e) {
    return { error: fail(e).error };
  }
}

export async function studioDeleteTrack(id: string): Promise<R> {
  try {
    const u = await actionUser();
    const artistId = await ownedArtistId(u.id);
    if (!artistId) throw new Error("Sem permissão.");
    const [t] = await db.select().from(tracks).where(eq(tracks.id, id)).limit(1);
    if (!t || t.artistId !== artistId) throw new Error("Esta faixa não pertence ao seu perfil.");
    await db.delete(tracks).where(eq(tracks.id, id));
    revalidatePath("/estudio");
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function studioSetTrackStatus(id: string, status: "published" | "draft"): Promise<R> {
  try {
    const u = await actionUser();
    const artistId = await ownedArtistId(u.id);
    if (!artistId) throw new Error("Sem permissão.");
    const [t] = await db.select().from(tracks).where(eq(tracks.id, id)).limit(1);
    if (!t || t.artistId !== artistId) throw new Error("Esta faixa não pertence ao seu perfil.");
    await db.update(tracks).set({ status }).where(eq(tracks.id, id));
    revalidatePath("/estudio");
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

/* ---------- novidades do artista ---------- */
export async function studioCreatePost(_: FormState, f: FormData): Promise<FormState> {
  try {
    const u = await actionUser();
    const artistId = await ownedArtistId(u.id);
    if (!artistId) return { error: "Disponível apenas para contas de artista aprovadas." };
    const title = str(f, "title", 120);
    if (!title) return { error: "Informe o título da publicação." };
    const cover = f.get("cover");
    const coverUrl = cover instanceof File && cover.size > 0 ? await saveUpload(cover, "image") : safeUrl(str(f, "coverUrl", 500));
    await db.insert(artistPosts).values({ artistId, userId: u.id, title, body: str(f, "body", 2000), coverUrl, status: f.get("status") === "draft" ? "draft" : "published" });
    revalidatePath("/estudio");
    return { ok: "Publicação criada." };
  } catch (e) {
    console.error("[studioCreatePost]", e);
    return { error: fail(e).error };
  }
}

export async function studioUpdatePost(_: FormState, f: FormData): Promise<FormState> {
  try {
    const u = await actionUser();
    const artistId = await ownedArtistId(u.id);
    if (!artistId) return { error: "Sem permissão." };
    const id = str(f, "id", 50);
    const [p] = await db.select().from(artistPosts).where(eq(artistPosts.id, id)).limit(1);
    if (!p || p.artistId !== artistId) return { error: "Esta publicação não pertence ao seu perfil." };
    const title = str(f, "title", 120);
    if (!title) return { error: "Informe o título." };
    const cover = f.get("cover");
    const coverUrl = cover instanceof File && cover.size > 0 ? await saveUpload(cover, "image") : p.coverUrl;
    await db.update(artistPosts).set({ title, body: str(f, "body", 2000), coverUrl, status: f.get("status") === "draft" ? "draft" : "published", updatedAt: new Date() }).where(eq(artistPosts.id, id));
    revalidatePath("/estudio");
    return { ok: "Publicação atualizada." };
  } catch (e) {
    return { error: fail(e).error };
  }
}

export async function studioSetPostStatus(id: string, status: "published" | "draft"): Promise<R> {
  try {
    const u = await actionUser();
    const artistId = await ownedArtistId(u.id);
    if (!artistId) throw new Error("Sem permissão.");
    const [p] = await db.select().from(artistPosts).where(eq(artistPosts.id, id)).limit(1);
    if (!p || p.artistId !== artistId) throw new Error("Esta publicação não pertence ao seu perfil.");
    await db.update(artistPosts).set({ status, updatedAt: new Date() }).where(eq(artistPosts.id, id));
    revalidatePath("/estudio");
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function studioDeletePost(id: string): Promise<R> {
  try {
    const u = await actionUser();
    const artistId = await ownedArtistId(u.id);
    if (!artistId) throw new Error("Sem permissão.");
    const [p] = await db.select().from(artistPosts).where(eq(artistPosts.id, id)).limit(1);
    if (!p || p.artistId !== artistId) throw new Error("Esta publicação não pertence ao seu perfil.");
    await db.delete(artistPosts).where(eq(artistPosts.id, id));
    revalidatePath("/estudio");
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function exportMyData() {
  const u = await actionUser();
  const [likes, pls, hist] = await Promise.all([
    db.select({ trackId: likedTracks.trackId, at: likedTracks.createdAt }).from(likedTracks).where(eq(likedTracks.userId, u.id)),
    db.select().from(playlists).where(eq(playlists.ownerId, u.id)),
    db.select().from(playHistory).where(eq(playHistory.userId, u.id)).limit(5000),
  ]);
  const { passwordHash: _p, ...profile } = u;
  void _p;
  return JSON.stringify({ profile, likes, playlists: pls, history: hist }, null, 2);
}

/** Carrega faixas publicadas de um álbum, playlist (respeitando permissão) ou artista, para reprodução. */
export async function loadTracks(kind: "album" | "playlist" | "artist", id: string) {
  const u = await getCurrentUser();
  if (!isUuid(id)) return [];
  if (kind === "playlist") {
    const acc = await playlistAccess(id, u?.id);
    if (!acc?.canView) return [];
    return playlistTrackList(id, u?.id);
  }
  if (kind === "album") return queryTracks({ where: eq(tracks.albumId, id), order: [asc(tracks.trackNumber), asc(tracks.title)], userId: u?.id, limit: 300 });
  return queryTracks({ where: eq(tracks.artistId, id), userId: u?.id, limit: 50 });
}
