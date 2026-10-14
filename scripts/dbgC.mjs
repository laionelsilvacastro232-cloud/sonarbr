import fs from "node:fs";
import { execSync } from "node:child_process";
const BASE = "http://127.0.0.1:3403";
const man = JSON.parse(fs.readFileSync(".next/server/server-reference-manifest.json", "utf8"));
const ids = {}; for (const [id, v] of Object.entries(man.node)) ids[v.exportedName ?? v.name] = id;
const psql = (q) => { try { return execSync(`psql postgresql://postgres:postgres@127.0.0.1:5432/app_db -tAc "${q}"`).toString().trim(); } catch (e) { return "ERR:" + e.message.split("\n")[0]; } };
const SID = fs.readFileSync("/tmp/sid.txt", "utf8").trim();
const H = { cookie: `sid=${SID}`, Origin: BASE, Accept: "text/x-component" };
const uid = psql(`select id from users where username like 'sess%' order by created_at desc limit 1`);
console.log("uid:", uid.slice(0, 8));
// create ticket via server action (FormData, single arg)
async function act(name, fields) {
  const fd = new FormData();
  fd.append("0", JSON.stringify(["$K1"]));
  for (const [k, v] of Object.entries(fields)) fd.append("1_" + k, v);
  const r = await fetch(BASE + "/", { method: "POST", body: fd, headers: { ...H, "Next-Action": ids[name] } });
  return (await r.text()).split("\n").slice(1).join(" ").slice(0, 90);
}
console.log("criar:", await act("createSupportTicket", { subject: "Teste upload", body: "Não consigo enviar minha música, dá erro no upload do arquivo." }));
const tid = psql(`select id from support_tickets order by created_at desc limit 1`);
console.log("ticket:", tid === "ERR" ? tid : tid.slice(0, 8), "| user:", psql(`select user_id::text from support_tickets where id='${tid}'`).slice(0, 8));
// admin reply
const ADM = psql(`select id from users where role='admin' limit 1`);
console.log("reply:", await act("supportReply", { ticketId: tid, body: "Olá! Envie o arquivo em MP3 até 40 MB." }));
console.log("mensagens:", psql(`select count(*) from support_messages where ticket_id='${tid}'`), "| de suporte:", psql(`select count(*) from support_messages where ticket_id='${tid}' and from_support=true`));
console.log("notificação:", psql(`select count(*) from notifications where kind='support'`));
void uid; void ADM;
