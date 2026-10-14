import fs from "node:fs";
import { execSync } from "node:child_process";
const BASE = process.env.BASE || "http://127.0.0.1:3207";
const man = JSON.parse(fs.readFileSync(".next/server/server-reference-manifest.json", "utf8"));
const ids = {}; for (const [id, v] of Object.entries(man.node)) ids[v.exportedName ?? v.name] = id;
const psql = (q) => { try { return execSync(`psql postgresql://postgres:postgres@127.0.0.1:5432/app_db -tAc "${q}"`).toString().trim(); } catch { return ""; } };

function mkJar() {
  let jar = {};
  return {
    cookie: () => Object.entries(jar).map(([k, v]) => `${k}=${v}`).join("; "),
    absorb: (res) => { for (const c of res.headers.getSetCookie?.() ?? []) { const [kv] = c.split(";"); const i = kv.indexOf("="); jar[kv.slice(0, i)] = kv.slice(i + 1); if (/Max-Age=0|expires=Thu, 01 Jan 1970/i.test(c)) delete jar[kv.slice(0, i)]; } },
    has: (k) => !!jar[k], clear: () => { jar = {}; },
  };
}
const get = async (b, p) => { const r = await fetch(BASE + p, { redirect: "manual", headers: { cookie: b.cookie() } }); b.absorb(r); return r; };
/** POST no formulário real que contém `marker` (campo id=...). */
async function formPost(b, path, fields, marker, files) {
  const html = await (await get(b, path)).text();
  const seg = html.split("<form").slice(1).find((f) => f.includes(marker) && f.includes("$ACTION"));
  if (!seg) return { status: -1, body: `FORM NÃO ENCONTRADO (${marker})` };
  const fd = new FormData();
  for (const m of seg.matchAll(/<input type="hidden" name="(\$ACTION[^"]*)"(?: value="([^"]*)")?/gs)) fd.append(m[1], (m[2] ?? "").replace(/&quot;/g, '"').replace(/&amp;/g, "&"));
  for (const [k, v] of Object.entries(fields)) fd.append(k, v);
  if (files) for (const [k, v] of Object.entries(files)) fd.append(k, v);
  const r = await fetch(BASE + path, { method: "POST", body: fd, redirect: "manual", headers: { cookie: b.cookie(), Origin: BASE } });
  b.absorb(r);
  return { status: r.status, loc: r.headers.get("location"), body: await r.text() };
}
const act = async (b, name, args) => {
  const r = await fetch(BASE + "/", { method: "POST", redirect: "manual", body: JSON.stringify(args), headers: { cookie: b.cookie(), "Next-Action": ids[name], "Content-Type": "text/plain;charset=UTF-8", Accept: "text/x-component", Origin: BASE } });
  b.absorb(r); return (await r.text()).split("\n").slice(1).join(" ");
};
const R = []; const ok = (n, c, e = "") => R.push([c ? "PASS" : "FAIL", n, String(e).slice(0, 110)]);

const S = `art${Date.now().toString().slice(-7)}`; const email = `${S}@example.com`;
const A = mkJar();

