import { execSync } from "node:child_process";
const BASE = "http://127.0.0.1:3100";
let jar = {};
const cookie = () => Object.entries(jar).map(([k, v]) => `${k}=${v}`).join("; ");
const absorb = (res) => { for (const c of res.headers.getSetCookie?.() ?? []) { const [kv] = c.split(";"); const i = kv.indexOf("="); jar[kv.slice(0, i)] = kv.slice(i + 1); } };
const get = async (p) => { const r = await fetch(BASE + p, { redirect: "manual", headers: { cookie: cookie() } }); absorb(r); return r; };
async function post(path, fields) {
  const html = await (await get(path)).text();
  const fd = new FormData();
  for (const m of html.matchAll(/<input type="hidden" name="(\$ACTION[^"]*)"(?: value="([^"]*)")?/g)) fd.append(m[1], (m[2] ?? "").replace(/&quot;/g, '"').replace(/&amp;/g, "&"));
  for (const [k, v] of Object.entries(fields)) fd.append(k, v);
  const r = await fetch(BASE + path, { method: "POST", body: fd, redirect: "manual", headers: { cookie: cookie() } });
  absorb(r); return { status: r.status, loc: r.headers.get("location"), text: await r.text() };
}
const S = `dbg${Date.now().toString().slice(-6)}`;
let r = await post("/cadastro", { displayName: "Dbg", username: S, email: `${S}@e.com`, password: "senha1234", terms: "on", artist: "1" });
console.log("cadastro:", r.status, r.loc, "sid?", !!jar.sid);
const sidCount = () => execSync(`psql postgresql://postgres:postgres@127.0.0.1:5432/app_db -tAc "select count(*) from sessions where user_id=(select id from users where username='${S}')"`).toString().trim();
console.log("sessões no banco:", sidCount());
for (const p of ["/estudio", "/configuracoes", "/biblioteca", "/estudio"]) {
  const rr = await get(p);
  console.log(p, rr.status, "sessões db:", sidCount());
}
r = await post("/cadastro", { displayName: "Dup", username: S + "x", email: `${S}@e.com`, password: "senha1234", terms: "on" });
console.log("duplicado status:", r.status, "| msg contém 'já cadastrado'?", /já cadastrado/i.test(r.text), "| sid?", !!jar.sid, "| sessões db:", sidCount());
console.log(r.text.slice(0, 300));
