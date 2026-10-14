import "server-only";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomBytes } from "node:crypto";

export const STORAGE_DIR = path.join(process.cwd(), "storage", "uploads");

const LIMITS = { audio: 40 * 1024 * 1024, image: 4 * 1024 * 1024 };

function sniff(buf: Buffer): { ext: string; kind: "audio" | "image" } | null {
  if (buf.length < 12) return null;
  if (buf[0] === 0xff && buf[1] === 0xd8) return { ext: "jpg", kind: "image" };
  if (buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return { ext: "png", kind: "image" };
  if (buf.subarray(0, 4).toString() === "RIFF" && buf.subarray(8, 12).toString() === "WEBP") return { ext: "webp", kind: "image" };
  if (buf.subarray(0, 4).toString() === "RIFF" && buf.subarray(8, 12).toString() === "WAVE") return { ext: "wav", kind: "audio" };
  if (buf.subarray(0, 3).toString() === "ID3" || (buf[0] === 0xff && (buf[1] & 0xe0) === 0xe0)) return { ext: "mp3", kind: "audio" };
  if (buf.subarray(4, 8).toString() === "ftyp") return { ext: "m4a", kind: "audio" };
  if (buf.subarray(0, 4).toString() === "OggS") return { ext: "ogg", kind: "audio" };
  if (buf.subarray(0, 4).toString() === "fLaC") return { ext: "flac", kind: "audio" };
  return null;
}

/** Valida tipo real (magic bytes) e tamanho; grava em storage/uploads e retorna a URL pública. */
export async function saveUpload(file: File, kind: "audio" | "image") {
  if (!file || file.size === 0) throw new Error("Arquivo vazio.");
  if (file.size > LIMITS[kind]) throw new Error(`Arquivo muito grande (máximo ${LIMITS[kind] / 1024 / 1024} MB).`);
  const buf = Buffer.from(await file.arrayBuffer());
  const type = sniff(buf);
  if (!type || type.kind !== kind) throw new Error(kind === "audio" ? "Formato de áudio não suportado (use MP3, M4A, OGG, WAV ou FLAC)." : "Imagem inválida (use JPG, PNG ou WebP).");
  await mkdir(STORAGE_DIR, { recursive: true });
  const name = `${randomBytes(12).toString("hex")}.${type.ext}`;
  await writeFile(path.join(STORAGE_DIR, name), buf);
  return `/media/${name}`;
}

export const MIME: Record<string, string> = {
  jpg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  mp3: "audio/mpeg",
  m4a: "audio/mp4",
  ogg: "audio/ogg",
  wav: "audio/wav",
  flac: "audio/flac",
};

export function safeUrl(u: string | null | undefined) {
  const v = (u ?? "").trim();
  if (!v) return null;
  if (v.startsWith("/media/")) return v;
  try {
    const url = new URL(v);
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : null;
  } catch {
    return null;
  }
}
