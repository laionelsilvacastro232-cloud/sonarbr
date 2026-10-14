import fs from "node:fs";
const BASE = process.env.BASE || "http://127.0.0.1:3100";
let jar = {};
const cookie = () => Object.entries(jar).map(([k, v]) => `${k}=${v}`).join("; ");
const absorb = (res) => { for (const c of res.headers.getSetCookie?.() ?? []) { const [kv] = c.split(";"); const i = kv.indexOf("="); jar[kv.slice(0, i)] = kv.slice(i + 1); if (/Max-Age=0|expires=Thu, 01 Jan 1970/i.test(c)) delete jar[kv.slice(0, i)]; } };
const get = async (p, opts = {}) => { const r = await fetch(BASE + p, { redirect: "manual", headers: { cookie: cookie() }, ...opts }); absorb(r); return r; };
const results = [];
const ok = (name, cond, extra = "") => { results.push([cond ? "PASS" : "FAIL", name, extra]); };

// mapa de ações
const man = JSON.parse(fs.readFileSync(".next/server/server-reference-manifest.json", "utf8"));
const ids = {};
for (const [id, v] of Object.entries(man.node ?? {})) ids[v.exportedName ?? v.name] = id;
async function act(name, args) {
  const r = await fetch(BASE + "/", { method: "POST", redirect: "manual", headers: { cookie: cookie(), "Next-Action": ids[name], "Content-Type": "text/plain;charset=UTF-8", Accept: "text/x-component" }, body: JSON.stringify(args) });
  absorb(r);
  return r.text();
}
async function actForm(name, fields) {
  const fd = new FormData();
  fd.append("0", JSON.stringify(["$undefined", "$K1"]));
  for (const [k, v] of Object.entries(fields)) fd.append("1_" + k, v);
  const r = await fetch(BASE + "/", { method: "POST", body: fd, redirect: "manual", headers: { cookie: cookie(), "Next-Action": ids[name], Accept: "text/x-component" } });
  absorb(r);
  const text = await r.text();
  return { status: r.status, redirected: !!r.headers.get("x-action-redirect"), text: async () => text };
}
async function formPost(path, fields) {
  const html = await (await get(path)).text();
  const fd = new FormData();
  for (const m of html.matchAll(/<input type="hidden" name="(\$ACTION[^"]*)"(?: value="([^"]*)")?/g)) fd.append(m[1], (m[2] ?? "").replace(/&quot;/g, '"').replace(/&amp;/g, "&"));
  for (const [k, v] of Object.entries(fields)) fd.append(k, v);
  const r = await fetch(BASE + path, { method: "POST", body: fd, redirect: "manual", headers: { cookie: cookie() } });
  absorb(r);
  return r;
}

let r = await get("/");
const home = await r.text();
ok("Home (visitante) responde 200 e hero", r.status === 200 && home.includes("Entrar"), String(r.status));
ok("Home lista lançamentos/seções do banco", /Lançamentos|Em alta/.test(home));
r = await get("/manifest.webmanifest"); ok("Manifest PWA", r.status === 200 && (await r.json()).display === "standalone");
r = await get("/icons/192"); ok("Ícone PWA 192", r.status === 200 && r.headers.get("content-type") === "image/png");
r = await get("/sw.js"); ok("Service worker", r.status === 200);
r = await get("/admin"); ok("Admin sem login redireciona", r.status >= 300 && r.status < 400, r.headers.get("location"));
r = await get("/biblioteca"); ok("Biblioteca sem login redireciona", r.status >= 300 && r.status < 400);
r = await get("/api/suggest?q=dja"); const sug = await r.json(); ok("Sugestões de busca (dados reais)", r.status === 200 && sug.tracks.length > 0, JSON.stringify(sug.tracks[0]));
r = await get("/api/suggest?q=zzzzqqqq"); const sug2 = await r.json(); ok("Busca sem resultados", Object.values(sug2).every((a) => a.length === 0));
r = await get("/buscar?q=song"); ok("Página de busca", (await r.text()).includes("Song"));

// cadastro
const email = `teste${Date.now()}@example.com`;
r = await formPost("/cadastro", { displayName: "Usuário Teste", username: "teste_" + Date.now().toString().slice(-6), email, password: "abc", terms: "on" });
let t = await r.text(); ok("Cadastro rejeita senha fraca", !jar.sid && /senha/i.test(t));
r = await formPost("/cadastro", { displayName: "Usuário Teste", username: "teste_" + Date.now().toString().slice(-6), email, password: "senha1234", terms: "on" });
ok("Cadastro cria conta e sessão", r.status === 303 && !!jar.sid, String(r.status));
r = await get("/"); t = await r.text(); ok("Home logada", t.includes("Bom") || t.includes("Boa"));
r = await get("/configuracoes"); ok("Configurações logado", r.status === 200);
r = await get("/admin"); const isAdmin = r.status === 200; ok("Primeiro usuário é admin e acessa /admin", isAdmin, String(r.status));
for (const p of ["/admin/conteudo", "/admin/usuarios", "/admin/denuncias", "/admin/home", "/admin/configuracoes", "/admin/auditoria", "/admin/conteudo?aba=importar"]) { r = await get(p); ok("Admin " + p, r.status === 200, String(r.status)); }

