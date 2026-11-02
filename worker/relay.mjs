import { hostname } from "node:os";

const config = {
  appUrl: process.env.APP_BASE_URL || "http://localhost:3000",
  evolutionUrl: process.env.EVOLUTION_BASE_URL || "http://127.0.0.1:8080",
  evolutionKey: process.env.EVOLUTION_API_KEY,
  relaySecret: process.env.RELAY_SECRET,
  jobsSecret: process.env.JOBS_SECRET,
  interval: Number(process.env.RELAY_POLL_INTERVAL_MS || 5000),
  workerId: `${hostname()}-${process.pid}`,
};

for (const [name, value] of Object.entries({ EVOLUTION_API_KEY: config.evolutionKey, RELAY_SECRET: config.relaySecret, JOBS_SECRET: config.jobsSecret })) {
  if (!value) throw new Error(`Variável obrigatória ausente: ${name}`);
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function request(path, options = {}) {
  const response = await fetch(`${config.appUrl}${path}`, options);
  if (!response.ok) throw new Error(`${path}: HTTP ${response.status} ${await response.text()}`);
  return response.json();
}

async function dispatchDue() {
  return request("/api/jobs/dispatch-due", { method: "POST", headers: { authorization: `Bearer ${config.jobsSecret}` } });
}

async function heartbeat(ok = true, error) {
  return request("/api/relay/heartbeat", { method: "POST", headers: { authorization: `Bearer ${config.relaySecret}`, "content-type": "application/json" }, body: JSON.stringify({ workerId: config.workerId, ok, error }) });
}

async function claim() {
  return request("/api/relay/claim", { headers: { authorization: `Bearer ${config.relaySecret}`, "x-worker-id": config.workerId } });
}

async function complete(id, success, error, providerMessageId) {
  return request("/api/relay/complete", {
    method: "POST",
    headers: { authorization: `Bearer ${config.relaySecret}`, "content-type": "application/json" },
    body: JSON.stringify({ id, success, error, providerMessageId }),
  });
}

async function send(item) {
  const response = await fetch(`${config.evolutionUrl}/message/sendText/${encodeURIComponent(item.instance_name)}`, {
    method: "POST",
    headers: { apikey: config.evolutionKey, "content-type": "application/json" },
    body: JSON.stringify({ number: item.recipient, text: item.message_text }),
  });
  const body = await response.text();
  if (!response.ok) throw new Error(`Evolution HTTP ${response.status}: ${body.slice(0, 500)}`);
  let parsed = {};
  try { parsed = JSON.parse(body); } catch {}
  return parsed?.key?.id || parsed?.messageId || null;
}

let stopping = false;
process.on("SIGINT", () => { stopping = true; });
process.on("SIGTERM", () => { stopping = true; });

console.log(`[relay] iniciado como ${config.workerId}`);
while (!stopping) {
  try {
    await dispatchDue();
    await heartbeat(true);
    const { item } = await claim();
    if (!item) { await sleep(config.interval); continue; }
    try {
      const providerMessageId = await send(item);
      await complete(item.id, true, undefined, providerMessageId);
      console.log(`[relay] mensagem ${item.id} enviada`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await complete(item.id, false, message);
      console.error(`[relay] falha na mensagem ${item.id}: ${message}`);
    }
  } catch (error) {
    console.error(`[relay] ciclo falhou: ${error instanceof Error ? error.message : error}`);
    try { await heartbeat(false, error instanceof Error ? error.message : String(error)); } catch {}
    await sleep(config.interval);
  }
}
console.log("[relay] encerrado");
