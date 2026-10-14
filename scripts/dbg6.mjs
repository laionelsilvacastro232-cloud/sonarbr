import { execSync } from "node:child_process";
import fs from "node:fs";
const BASE = "http://127.0.0.1:3204";
const man = JSON.parse(fs.readFileSync(".next/server/server-reference-manifest.json", "utf8"));
const ids = {}; for (const [id, v] of Object.entries(man.node)) ids[v.exportedName ?? v.name] = id;
const psql = (q) => execSync(`psql postgresql://postgres:postgres@127.0.0.1:5432/app_db -tAc "${q}"`).toString().trim();
let jar = {};
const cookie = () => Object.entries(jar).map(([k, v]) => `${k}=${v}`).join("; ");
const absorb = (r) => { for (const c of r.headers.getSetCookie?.() ?? []) { const [kv] = c.split(";"); const i = kv.indexOf("="); jar[kv.slice(0, i)] = kv.slice(i + 1); } };
const get = async (p) => { const r = await fetch(BASE + p, { redirect: "manual", headers: { cookie: cookie() } }); absorb(r); return r; };
async function formPost(path, fields, segIndex = 0) {
  const html = await (await get(path)).text();
  const forms = html.split("<form").slice(1);
  const seg = forms[segIndex];
  const fd = new FormData();
  for (const m of seg.matchAll(/<input type="hidden" name="(\$ACTION[^"]*)"(?: value="([^"]*)")?/gs)) fd.append(m[1], (m[2] ?? "").replace(/&quot;/g, '"').replace(/&amp;/g, "&"));
  for (const [k, v] of Object.entries(fields)) fd.append(k, v);
  const r = await fetch(BASE + path, { method: "POST", body: fd, redirect: "manual", headers: { cookie: cookie(), Origin: BASE } });
  absorb(r); return { status: r.status, body: await r.text() };
}
const u = `art${Date.now().toString().slice(-7)}`;
let r = await formPost("/cadastro", { displayName: "Art Six", username: u, email: `${u}@e.com`, password: "senha1234", terms: "on", artist: "1" });
console.log("cadastro:", r.status, "sid?", !!jar.sid);
const uid = psql(`select id from users where username='${u}'`);
const admJar = jar; jar = {};
await formPost("/entrar", { email: "laionelsilvacastro232@gmail.com", password: "35116265" }, 0);
r = await fetch(BASE + "/", { method: "POST", body: JSON.stringify([uid]), headers: { cookie: cookie(), "Next-Action": ids.approveArtist, Accept: "text/x-component", Origin: BASE } });
console.log("aprovar:", (await r.text()).split("\n")[1]);
jar = admJar;
// novidade via formulário real (form 3)
r = await formPost("/estudio", { title: "Novidade Real", body: "Conteúdo real", status: "published" }, 3);
console.log("post novidade:", r.status, "| msg:", (r.body.match(/Publicação criada[^<]{0,30}|Erro:[^<]{0,80}/) || ["(nenhuma)"])[0]);
console.log("no banco:", psql("select title||' | '||status from artist_posts where title='Novidade Real'"));
// faixa via formulário real (form 2) com arquivo
const fdAudio = new Blob([fs.readFileSync("/tmp/faixa.mp3")], { type: "audio/mpeg" });
r = await formPost("/estudio", {}, 2);
// refaz com arquivo: monta manualmente
{
  const html = await (await get("/estudio")).text();
  const seg = html.split("<form").slice(1)[2];
  const fd = new FormData();
  for (const m of seg.matchAll(/<input type="hidden" name="(\$ACTION[^"]*)"(?: value="([^"]*)")?/gs)) fd.append(m[1], (m[2] ?? "").replace(/&quot;/g, '"').replace(/&amp;/g, "&"));
  fd.append("title", "Faixa Real");
  fd.append("genre", "Pop");
  fd.append("rights", "on");
  fd.append("audio", fdAudio, "f.mp3");
  const rr = await fetch(BASE + "/estudio", { method: "POST", body: fd, redirect: "manual", headers: { cookie: cookie(), Origin: BASE } });
  absorb(rr);
  console.log("upload faixa:", rr.status);
}
console.log("faixa no banco:", psql("select status||' | '||source_type from tracks where title='Faixa Real'"));
console.log("arquivo servido:", await (async () => { const u2 = psql("select audio_url from tracks where title='Faixa Real'"); if (!u2) return "sem url"; const rr = await fetch(BASE + u2, { headers: { Range: "bytes=0-3" } }); return `${rr.status} ${rr.headers.get("content-type")} ${u2}`; })());
