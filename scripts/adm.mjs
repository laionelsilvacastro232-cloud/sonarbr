const BASE = "http://127.0.0.1:3404";
let jar = {}; const cookie = () => Object.entries(jar).map(([k, v]) => `${k}=${v}`).join("; ");
const absorb = (r) => { for (const c of r.headers.getSetCookie?.() ?? []) { const [kv] = c.split(";"); const i = kv.indexOf("="); jar[kv.slice(0, i)] = kv.slice(i + 1); } };
const get = async (p) => { const r = await fetch(BASE + p, { redirect: "manual", headers: { cookie: cookie() } }); absorb(r); return r; };
async function formPost(path, fields, marker) {
  const html = await (await get(path)).text();
  const seg = html.split("<form").slice(1).find((f) => f.includes(marker) && f.includes("$ACTION"));
  const fd = new FormData();
  for (const m of seg.matchAll(/<input type="hidden" name="(\$ACTION[^"]*)"(?: value="([^"]*)")?/gs)) fd.append(m[1], (m[2] ?? "").replace(/&quot;/g, '"').replace(/&amp;/g, "&"));
  for (const [k, v] of Object.entries(fields)) fd.append(k, v);
  const r = await fetch(BASE + path, { method: "POST", body: fd, redirect: "manual", headers: { cookie: cookie(), Origin: BASE } });
  absorb(r); return r.status;
}
console.log("login admin:", await formPost("/entrar", { email: "laionelsilvacastro232@gmail.com", password: "35116265" }, 'id="pw"'));
for (const p of ["/admin", "/admin/suporte", "/admin/conteudo", "/admin/usuarios", "/admin/denuncias", "/admin/home", "/admin/configuracoes", "/admin/auditoria", "/ajuda"]) {
  const r = await get(p); console.log(p.padEnd(24), r.status);
}
