// Empacota o código-fonte do Sonar em dist/sonar-fonte.zip (sem dependências, build ou segredos).
// Uso: node scripts/package.mjs
import { readdir, stat, mkdir, rm } from "node:fs/promises";
import path from "node:path";
import { execFileSync } from "node:child_process";

const ROOT = process.cwd();
const DIST = path.join(ROOT, "dist");
const OUT = path.join(DIST, "sonar-fonte.zip");

// O que nunca entra no pacote
const SKIP_DIRS = new Set(["node_modules", ".next", "dist", ".git", "storage", "scripts", ".vercel"]);
const SKIP_FILES = new Set([".env", "next-env.d.ts", "package-lock.json"]);

async function walk(dir, acc = []) {
  for (const e of await readdir(dir, { withFileTypes: true })) {
    if (SKIP_DIRS.has(e.name)) continue;
    if (e.name.endsWith(".log") || e.name.endsWith(".tsbuildinfo")) continue;
    const full = path.join(dir, e.name);
    if (e.isDirectory()) await walk(full, acc);
    else if (!SKIP_FILES.has(e.name)) acc.push(full);
  }
  return acc;
}

await mkdir(DIST, { recursive: true });
const files = await walk(ROOT);
const total = (await Promise.all(files.map((f) => stat(f)))).reduce((s, x) => s + x.size, 0);
await rm(OUT, { force: true }).catch(() => {});

// Cria o ZIP com a ferramenta do sistema (zip). Fallback: tar.gz.
try {
  execFileSync("zip", ["-q", "-r", OUT, ".", "-x", "node_modules/*", "dist/*", ".next/*", ".git/*", "storage/*", "scripts/*", ".env", "*.log", "*.tsbuildinfo"], { cwd: ROOT, stdio: "inherit" });
  console.log("OK: " + files.length + " arquivos (" + (total / 1024 / 1024).toFixed(2) + " MB) -> dist/sonar-fonte.zip");
} catch {
  await rm(OUT, { force: true }).catch(() => {});
  const tarOut = path.join(DIST, "sonar-fonte.tar.gz");
  execFileSync("tar", ["-czf", tarOut, "--exclude=./dist", "--exclude=./node_modules", "--exclude=./.next", "--exclude=./.git", "--exclude=./.env", "--exclude=./storage", "--exclude=./scripts", "."], { cwd: ROOT, stdio: "inherit" });
  console.log("OK (tar): " + files.length + " arquivos -> dist/sonar-fonte.tar.gz");
}
