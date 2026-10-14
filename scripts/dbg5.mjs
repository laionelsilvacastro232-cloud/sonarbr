import { execSync } from "node:child_process";
const BASE = "http://127.0.0.1:3203";
let jar = {};
const cookie = () => Object.entries(jar).map(([k, v]) => `${k}=${v}`).join("; ");
const absorb = (r) => { for (const c of r.headers.getSetCookie?.() ?? []) { const [kv] = c.split(";"); const i = kv.indexOf("="); jar[kv.slice(0, i)] = kv.slice(i + 1); } };
const get = async (p) => { const r = await fetch(BASE + p, { redirect: "manual", headers: { cookie: cookie() } }); absorb(r); return r; };
async function post(path, fields) {
  const html = await (await get(path)).text();
  const fd = new FormData();
  for (const m of html.matchAll(/<input type="hidden" name="(\$ACTION[^"]*)"(?: value="([^"]*)")?/gs)) fd.append(m[1], (m[2] ?? "").replace(/&quot;/g, '"').replace(/&amp;/g, "&"));
  for (const [k, v] of Object.entries(fields)) fd.append(k, v);
  const r = await fetch(BASE + path, { method: "POST", body: fd, redirect: "manual", headers: { cookie: cookie(), Origin: BASE } });
  absorb(r); return { status: r.status, text: await r.text() };
}
const u = `art${Date.now().toString().slice(-7)}`;
await post("/cadastro", { displayName: "Art X", username: u, email: `${u}@e.com`, password: "senha1234", terms: "on", artist: "1" });
const uid = execSync(`psql postgresql://postgres:postgres@127.0.0.1:5432/app_db -tAc "select id from users where username='${u}'"`).toString().trim();
const html = await (await get("/estudio")).text();
const forms = html.split("<form").slice(1);
console.log("forms:", forms.length);
forms.forEach((f, i) => {
  const names = [...f.matchAll(/<input type="hidden" name="(\$ACTION[^"]*)"(?: value="([^"]*)")?/gs)].map((m) => `${m[1]}(${(m[2] ?? "").length})`);
  const fields = [...f.matchAll(/name="(title|name|body|status|bio|audio)"/g)].map((m) => m[1]);
  console.log(i, "hidden:", names.join(" "), "| fields:", fields.join(","));
});
console.log("uid", uid);
// aprova via admin
const adm = {};
const jarBackup = jar; jar = adm;
await post("/entrar", { email: "laionelsilvacastro232@gmail.com", password: "35116265" });
const { execSync: ex } = await import("node:child_process");
const r = await fetch(BASE + "/", { method: "POST", body: JSON.stringify([uid]), headers: { cookie: cookie(), "Next-Action": (await import("node:fs")).readFileSync(".next/server/server-reference-manifest.json", "utf8") && JSON.parse((await import("node:fs")).readFileSync(".next/server/server-reference-manifest.json", "utf8")).node && Object.entries(JSON.parse((await import("node:fs")).readFileSync(".next/server/server-reference-manifest.json", "utf8")).node).find(([, v]) => v.exportedName === "approveArtist")[0], Accept: "text/x-component", Origin: BASE } });
console.log("aprovar:", (await r.text()).split("\n")[1]);
jar = jarBackup;
const html2 = await (await get("/estudio")).text();
const forms2 = html2.split("<form").slice(1);
console.log("forms aprovado:", forms2.length);
forms2.forEach((f, i) => {
  const names = [...f.matchAll(/<input type="hidden" name="(\$ACTION[^"]*)"(?: value="([^"]*)")?/gs)].map((m) => `${m[1]}(${(m[2] ?? "").length})`);
  const fields = [...f.matchAll(/name="(title|name|body|status|bio|audio)"/g)].map((m) => m[1]);
  console.log(i, "hidden:", names.join(" "), "| fields:", fields.join(","));
});
// POST real do formulário de novidade (form index 2)
const seg = forms2[2] ?? forms2[forms2.length - 1];
const fd = new FormData();
for (const m of seg.matchAll(/<input type="hidden" name="(\$ACTION[^"]*)"(?: value="([^"]*)")?/gs)) fd.append(m[1], (m[2] ?? "").replace(/&quot;/g, '"').replace(/&amp;/g, "&"));
fd.append("title", "Novidade via form");
fd.append("body", "Conteúdo de teste");
fd.append("status", "published");
const rr = await fetch(BASE + "/estudio", { method: "POST", body: fd, redirect: "manual", headers: { cookie: cookie(), Origin: BASE } });
const body = await rr.text();
console.log("post novidade:", rr.status);
console.log("mensagem na página:", (body.match(/Erro:[^<]{0,140}|Publicação criada[^<]{0,60}/) || ["(nenhuma)"])[0]);
console.log("no banco:", ex(`psql postgresql://postgres:postgres@127.0.0.1:5432/app_db -tAc "select title from artist_posts order by created_at desc limit 1"`).toString().trim());
// POST do formulário de perfil (form index 1)
const seg1 = forms2[1];
const fd1 = new FormData();
for (const m of seg1.matchAll(/<input type="hidden" name="(\$ACTION[^"]*)"(?: value="([^"]*)")?/gs)) fd1.append(m[1], (m[2] ?? "").replace(/&quot;/g, '"').replace(/&amp;/g, "&"));
fd1.append("name", "Nome Artístico OK");
fd1.append("bio", "Bio alterada pelo form");
const rr1 = await fetch(BASE + "/estudio", { method: "POST", body: fd1, redirect: "manual", headers: { cookie: cookie(), Origin: BASE } });
const b1 = await rr1.text();
console.log("post perfil:", rr1.status, "| msg:", (b1.match(/Erro:[^<]{0,120}|Perfil de artista atualizado[^<]{0,40}/) || ["(nenhuma)"])[0]);
console.log("bio no banco:", ex(`psql postgresql://postgres:postgres@127.0.0.1:5432/app_db -tAc "select bio from artists where id=(select artist_id from users where id='${uid}')"`).toString().trim());
