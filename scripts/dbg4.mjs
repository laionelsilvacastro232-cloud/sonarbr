import fs from "node:fs";
const BASE = "http://127.0.0.1:3201";
const man = JSON.parse(fs.readFileSync(".next/server/server-reference-manifest.json", "utf8"));
const ids = {}; for (const [id, v] of Object.entries(man.node)) ids[v.exportedName ?? v.name] = id;
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
  absorb(r); return r.status;
}
const email = `dbg${Date.now().toString().slice(-7)}@e.com`;
console.log("cadastro:", await post("/cadastro", { displayName: "Dbg X", username: `dbgx${Date.now().toString().slice(-6)}`, email, password: "senha1234", terms: "on", artist: "1" }), "sid?", !!jar.sid);
const uid = (await fetch(BASE + "/", { method: "POST" , headers:{}} , ) && null);
async function tryPrefix(prefix, root) {
  const fd = new FormData();
  fd.append("0", JSON.stringify(root));
  fd.append(prefix + "displayName", "Nome Teste X");
  fd.append(prefix + "bio", "Bio de teste");
  const r = await fetch(BASE + "/", { method: "POST", body: fd, headers: { cookie: cookie(), "Next-Action": ids.updateProfileAction, Accept: "text/x-component", Origin: BASE } });
  const t = await r.text();
  return t.split("\n").slice(1).join(" ").slice(0, 110);
}
for (const p of ["1_", "2_", "0_", "arg1_"]) console.log("prefixo", JSON.stringify(p), "→", await tryPrefix(p, ["$undefined", "$K1"]));
for (const p of ["1_", "2_"]) console.log("root [null,'$K1']", JSON.stringify(p), "→", await tryPrefix(p, [null, "$K1"]));
