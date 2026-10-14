const BASE = "http://127.0.0.1:3401";
let jar = {};
const cookie = () => Object.entries(jar).map(([k, v]) => `${k}=${v}`).join("; ");
const absorb = (r) => { for (const c of r.headers.getSetCookie?.() ?? []) { const [kv] = c.split(";"); const i = kv.indexOf("="); jar[kv.slice(0, i)] = kv.slice(i + 1); } };
const get = async (p) => { const r = await fetch(BASE + p, { redirect: "manual", headers: { cookie: cookie() } }); absorb(r); return r; };
async function formPost(path, fields, marker) {
  const html = await (await get(path)).text();
  const forms = html.split("<form").slice(1);
  console.log("forms:", forms.length, forms.map((f) => (f.match(/id="([a-z]+)"/) || ["?"])[0]).join(","));
  const seg = forms.find((f) => f.includes(marker) && f.includes("$ACTION"));
  if (!seg) { console.log("SEM FORM para", marker); return { status: -1, body: "" }; }
  console.log("hidden:", [...seg.matchAll(/name="(\$ACTION[^"]*)"/g)].map((m) => m[1]).join(" "));
  const fd = new FormData();
  for (const m of seg.matchAll(/<input type="hidden" name="(\$ACTION[^"]*)"(?: value="([^"]*)")?/gs)) fd.append(m[1], (m[2] ?? "").replace(/&quot;/g, '"').replace(/&amp;/g, "&"));
  for (const [k, v] of Object.entries(fields)) fd.append(k, v);
  const r = await fetch(BASE + path, { method: "POST", body: fd, redirect: "manual", headers: { cookie: cookie(), Origin: BASE } });
  absorb(r); return { status: r.status, body: await r.text() };
}
const st = Date.now().toString().slice(-6);
let r = await formPost("/cadastro", { displayName: "Dbg", username: `dbgsup${st}`, email: `d${st}@t.com`, password: "senha1234", terms: "on" }, 'id="pw2"');
console.log("cadastro:", r.status);
r = await formPost("/ajuda", { subject: "Assunto teste", body: "Mensagem de teste bem longa aqui." }, 'id="sub"');
console.log("ajuda post:", r.status, (r.body.match(/enviada ao suporte|Erro:[^<]{0,80}/) || ["?"])[0]);
