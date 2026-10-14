"use server";

import { revalidatePath } from "next/cache";
import { and, asc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  albums, artists, authTokens, eventLogs, homeSections, notifications, playlistTracks, playlists, reports, sessions, siteSettings,
  supportMessages, supportTickets, tracks, users,
} from "@/db/schema";
import { actionAdmin, audit, randomToken, sha256 } from "@/lib/auth";
import { SETTING_DEFAULTS } from "@/lib/settings";
import { importItunes } from "@/lib/bootstrap";
import { safeUrl, saveUpload } from "@/lib/storage";
import { appOrigin } from "@/lib/email";
import { issueCode } from "@/lib/codes";

export type AdminResult = { ok?: string; error?: string; link?: string } | undefined;
const str = (f: FormData, k: string, max = 2000) => String(f.get(k) ?? "").trim().slice(0, max);
const wrap = async (fn: () => Promise<AdminResult>): Promise<AdminResult> => {
  try {
    return await fn();
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Erro inesperado." };
  }
};
const refresh = () => revalidatePath("/", "layout");

async function maybeUpload(f: FormData, field: string, kind: "audio" | "image") {
  const file = f.get(field);
  return file instanceof File && file.size > 0 ? saveUpload(file, kind) : null;
}

/* ---------- configurações ---------- */
export async function saveSettings(_: AdminResult, f: FormData): Promise<AdminResult> {
  return wrap(async () => {
    const admin = await actionAdmin();
    const values: Record<string, string> = {};
    for (const k of Object.keys(SETTING_DEFAULTS)) {
      if (k === "logoUrl" || k === "faviconUrl") continue;
      if (k === "registrationOpen" || k === "socialEnabled") values[k] = f.get(k) === "on" ? "true" : "false";
      else if (f.has(k)) values[k] = str(f, k, 8000);
    }
    const logo = await maybeUpload(f, "logo", "image");
    const fav = await maybeUpload(f, "favicon", "image");
    if (logo) values.logoUrl = logo;
    else if (f.get("removeLogo") === "1") values.logoUrl = "";
    else if (str(f, "logoUrlText")) values.logoUrl = safeUrl(str(f, "logoUrlText", 500)) ?? "";
    if (fav) values.faviconUrl = fav;
    else if (f.get("removeFavicon") === "1") values.faviconUrl = "";
    for (const [key, value] of Object.entries(values)) {
      await db.insert(siteSettings).values({ key, value }).onConflictDoUpdate({ target: siteSettings.key, set: { value, updatedAt: new Date() } });
    }
    await audit(admin, "settings.update", undefined, { keys: Object.keys(values) });
    refresh();
    return { ok: "Configurações salvas." };
  });
}

