import fs from "node:fs"; import { execSync } from "node:child_process";
const BASE = "http://127.0.0.1:3100";
const man = JSON.parse(fs.readFileSync(".next/server/server-reference-manifest.json", "utf8"));
const ids = {}; for (const [id, v] of Object.entries(man.node)) ids[v.exportedName ?? v.name] = id;
let jar = {};
const cookie = () => Object.entries(jar).map(([k, v]) => `${k}=${v}`).join("; ");
const absorb = (r) => { for (const c of r.headers.getSetCookie?.() ?? []) { const [kv] = c.split(";"); const i = kv.indexOf("="); jar[kv.slice(0, i)] = kv.slice(i + 1); } };
const get = async (p) => { const r = await fetch(BASE + p, { redirect: "manual", headers: { cookie: cookie() } }); absorb(r); return r; };
async function post(path, fields) {
  const html = await (await get(path)).text();
  const fd = new FormData();
  for (const m of html.matchAll(/<input type="hidden" name="(\$ACTION[^"]*)"(?: value="([^"]*)")?/g)) fd.append(m[1], (m[2] ?? "").replace(/&quot;/g, '"').replace(/&amp;/g, "&"));
  for (const [k, v] of Object.entries(fields)) fd.append(k, v);
  const r = await fetch(BASE + path, { method: "POST", body: fd, redirect: "manual", headers: { cookie: cookie() } });
  absorb(r); return { status: r.status, loc: r.headers.get("location") };
}
await post("/entrar", { email: "laionelsilvacastro232@gmail.com", password: "35116265" });
console.log("admin sid?", !!jar.sid);
const uid = execSync(`psql postgresql://postgres:postgres@127.0.0.1:5432/app_db -tAc "select id from users where username like 'art%' limit 1"`).toString().trim();
console.log("uid:", uid);
async function actEnc(name, enc) {
  const fd = new FormData();
  if (enc === "plain") { fd.append("0", JSON.stringify(["$undefined", "$K1"])); fd.append("1", JSON.stringify(uid)); }
  if (enc === "array") { fd.append("0", JSON.stringify(["$undefined", "$K1"])); fd.append("1", JSON.stringify([uid])); }
  const r = await fetch(BASE + "/", { method: "POST", body: fd, headers: { cookie: cookie(), "Next-Action": ids[name], Accept: "text/x-component" } });
  return (await r.text()).split("\n")[1]?.slice(0, 160);
}
console.log("plain:", await actEnc("approveArtist", "plain"));
console.log("array:", await actEnc("approveArtist", "array"));
console.log("role:", execSync(`psql postgresql://postgres:postgres@127.0.0.1:5432/app_db -tAc "select role from users where id='${uid}'"`).toString().trim());