// IDs reais
const trackId = sug.tracks[0].id;
const like = await act("toggleLike", [trackId]); ok("Curtir faixa (server action)", like.includes('"liked":true'), like.slice(0, 120));
const like2 = await act("toggleLike", [trackId]); ok("Descurtir faixa", like2.includes('"liked":false'));
await act("toggleLike", [trackId]);
r = await get("/biblioteca?aba=curtidas"); t = await r.text(); ok("Curtida persiste na biblioteca", t.includes(sug.tracks[0].title));
const pl = await act("createPlaylist", ["Minha playlist de teste", trackId]); const plId = /"id":"([0-9a-f-]{36})"/.exec(pl)?.[1]; ok("Criar playlist com faixa", !!plId, pl.slice(0, 160));
r = await get(`/playlist/${plId}`); t = await r.text(); ok("Playlist abre para o dono", r.status === 200 && t.includes("Minha playlist de teste"));
const add = await act("addToPlaylist", [plId, sug.tracks[1]?.id ?? trackId]); ok("Adicionar faixa à playlist", add.includes('"ok":true'), add.slice(0, 100));
const rec = await act("recordPlay", [trackId, 31]); ok("Registrar reprodução real (>=10s)", rec.includes('"ok":true'));
r = await get("/historico"); t = await r.text(); ok("Histórico mostra reprodução registrada", t.includes(sug.tracks[0].title));
const rec2 = await act("recordPlay", [trackId, 3]); void rec2;
const hist = await act("recordPlay", [trackId, 2]); void hist;
// privacidade: playlist privada não visível a visitante
const anon = await fetch(`${BASE}/playlist/${plId}`); ok("Playlist privada: 404 para visitante", anon.status === 404, String(anon.status));
// follow artista
const artistId = sug.artists[0]?.id; if (artistId) { const f = await act("toggleFollowArtist", [artistId]); ok("Seguir artista", f.includes('"following":true')); }
r = await get(`/artista/${artistId}`); ok("Página do artista", r.status === 200);
r = await get(`/album/${sug.albums[0]?.id}`); ok("Página do álbum", r.status === 200);
r = await get(`/musica/${trackId}`); ok("Página da música", r.status === 200);
// admin actions
const chk = await act("checkTrack", [trackId]); ok("Admin: verificar fonte de áudio", /Fonte de áudio OK|Fonte com falha/.test(chk), chk.slice(0, 160));
// logout
await act("logoutAction", []); ok("Logout encerra sessão", !jar.sid);
// não-admin
jar = {};
const email2 = `user${Date.now()}@example.com`;
await formPost("/cadastro", { displayName: "Comum", username: "comum_" + Date.now().toString().slice(-6), email: email2, password: "senha1234", terms: "on" });
r = await get("/admin"); ok("Usuário comum bloqueado no /admin", r.status >= 300 && r.status < 400, r.headers.get("location"));
const adm = await act("saveSettings", [null, {}]); ok("Server action admin negada a não-admin", !adm.includes("Configurações salvas"), adm.slice(0, 80));
const sus = await act("suspendUser", ["00000000-0000-0000-0000-000000000000", "x"]); ok("Suspender usuário negado a não-admin", /Acesso negado|error/i.test(sus) || !sus.includes("Conta suspensa"), sus.slice(0, 120));
r = await get(`/playlist/${plId}`); ok("Outro usuário não acessa playlist privada", r.status === 404, String(r.status));
// login errado
jar = {};
r = await formPost("/entrar", { email: email2, password: "errada123" }); t = await r.text(); ok("Login com senha errada falha", !jar.sid && t.includes("incorretos"));
r = await formPost("/entrar", { email: email2, password: "senha1234" }); ok("Login correto", r.status === 303 && !!jar.sid);
// áudio real
const audio = await fetch("https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3", { headers: { Range: "bytes=0-1023" } }); ok("Fonte de áudio SoundHelix responde", audio.status === 206 || audio.status === 200, `${audio.status} ${audio.headers.get("content-type")}`);
console.log(results.map((x) => x.join(" | ")).join("\n"));
console.log("\nRESUMO:", results.filter((x) => x[0] === "PASS").length, "passaram,", results.filter((x) => x[0] === "FAIL").length, "falharam");