// A — cadastro
let r = await formPost(A, "/cadastro", { displayName: "Banda Teste", username: S, email, password: "senha1234", terms: "on", artist: "1" }, 'id="pw2"');
ok("A. Cadastro artista: conta criada, sessão ativa e leva ao estúdio", r.status === 303 && r.loc === "/estudio" && A.has("sid"), `${r.status} ${r.loc}`);
const uid = psql(`select id from users where username='${S}'`);
ok("A. Conta gravada com pedido artístico e senha em hash", !!uid && psql(`select artist_request from users where id='${uid}'`) === "t" && psql(`select password_hash like 'scrypt$%' from users where id='${uid}'`) === "t");
// B — pendente
let t = await (await get(A, "/estudio")).text();
ok("B. Pendente: status explicado, sem formulários de publicação", t.includes("pedido em análise") && !t.includes("Publicar música"));
// C — redirecionamentos
r = await get(A, "/cadastro"); ok("C. /cadastro autenticado redireciona", r.status >= 300 && r.status < 400);
r = await get(A, "/entrar"); ok("C. /entrar autenticado redireciona", r.status >= 300 && r.status < 400);
// E — persistência
r = await get(A, "/configuracoes"); ok("E. Sessão persiste ao navegar/recarregar", r.status === 200);
// admin aprova
const ADM = mkJar();
r = await formPost(ADM, "/entrar", { email: "laionelsilvacastro232@gmail.com", password: "35116265" }, 'id="pw"');
ok("Admin loga", r.status === 303 && ADM.has("sid"));
r = await act(ADM, "approveArtist", [uid]);
const aid = psql(`select artist_id from users where id='${uid}'`);
ok("Admin aprova artista (perfil criado e vinculado)", psql(`select role from users where id='${uid}'`) === "artist" && aid.length === 36, r);
// F — publicações
t = await (await get(A, "/estudio")).text();
ok("F. Aprovado vê painel com status, formulários e listas", t.includes("Artista aprovado") && t.includes("Publicar música") && t.includes("Publicar novidade") && t.includes("Suas faixas"));
r = await formPost(A, "/estudio", { title: "Meu lançamento", body: "Ouça já!", status: "published" }, 'id="pt"');
const pid = psql(`select id from artist_posts where title='Meu lançamento' and artist_id='${aid}'`);
ok("F. Novidade criada no banco pelo formulário", !!pid && /Publicação criada/.test(r.body), `${r.status}`);
r = await act(A, "studioSetPostStatus", [pid, "draft"]);
ok("F. Ocultar novidade (rascunho)", psql(`select status from artist_posts where id='${pid}'`) === "draft", r);
await act(A, "studioSetPostStatus", [pid, "published"]);
ok("F. Republicar novidade", psql(`select status from artist_posts where id='${pid}'`) === "published");
r = await formPost(A, `/estudio?post=${pid}`, { id: pid, title: "Meu lançamento (editado)", body: "Versão 2", status: "published" }, 'id="pt"');
ok("F. Editar novidade", psql(`select title from artist_posts where id='${pid}'`) === "Meu lançamento (editado)", r.status);
// faixa com upload real
r = await formPost(A, "/estudio", { title: "Faixa de Teste", genre: "Rock", rights: "on" }, 'id="sa"', { audio: new Blob([fs.readFileSync("/tmp/faixa.mp3")], { type: "audio/mpeg" }) });
const tid = psql(`select id from tracks where title='Faixa de Teste' and artist_id='${aid}'`);
ok("F. Upload de faixa grava no banco (status pendente)", !!tid && psql(`select status from tracks where id='${tid}'`) === "pending", r.status);
const audioUrl = psql(`select audio_url from tracks where id='${tid}'`);
const head = await fetch(BASE + audioUrl, { headers: { Range: "bytes=0-3" } });
ok("F. Áudio enviado é servido com Range (206)", head.status === 206 && (head.headers.get("content-type") ?? "").startsWith("audio/"), `${head.status} ${audioUrl}`);
r = await act(ADM, "setTrackStatus", [tid, "published"]);
ok("F. Admin aprova e publica a faixa", psql(`select status from tracks where id='${tid}'`) === "published", r);
r = await formPost(A, `/estudio?faixa=${tid}`, { id: tid, title: "Faixa de Teste (editada)", genre: "Rock", credits: "Prod: eu", licenseNote: "meus direitos", releaseDate: "2026-01-01" }, 'id="sa"');
ok("F. Artista edita a própria faixa", psql(`select title from tracks where id='${tid}'`) === "Faixa de Teste (editada)", r.status);
r = await act(A, "studioSetTrackStatus", [tid, "draft"]);
ok("F. Artista oculta a própria faixa", psql(`select status from tracks where id='${tid}'`) === "draft");
await act(A, "studioSetTrackStatus", [tid, "published"]);
ok("F. Artista republica a própria faixa", psql(`select status from tracks where id='${tid}'`) === "published");
// faixa só com link externo
r = await formPost(A, "/estudio", { title: "Link Externo", externalUrl: "https://example.com/faixa", rights: "on" }, 'id="su"');
const lid = psql(`select id from tracks where title='Link Externo' and artist_id='${aid}'`);
ok("F. Faixa só com link publica direto na fonte original", !!lid && psql(`select availability||'/'||status from tracks where id='${lid}'`) === "external_only/published", r.status);
// perfil artístico
r = await formPost(A, "/estudio", { name: "Banda Teste Oficial", bio: "Bio do artista" }, 'id="an"');
ok("F. Perfil artístico atualizado (nome e bio)", psql(`select bio from artists where id='${aid}'`) === "Bio do artista" && psql(`select name from artists where id='${aid}'`) === "Banda Teste Oficial");
// G — permissões
const C3 = mkJar();
r = await formPost(C3, "/cadastro", { displayName: "Comum", username: `com${S.slice(3)}`, email: `c${S}@e.com`, password: "senha1234", terms: "on" }, 'id="pw2"');
const uid3 = psql(`select id from users where username='com${S.slice(3)}'`);
ok("G. Usuário comum criado", r.status === 303 && !!uid3);
r = await act(C3, "studioCreateTrack", {});
ok("G. Comum não publica faixa", /apenas para contas de artista/i.test(r), r);
r = await act(C3, "studioDeleteTrack", [tid]);
ok("G. Comum não exclui faixa alheia", /Sem permissão/i.test(r), r);
r = await act(C3, "studioDeletePost", [pid]);
ok("G. Comum não exclui novidade alheia", /Sem permissão/i.test(r), r);
const S2 = `art2${S.slice(3)}`; const D = mkJar();
await formPost(D, "/cadastro", { displayName: "Outro Artista", username: S2, email: `${S2}@e.com`, password: "senha1234", terms: "on", artist: "1" }, 'id="pw2"');
const uid2 = psql(`select id from users where username='${S2}'`);
await act(ADM, "approveArtist", [uid2]);
ok("G. Segundo artista aprovado", psql(`select role from users where id='${uid2}'`) === "artist");
r = await act(D, "studioDeleteTrack", [tid]);
ok("G. Artista não exclui faixa de outro artista", /não pertence/i.test(r) && !!psql(`select id from tracks where id='${tid}'`), r);
r = await act(D, "studioSetTrackStatus", [tid, "draft"]);
ok("G. Artista não oculta faixa de outro artista", /não pertence/i.test(r) && psql(`select status from tracks where id='${tid}'`) === "published", r);
r = await act(D, "studioDeletePost", [pid]);
ok("G. Artista não exclui novidade de outro artista", /não pertence/i.test(r), r);
const aid2 = psql(`select artist_id from users where id='${uid2}'`);
r = await formPost(D, "/estudio", { name: "", bio: "" }, 'id="an"');
ok("G. Perfil exige nome artístico", /Informe o nome artístico/.test(r.body));
r = await formPost(D, "/estudio", { name: "Outro Artista", bio: "Bio do segundo" }, 'id="an"');
ok("G. Cada artista edita só o próprio perfil", psql(`select bio from artists where id='${aid2}'`) === "Bio do segundo" && psql(`select bio from artists where id='${aid}'`) === "Bio do artista");
const editAlheia = await (await get(D, `/estudio?faixa=${tid}`)).text();
ok("G. Abrir edição de faixa alheia não pré-carrega os dados dela", !editAlheia.includes('value="Faixa de Teste (editada)"') && !editAlheia.includes('value="Rock"'));
// D/H — login
r = await act(A, "logoutAction", []);
ok("D. Logout encerra a sessão", !A.has("sid"));
r = await formPost(A, "/entrar", { email, password: "senha1234" }, 'id="pw"');
ok("D. Login correto restaura sessão", r.status === 303 && A.has("sid"));
A.clear();
r = await formPost(A, "/entrar", { email, password: "errada99" }, 'id="pw"');
ok("H. Senha incorreta recusada com mensagem clara", /incorretos/.test(r.body) && !A.has("sid"));
r = await formPost(A, "/entrar", { email: "naoexiste@e.com", password: "senha1234" }, 'id="pw"');
ok("H. E-mail inexistente recusado", /incorretos/.test(r.body));
const C4 = mkJar();
r = await formPost(C4, "/cadastro", { displayName: "Dup", username: `dup${S.slice(3)}`, email, password: "senha1234", terms: "on" }, 'id="pw2"');
ok("H. E-mail já cadastrado recusado", /já cadastrado/.test(r.body));
r = await formPost(C4, "/cadastro", { displayName: "Sem Termos", username: `sem${S.slice(3)}`, email: `s${S}@e.com`, password: "senha1234" }, 'id="pw2"');
ok("H. Campos obrigatórios (termos) validados", /Termos de Uso/.test(r.body));
// E — dados preservados
r = await formPost(A, "/entrar", { email, password: "senha1234" }, 'id="pw"');
t = await (await get(A, "/estudio")).text();
ok("E. Dados preservados após relogin", t.includes("Faixa de Teste (editada)") && t.includes("Meu lançamento (editado)"));
// integração
const pubPage = await (await fetch(`${BASE}/artista/${aid}`)).text();
ok("F. Novidade aparece no perfil público do artista", pubPage.includes("Meu lançamento (editado)"));
const pubTrack = await fetch(`${BASE}/musica/${tid}`);
ok("F. Faixa publicada responde 200 e é buscável", pubTrack.status === 200);
const busq = await (await fetch(`${BASE}/api/suggest?q=Faixa+de+Teste`)).json();
ok("F. Faixa aparece na pesquisa global", busq.tracks.some((x) => x.title === "Faixa de Teste (editada)"));
const pend = await fetch(`${BASE}/musica/${psql(`select id from tracks where status='pending' limit 1`)}`);
ok("G. Faixa pendente não é pública", pend.status === 404, pend.status);
console.log(R.map((x) => x.join(" | ")).join("\n"));
console.log("\nRESUMO:", R.filter((x) => x[0] === "PASS").length, "passaram,", R.filter((x) => x[0] === "FAIL").length, "falharam");
