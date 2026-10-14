import fs from "node:fs";
import { execSync } from "node:child_process";
const BASE = "http://127.0.0.1:3402";
const man = JSON.parse(fs.readFileSync(".next/server/server-reference-manifest.json", "utf8"));
const ids = {}; for (const [id, v] of Object.entries(man.node)) ids[v.exportedName ?? v.name] = id;
const psql = (q) => { try { return execSync(`psql postgresql://postgres:postgres@127.0.0.1:5432/app_db -tAc "${q}"`).toString().trim(); } catch { return ""; } };
function mkJar() { let jar = {}; return { cookie: () => Object.entries(jar).map(([k, v]) => `${k}=${v}`).join("; "), absorb: (r) => { for (const c of r.headers.getSetCookie?.() ?? []) { const [kv] = c.split(";"); const i = kv.indexOf("="); jar[kv.slice(0, i)] = kv.slice(i + 1); } }, has: (k) => !!jar[k], raw: () => jar.sid }; }
const get = async (b, p) => { const r = await fetch(BASE + p, { redirect: "manual", headers: { cookie: b.cookie() } }); b.absorb(r); return r; };
async function formPost(b, path, fields) {
  const html = await (await get(b, path)).text();
  const fd = new FormData();
  for (const m of html.matchAll(/<input type="hidden" name="(\$ACTION[^"]*)"(?: value="([^"]*)")?/gs)) fd.append(m[1], (m[2] ?? "").replace(/&quot;/g, '"').replace(/&amp;/g, "&"));
  for (const [k, v] of Object.entries(fields)) fd.append(k, v);
  const r = await fetch(BASE + path, { method: "POST", body: fd, redirect: "manual", headers: { cookie: b.cookie(), Origin: BASE } });
  b.absorb(r); return { status: r.status, loc: r.headers.get("location"), body: await r.text() };
}
const act = async (b, name, args) => { const r = await fetch(BASE + "/", { method: "POST", body: JSON.stringify(args), headers: { cookie: b.cookie(), "Next-Action": ids[name], "Content-Type": "text/plain;charset=UTF-8", Accept: "text/x-component", Origin: BASE } }); b.absorb(r); return (await r.text()).split("\n").slice(1).join(" "); };
const R = []; const ok = (n, c, e = "") => R.push([c ? "PASS" : "FAIL", n, String(e).slice(0, 110)]);
const st = Date.now().toString().slice(-7);

// usuário comum
const U = mkJar();
let r = await formPost(U, "/cadastro", { displayName: "Cliente Teste", username: `cliente${st}`, email: `cli${st}@t.com`, password: "senha1234", terms: "on" });
ok("Usuário criado e logado", r.status === 303 && U.has("sid"));
r = await get(U, "/ajuda"); let t = await r.text();
ok("Página /ajuda abre com FAQ e botão nova conversa", r.status === 200 && t.includes("Dúvidas frequentes") && t.includes("Nova conversa"));
// abre conversa via action
r = await formPost(U, "/ajuda", { subject: "Problema no upload", body: "Não consigo enviar minha música, aparece erro." });
ok("Conversa criada pelo usuário (formulário real)", /enviada ao suporte/i.test(r.body), String(r.status));
const tid = psql(`select id from support_tickets order by created_at desc limit 1`);
ok("Conversa gravada no banco", !!tid && psql(`select user_id is not null from support_tickets where id='${tid}'`) === "t");
t = await (await get(U, "/ajuda")).text();
ok("Conversa aparece na página do usuário", t.includes("Problema no upload"));
// admin responde
const A = mkJar();
await formPost(A, "/entrar", { email: "laionelsilvacastro232@gmail.com", password: "35116265" });
t = await (await get(A, "/admin/suporte")).text();
ok("Admin vê a conversa na caixa de suporte", t.includes("Problema no upload"));
r = await formPost(A, `/admin/suporte?t=${tid}`, { ticketId: tid, body: "Olá! Envie o arquivo em MP3 de até 40 MB que funcionamos." });
ok("Admin responde pelo formulário real", /Resposta enviada/i.test(r.body), String(r.status));
ok("Resposta gravada como suporte (sem nome pessoal)", psql(`select from_support from support_messages where ticket_id='${tid}' order by created_at desc limit 1`) === "t");
const notif = psql(`select count(*) from notifications where user_id=(select user_id from support_tickets where id='${tid}') and kind='support'`);
ok("Usuário recebe notificação da resposta", notif === "1", notif);
t = await (await get(U, "/ajuda")).text();
ok("Usuário vê a resposta na página", t.includes("Envie o arquivo em MP3"));
r = await act(U, "replySupportTicket", [tid, "Obrigado, vou tentar!"]);
ok("Usuário responde na conversa", /"ok"/.test(r), r.slice(0, 80));
const msgs = psql(`select count(*) from support_messages where ticket_id='${tid}'`);
ok("Conversa com 3 mensagens no banco", msgs === "3", msgs);
// usuário comum não acessa conversa alheia
const U2 = mkJar();
await formPost(U2, "/cadastro", { displayName: "Outro", username: `outro${st}`, email: `out${st}@t.com`, password: "senha1234", terms: "on" });
r = await act(U2, "replySupportTicket", [tid, "invasão"]);
ok("Usuário não responde conversa alheia", /não encontrada/i.test(r), r.slice(0, 80));
r = await act(U2, "supportReply", [null, { ticketId: tid, body: "invasão" }]);
ok("Usuário comum não responde como suporte", /Acesso negado/i.test(r));
// PERSISTÊNCIA DE SESSÃO APÓS REINÍCIO DO SERVIDOR (atualização)
const sid = U.raw();
console.log("SESSAO|" + sid);
console.log(R.map((x) => x.join(" | ")).join("\n"));
console.log("RESUMO:", R.filter((x) => x[0] === "PASS").length, "passaram,", R.filter((x) => x[0] === "FAIL").length, "falharam");
