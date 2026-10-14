const BASE = "http://127.0.0.1:3302";
function mkJar() { let jar = {}; return { cookie: () => Object.entries(jar).map(([k, v]) => `${k}=${v}`).join("; "), absorb: (r) => { for (const c of r.headers.getSetCookie?.() ?? []) { const [kv] = c.split(";"); const i = kv.indexOf("="); jar[kv.slice(0, i)] = kv.slice(i + 1); } }, has: (k) => !!jar[k] }; }
const get = async (b, p) => { const r = await fetch(BASE + p, { redirect: "manual", headers: { cookie: b.cookie() } }); b.absorb(r); return r; };
async function post(b, path, fields) {
  const html = await (await get(b, path)).text();
  const fd = new FormData();
  for (const m of html.matchAll(/<input type="hidden" name="(\$ACTION[^"]*)"(?: value="([^"]*)")?/gs)) fd.append(m[1], (m[2] ?? "").replace(/&quot;/g, '"').replace(/&amp;/g, "&"));
  for (const [k, v] of Object.entries(fields)) fd.append(k, v);
  const r = await fetch(BASE + path, { method: "POST", body: fd, redirect: "manual", headers: { cookie: b.cookie(), Origin: BASE } });
  b.absorb(r);
  return { status: r.status, loc: r.headers.get("location"), body: await r.text() };
}
const R = []; const ok = (n, c, e = "") => R.push([c ? "PASS" : "FAIL", n, String(e).slice(0, 110)]);
const stamp = Date.now().toString().slice(-7);
// 1) nome livre com acento e espaço
let B = mkJar();
let r = await post(B, "/cadastro", { displayName: "Lionel Silva", username: `Lionel Silva ${stamp}`, email: `lionel${stamp}@teste.com`, password: "senha1234", terms: "on" });
ok("Cadastro com nome livre (espaço e maiúsculas)", r.status === 303 && B.has("sid"), `${r.status} ${r.loc}`);
// 2) repetido, mas com maiúsculas diferentes — deve recusar e manter os campos
const C = mkJar();
r = await post(C, "/cadastro", { displayName: "Outra Pessoa", username: `LIONEL SILVA ${stamp}`, email: `outra${stamp}@teste.com`, password: "senha1234", terms: "on" });
ok("Nome repetido (diferente só em maiúsculas) é recusado", /já está em uso/.test(r.body));
ok("Formulário mantém o que foi digitado ao dar erro", r.body.includes(`value="LIONEL SILVA ${stamp}"`) && r.body.includes(`value="Outra Pessoa"`) && r.body.includes(`value="outra${stamp}@teste.com"`));
// 3) nome com acento
const D = mkJar();
r = await post(D, "/cadastro", { displayName: "João", username: `João da banda ${stamp}`, email: `joao${stamp}@teste.com`, password: "senha1234", terms: "on" });
ok("Nome com acento e caractere especial é aceito", r.status === 303 && D.has("sid"), `${r.status}`);
// 4) e-mail repetido
const E = mkJar();
r = await post(E, "/cadastro", { displayName: "X", username: `x${stamp}`, email: `lionel${stamp}@teste.com`, password: "senha1234", terms: "on" });
ok("E-mail repetido recusado com mensagem clara", /já está em uso/.test(r.body));
// 5) vários cadastros seguidos não são mais bloqueados (antes: 8/hora)
let all = true; const jars = [];
for (let i = 0; i < 12; i++) { const j = mkJar(); const rr = await post(j, "/cadastro", { displayName: `Teste ${i}`, username: `teste${stamp}${i}`, email: `t${stamp}${i}@teste.com`, password: "senha1234", terms: "on" }); if (rr.status !== 303) { all = false; jars.push(`${i}:${(rr.body.match(/Muitos cadastros[^<]{0,40}/) || ["?"])[0]}`); } }
ok("12 cadastros seguidos passam (limite novo: 60/h)", all, jars.join(" | "));
// 6) senha fraca continua bloqueada
const F = mkJar();
r = await post(F, "/cadastro", { displayName: "Fraca", username: `fraca${stamp}`, email: `fraca${stamp}@teste.com`, password: "1234", terms: "on" });
ok("Senha fraca continua bloqueada (proteção mantida)", /8\+ caracteres/.test(r.body));
console.log(R.map((x) => x.join(" | ")).join("\n"));
console.log("RESUMO:", R.filter((x) => x[0] === "PASS").length, "passaram,", R.filter((x) => x[0] === "FAIL").length, "falharam");
// 7) perfil público com nome acentuado abre corretamente
const acc = `João da banda ${stamp}`;
const page = await fetch(`${BASE}/perfil/${encodeURIComponent(acc)}`);
ok("Perfil público com nome acentuado responde 200", page.status === 200, page.status);
const busca = await (await fetch(`${BASE}/api/suggest?q=João`)).json();
ok("Nome acentuado aparece na pesquisa", busca.users.some((u) => u.id === acc));
console.log(R.map((x) => x.join(" | ")).join("\n").split("\n").slice(-3).join("\n"));