/* ---------- artistas ---------- */
export async function saveArtist(_: AdminResult, f: FormData): Promise<AdminResult> {
  return wrap(async () => {
    const admin = await actionAdmin();
    const id = str(f, "id", 50);
    const name = str(f, "name", 120);
    if (!name) throw new Error("Informe o nome do artista.");
    const links = str(f, "links", 2000).split("\n").map((l) => l.trim()).filter(Boolean).map((l) => { const [label, ...u] = l.split("|"); return { label: label.trim(), url: u.join("|").trim() }; }).filter((l) => /^https?:\/\//.test(l.url));
    const img = (await maybeUpload(f, "image", "image")) ?? safeUrl(str(f, "imageUrl", 500));
    const values = { name, bio: str(f, "bio", 4000), links, published: f.get("published") === "on", ...(img ? { imageUrl: img } : {}) };
    if (id) {
      await db.update(artists).set(values).where(eq(artists.id, id));
      await audit(admin, "artist.update", id);
    } else {
      const [a] = await db.insert(artists).values(values).returning();
      await audit(admin, "artist.create", a.id, { name });
    }
    refresh();
    return { ok: "Artista salvo." };
  });
}

export async function deleteArtist(id: string): Promise<AdminResult> {
  return wrap(async () => {
    const admin = await actionAdmin();
    await db.delete(artists).where(eq(artists.id, id));
    await audit(admin, "artist.delete", id);
    refresh();
    return { ok: "Artista removido (álbuns e faixas incluídos)." };
  });
}

/* ---------- álbuns ---------- */
export async function saveAlbum(_: AdminResult, f: FormData): Promise<AdminResult> {
  return wrap(async () => {
    const admin = await actionAdmin();
    const id = str(f, "id", 50);
    const title = str(f, "title", 150);
    const artistId = str(f, "artistId", 50);
    if (!title || !artistId) throw new Error("Título e artista são obrigatórios.");
    const cover = (await maybeUpload(f, "cover", "image")) ?? safeUrl(str(f, "coverUrl", 500));
    const kind = ["album", "single", "ep"].includes(str(f, "kind")) ? str(f, "kind") : "album";
    const values = { title, artistId, kind, credits: str(f, "credits", 2000), releaseDate: str(f, "releaseDate", 10) || null, published: f.get("published") === "on", ...(cover ? { coverUrl: cover } : {}) };
    if (id) {
      await db.update(albums).set(values).where(eq(albums.id, id));
      await audit(admin, "album.update", id);
    } else {
      const [a] = await db.insert(albums).values(values).returning();
      await audit(admin, "album.create", a.id, { title });
    }
    refresh();
    return { ok: "Álbum salvo." };
  });
}

export async function deleteAlbum(id: string): Promise<AdminResult> {
  return wrap(async () => {
    const admin = await actionAdmin();
    await db.delete(albums).where(eq(albums.id, id));
    await audit(admin, "album.delete", id);
    refresh();
    return { ok: "Álbum removido." };
  });
}

/* ---------- faixas ---------- */
export async function saveTrack(_: AdminResult, f: FormData): Promise<AdminResult> {
  return wrap(async () => {
    const admin = await actionAdmin();
    const id = str(f, "id", 50);
    const title = str(f, "title", 150);
    const artistId = str(f, "artistId", 50);
    if (!title || !artistId) throw new Error("Título e artista são obrigatórios.");
    const uploaded = await maybeUpload(f, "audio", "audio");
    const audioUrl = uploaded ?? safeUrl(str(f, "audioUrl", 800));
    const sourceType = uploaded ? "upload" : ["url", "preview", "jamendo", "external", "upload"].includes(str(f, "sourceType")) ? str(f, "sourceType") : "url";
    const status = ["published", "draft", "pending"].includes(str(f, "status")) ? str(f, "status") : "draft";
    const availability = ["available", "unavailable", "external_only"].includes(str(f, "availability")) ? str(f, "availability") : "available";
    if (status === "published" && availability === "available" && !audioUrl && !id) throw new Error("Informe um arquivo de áudio ou URL licenciada, ou marque a disponibilidade como 'Somente fonte externa'.");
    const cover = (await maybeUpload(f, "cover", "image")) ?? safeUrl(str(f, "coverUrl", 500));
    const albumId = str(f, "albumId", 50) || null;
    const values = {
      title, artistId, albumId,
      trackNumber: Math.max(1, parseInt(str(f, "trackNumber", 4)) || 1),
      featuring: str(f, "featuring", 200), genre: str(f, "genre", 40), credits: str(f, "credits", 2000),
      durationSec: Math.max(0, parseInt(str(f, "durationSec", 6)) || 0),
      releaseDate: str(f, "releaseDate", 10) || null,
      externalUrl: safeUrl(str(f, "externalUrl", 800)),
      licenseNote: str(f, "licenseNote", 500),
      explicit: f.get("explicit") === "on",
      sourceType, status, availability,
      ...(audioUrl ? { audioUrl } : {}),
      ...(cover ? { coverUrl: cover } : {}),
    };
    if (id) {
      await db.update(tracks).set(values).where(eq(tracks.id, id));
      await audit(admin, "track.update", id, { status });
    } else {
      const [t] = await db.insert(tracks).values(values).returning();
      await audit(admin, "track.create", t.id, { title, status });
    }
    refresh();
    return { ok: "Faixa salva." };
  });
}

export async function setTrackStatus(id: string, status: "published" | "draft"): Promise<AdminResult> {
  return wrap(async () => {
    const admin = await actionAdmin();
    await db.update(tracks).set({ status }).where(eq(tracks.id, id));
    await audit(admin, status === "published" ? "track.publish" : "track.unpublish", id);
    refresh();
    return { ok: status === "published" ? "Faixa publicada." : "Faixa despublicada." };
  });
}

export async function deleteTrack(id: string): Promise<AdminResult> {
  return wrap(async () => {
    const admin = await actionAdmin();
    await db.delete(tracks).where(eq(tracks.id, id));
    await audit(admin, "track.delete", id);
    refresh();
    return { ok: "Faixa removida." };
  });
}

async function probe(url: string) {
  if (url.startsWith("/media/")) return { ok: true, info: "arquivo local" };
  try {
    const r = await fetch(url, { method: "GET", headers: { Range: "bytes=0-1" }, signal: AbortSignal.timeout(8000), cache: "no-store" });
    const type = r.headers.get("content-type") ?? "";
    const ok = (r.ok || r.status === 206) && (type.startsWith("audio/") || type.includes("octet-stream") || type.includes("mpeg"));
    return { ok, info: `HTTP ${r.status} ${type}` };
  } catch (e) {
    return { ok: false, info: (e as Error).message };
  }
}

export async function checkTrack(id: string): Promise<AdminResult> {
  return wrap(async () => {
    await actionAdmin();
    const [t] = await db.select().from(tracks).where(eq(tracks.id, id)).limit(1);
    if (!t?.audioUrl) throw new Error("Faixa sem URL de áudio.");
    const r = await probe(t.audioUrl);
    if (!r.ok) await db.insert(eventLogs).values({ level: "error", source: "verificacao", message: `Fonte falhou (${r.info}): ${t.title}`, trackId: id });
    return r.ok ? { ok: `Fonte de áudio OK (${r.info}).` } : { error: `Fonte com falha: ${r.info}` };
  });
}

export async function checkAllTracks(): Promise<AdminResult> {
  return wrap(async () => {
    const admin = await actionAdmin();
    const rows = await db.select().from(tracks).where(and(eq(tracks.status, "published"), sql`${tracks.audioUrl} is not null`)).limit(200);
    let bad = 0;
    const seen = new Map<string, boolean>();
    for (const t of rows) {
      const key = t.audioUrl!;
      let ok = seen.get(key);
      if (ok === undefined) {
        ok = (await probe(key)).ok;
        seen.set(key, ok);
      }
      if (!ok) {
        bad++;
        await db.insert(eventLogs).values({ level: "error", source: "verificacao", message: `Fonte indisponível: ${t.title}`, trackId: t.id });
      }
    }
    await audit(admin, "tracks.verify_all", undefined, { checked: rows.length, failed: bad });
    return { ok: `${rows.length} faixas verificadas; ${bad} com falha.` };
  });
}

/* ---------- importação de catálogo externo ---------- */
export async function importFromItunes(_: AdminResult, f: FormData): Promise<AdminResult> {
  return wrap(async () => {
    const admin = await actionAdmin();
    const term = str(f, "term", 80);
    if (term.length < 2) throw new Error("Informe um termo de busca.");
    const n = await importItunes(term, Math.min(25, parseInt(str(f, "limit", 3)) || 10));
    await audit(admin, "import.itunes", undefined, { term, created: n });
    refresh();
    return { ok: `${n} faixas novas importadas (prévias de 30s, com link para a fonte original).` };
  });
}

export async function importFromJamendo(_: AdminResult, f: FormData): Promise<AdminResult> {
  return wrap(async () => {
    const admin = await actionAdmin();
    const key = process.env.JAMENDO_CLIENT_ID;
    if (!key) throw new Error("Defina a variável de ambiente JAMENDO_CLIENT_ID (chave gratuita em developer.jamendo.com) e reinicie a aplicação.");
    const term = str(f, "term", 80);
    const url = `https://api.jamendo.com/v3.0/tracks/?client_id=${encodeURIComponent(key)}&format=json&limit=15&audioformat=mp32&include=musicinfo&search=${encodeURIComponent(term)}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(10000), cache: "no-store" });
    const json = (await res.json()) as { headers: { status: string; error_message?: string }; results: { id: string; name: string; duration: number; artist_id: string; artist_name: string; album_id: string; album_name: string; album_image: string; releasedate: string; audio: string; audiodownload_allowed: boolean; shareurl: string; license_ccurl: string }[] };
    if (json.headers.status !== "success") throw new Error(json.headers.error_message ?? "Jamendo recusou a requisição.");
    let created = 0;
    for (const j of json.results) {
      const ex = await db.select({ id: tracks.id }).from(tracks).where(and(eq(tracks.externalSource, "jamendo"), eq(tracks.externalId, j.id))).limit(1);
      if (ex.length || !j.audio) continue;
      let [artist] = await db.select().from(artists).where(and(eq(artists.externalSource, "jamendo"), eq(artists.externalId, j.artist_id))).limit(1);
      if (!artist) [artist] = await db.insert(artists).values({ name: j.artist_name, externalSource: "jamendo", externalId: j.artist_id }).returning();
      let [album] = await db.select().from(albums).where(and(eq(albums.externalSource, "jamendo"), eq(albums.externalId, j.album_id))).limit(1);
      if (!album) [album] = await db.insert(albums).values({ title: j.album_name, artistId: artist.id, coverUrl: j.album_image, releaseDate: j.releasedate, externalSource: "jamendo", externalId: j.album_id }).returning();
      await db.insert(tracks).values({ title: j.name, artistId: artist.id, albumId: album.id, durationSec: j.duration, releaseDate: j.releasedate, sourceType: "jamendo", audioUrl: j.audio, externalUrl: j.shareurl, licenseNote: `Jamendo — licença: ${j.license_ccurl}`, externalSource: "jamendo", externalId: j.id });
      created++;
    }
    await audit(admin, "import.jamendo", undefined, { term, created });
    refresh();
    return { ok: `${created} faixas Jamendo importadas.` };
  });
}

/* ---------- usuários ---------- */
async function guardSelf(adminId: string, targetId: string) {
  if (adminId === targetId) throw new Error("Você não pode alterar a própria conta por aqui.");
}

export async function setUserRole(userId: string, role: "user" | "artist" | "admin"): Promise<AdminResult> {
  return wrap(async () => {
    const admin = await actionAdmin();
    await guardSelf(admin.id, userId);
    await db.update(users).set({ role }).where(eq(users.id, userId));
    await audit(admin, "user.role", userId, { role });
    refresh();
    return { ok: "Permissão atualizada." };
  });
}

export async function suspendUser(userId: string, reason: string): Promise<AdminResult> {
  return wrap(async () => {
    const admin = await actionAdmin();
    await guardSelf(admin.id, userId);
    await db.update(users).set({ status: "suspended", suspendedReason: reason.slice(0, 200) || "Violação dos termos" }).where(eq(users.id, userId));
    await db.delete(sessions).where(eq(sessions.userId, userId));
    await audit(admin, "user.suspend", userId, { reason });
    refresh();
    return { ok: "Conta suspensa e sessões encerradas." };
  });
}

export async function reactivateUser(userId: string): Promise<AdminResult> {
  return wrap(async () => {
    const admin = await actionAdmin();
    await db.update(users).set({ status: "active", suspendedReason: null }).where(eq(users.id, userId));
    await audit(admin, "user.reactivate", userId);
    refresh();
    return { ok: "Conta reativada." };
  });
}

export async function approveArtist(userId: string): Promise<AdminResult> {
  return wrap(async () => {
    const admin = await actionAdmin();
    const [u] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    if (!u) throw new Error("Usuário não encontrado.");
    let artistId = u.artistId;
    if (!artistId) {
      const [a] = await db.insert(artists).values({ name: u.displayName }).returning();
      artistId = a.id;
    }
    await db.update(users).set({ role: u.role === "admin" ? "admin" : "artist", artistId, artistRequest: false }).where(eq(users.id, userId));
    await db.insert(notifications).values({ userId, kind: "artist", message: "Seu perfil de artista foi aprovado. Acesse o Estúdio para enviar faixas.", href: "/estudio" });
    await audit(admin, "user.approve_artist", userId, { artistId });
    refresh();
    return { ok: "Perfil de artista criado e vinculado." };
  });
}

export async function generateResetLink(userId: string): Promise<AdminResult> {
  return wrap(async () => {
    const admin = await actionAdmin();
    const code = await issueCode(userId, "reset");
    await audit(admin, "user.reset_code", userId);
    return { ok: "Código gerado (válido por 15 minutos). Envie ao usuário por um canal seguro; ele usa em Esqueci minha senha.", link: `${await appOrigin()}/recuperar — código: ${code}` };
  });
}

/* ---------- denúncias ---------- */
export async function resolveReport(reportId: string, status: "resolved" | "dismissed", takedown: boolean): Promise<AdminResult> {
  return wrap(async () => {
    const admin = await actionAdmin();
    const [r] = await db.select().from(reports).where(eq(reports.id, reportId)).limit(1);
    if (!r) throw new Error("Denúncia não encontrada.");
    if (takedown && status === "resolved") {
      if (r.targetType === "track") await db.update(tracks).set({ status: "draft" }).where(eq(tracks.id, r.targetId));
      if (r.targetType === "playlist") await db.update(playlists).set({ isPublic: false }).where(eq(playlists.id, r.targetId));
      if (r.targetType === "artist") await db.update(artists).set({ published: false }).where(eq(artists.id, r.targetId));
      if (r.targetType === "user") await db.update(users).set({ status: "suspended", suspendedReason: "Violação dos termos (denúncia)" }).where(and(eq(users.id, r.targetId), sql`${users.role} <> 'admin'`));
    }
    await db.update(reports).set({ status, resolution: takedown ? "Conteúdo removido/restringido" : status === "dismissed" ? "Sem violação" : "Resolvida" }).where(eq(reports.id, reportId));
    await audit(admin, "report.resolve", reportId, { status, takedown, target: `${r.targetType}:${r.targetId}` });
    refresh();
    return { ok: "Denúncia atualizada." };
  });
}

/* ---------- página inicial ---------- */
export async function addSection(_: AdminResult, f: FormData): Promise<AdminResult> {
  return wrap(async () => {
    const admin = await actionAdmin();
    const kind = str(f, "kind", 40);
    const title = str(f, "title", 100);
    if (!kind || !title) throw new Error("Escolha o tipo e o título.");
    const ids = f.getAll("itemIds").map(String).slice(0, 60);
    const [{ m }] = await db.select({ m: sql<number>`coalesce(max(${homeSections.position}),-1)` }).from(homeSections);
    const config: Record<string, string> = kind === "banner" ? { text: str(f, "text", 300), imageUrl: safeUrl(str(f, "imageUrl", 500)) ?? "", href: str(f, "href", 300), cta: str(f, "cta", 40) } : {};
    await db.insert(homeSections).values({ kind, title, subtitle: str(f, "subtitle", 160), itemIds: ids, config, position: Number(m) + 1 });
    await audit(admin, "home.add_section", undefined, { kind, title });
    refresh();
    return { ok: "Seção adicionada." };
  });
}

export async function moveSection(id: string, dir: "up" | "down"): Promise<AdminResult> {
  return wrap(async () => {
    const admin = await actionAdmin();
    const all = await db.select().from(homeSections).orderBy(asc(homeSections.position), asc(homeSections.createdAt));
    const i = all.findIndex((s) => s.id === id);
    const j = dir === "up" ? i - 1 : i + 1;
    if (i < 0 || j < 0 || j >= all.length) return { ok: "Sem alteração." };
    [all[i], all[j]] = [all[j], all[i]];
    await db.transaction(async (tx) => {
      for (let p = 0; p < all.length; p++) await tx.update(homeSections).set({ position: p }).where(eq(homeSections.id, all[p].id));
    });
    await audit(admin, "home.reorder", id);
    refresh();
    return { ok: "Ordem atualizada." };
  });
}

export async function toggleSection(id: string, enabled: boolean): Promise<AdminResult> {
  return wrap(async () => {
    const admin = await actionAdmin();
    await db.update(homeSections).set({ enabled }).where(eq(homeSections.id, id));
    await audit(admin, "home.toggle", id, { enabled });
    refresh();
    return { ok: enabled ? "Seção ativada." : "Seção oculta." };
  });
}

export async function deleteSection(id: string): Promise<AdminResult> {
  return wrap(async () => {
    const admin = await actionAdmin();
    await db.delete(homeSections).where(eq(homeSections.id, id));
    await audit(admin, "home.delete", id);
    refresh();
    return { ok: "Seção removida." };
  });
}

export async function createEditorialPlaylist(_: AdminResult, f: FormData): Promise<AdminResult> {
  return wrap(async () => {
    const admin = await actionAdmin();
    const name = str(f, "name", 100);
    if (!name) throw new Error("Informe o nome.");
    const cover = (await maybeUpload(f, "cover", "image")) ?? safeUrl(str(f, "coverUrl", 500));
    const [pl] = await db.insert(playlists).values({ name, description: str(f, "description", 300), isPublic: true, editorial: true, coverUrl: cover }).returning();
    const ids = f.getAll("trackIds").map(String);
    if (ids.length) await db.insert(playlistTracks).values(ids.map((trackId, position) => ({ playlistId: pl.id, trackId, position })));
    await audit(admin, "playlist.editorial_create", pl.id, { name });
    refresh();
    return { ok: "Playlist editorial criada. Use-a em uma seção 'Playlists editoriais' ou 'Playlists (manual)'." };
  });
}

/* ---------- suporte ---------- */
export async function supportReply(_: AdminResult, f: FormData): Promise<AdminResult> {
  return wrap(async () => {
    const admin = await actionAdmin();
    const ticketId = str(f, "ticketId", 50);
    const body = str(f, "body", 2000);
    if (body.length < 2) throw new Error("Escreva a resposta.");
    const [t] = await db.select().from(supportTickets).where(eq(supportTickets.id, ticketId)).limit(1);
    if (!t) throw new Error("Conversa não encontrada.");
    // a resposta sai como "Suporte do aplicativo" — sem nome pessoal
    await db.insert(supportMessages).values({ ticketId, fromSupport: true, body });
    await db.update(supportTickets).set({ status: "answered", updatedAt: new Date() }).where(eq(supportTickets.id, ticketId));
    if (t.userId) await db.insert(notifications).values({ userId: t.userId, kind: "support", message: "O suporte respondeu à sua conversa.", href: "/ajuda" });
    await audit(admin, "support.reply", ticketId);
    refresh();
    return { ok: "Resposta enviada ao usuário." };
  });
}

export async function supportSetStatus(ticketId: string, status: "open" | "closed"): Promise<AdminResult> {
  return wrap(async () => {
    const admin = await actionAdmin();
    await db.update(supportTickets).set({ status, updatedAt: new Date() }).where(eq(supportTickets.id, ticketId));
    await audit(admin, "support.status", ticketId, { status });
    refresh();
    return { ok: status === "closed" ? "Conversa encerrada." : "Conversa reaberta." };
  });
}

export async function deletePlaylistAdmin(id: string): Promise<AdminResult> {
  return wrap(async () => {
    const admin = await actionAdmin();
    await db.delete(playlists).where(eq(playlists.id, id));
    await audit(admin, "playlist.delete", id);
    refresh();
    return { ok: "Playlist removida." };
  });
}
