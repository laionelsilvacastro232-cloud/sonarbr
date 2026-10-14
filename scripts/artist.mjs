const BASE = process.env.BASE || "https://3000-i6redibv466o1zp8lasv1.e2b.app";
let jar = {};
const cookie = () => Object.entries(jar).map(([k, v]) => `${k}=${v}`).join("; ");
const absorb = (res) => { for (const c of res.headers.getSetCookie?.() ?? []) { const [kv] = c.split(";"); const i = kv.indexOf("="); jar[kv.slice(0, i)] = kv.slice(i + 1); } };
const get = async (p) => { const r = await fetch(BASE + p, { redirect: "manual", headers: { cookie: cookie() } }); absorb(r); return r; };
async function formPost(path, fields) {
  const html = await (await get(path)).text();
  const fd = new FormData();
  for (const m of html.matchAll(/<input type="hidden" name="(\$ACTION[^"]*)"(?: value="([^"]*)")?/g)) fd.append(m[1], (m[2] ?? "").replace(/&quot;/g, '"').replace(/&amp;/g, "&"));
  for (const [k, v] of Object.entries(fields)) fd.append(k, v);
  const r = await fetch(BASE + path, { method: "POST", body: fd, redirect: "manual", headers: { cookie: cookie() } });
  absorb(r);
  const text = await r.text();
  return { status: r.status, text, loc: r.headers.get("location") };
}
const S = `art${Date.now().toString().slice(-7)}`;
const email = `${S}@example.com`;
let r = await formPost("/cadastro", { displayName: "Banda Teste", username: S, email, password: "senha1234", terms: "on", artist: "1" });
console.log("1) cadastro artist:", r.status, r.loc, /error/i.test(r.text) ? r.text.match(/.{0,120}erro.{0,120}/i)?.[0] : "(sem erro visível)");
r = await get("/estudio");
const t = await r.text();
console.log("2) /estudio:", r.status, t.includes("análise") ? "mostra: pedido em análise" : "", t.includes("Enviar nova faixa") ? "tem form de envio" : "", t.includes("não está vinculada") ? "sem vínculo de artista" : "");
console.log("3) sessão:", (await get("/configuracoes")).status, "cookie sid?", !!jar.sid);
