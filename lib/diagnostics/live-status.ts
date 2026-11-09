type EvolutionState = {
  evolutionOnline: boolean;
  evolutionDetail: string;
  webhookOnline: boolean;
  webhookDetail: string;
};

export function heartbeatStatus(lastSeenAt?: string, lastCycleOk?: boolean, now = Date.now()) {
  const ageMs = lastSeenAt ? now - new Date(lastSeenAt).getTime() : Number.POSITIVE_INFINITY;
  return {
    online: Boolean(lastCycleOk && ageMs <= 30_000),
    seconds: Number.isFinite(ageMs) ? Math.max(0, Math.round(ageMs / 1000)) : null,
  };
}

export async function readEvolutionStatus(): Promise<EvolutionState> {
  const baseUrl = process.env.EVOLUTION_BASE_URL || "http://127.0.0.1:8080";
  const apiKey = process.env.EVOLUTION_API_KEY;
  const instance = process.env.EVOLUTION_INSTANCE || "bem-lembrado";
  if (!apiKey) return { evolutionOnline: false, evolutionDetail: "Chave não configurada", webhookOnline: false, webhookDetail: "Não foi possível consultar" };
  const options = { headers: { apikey: apiKey }, cache: "no-store" as const, signal: AbortSignal.timeout(3000) };
  const [connection, webhook] = await Promise.allSettled([
    fetch(`${baseUrl}/instance/connectionState/${encodeURIComponent(instance)}`, options).then(async (response) => ({ ok: response.ok, body: await response.json() })),
    fetch(`${baseUrl}/webhook/find/${encodeURIComponent(instance)}`, options).then(async (response) => ({ ok: response.ok, body: await response.json() })),
  ]);
  const connectionValue = connection.status === "fulfilled" ? connection.value : null;
  const state = connectionValue?.body?.instance?.state;
  const evolutionOnline = Boolean(connectionValue?.ok && state === "open");
  const webhookValue = webhook.status === "fulfilled" ? webhook.value : null;
  const events = Array.isArray(webhookValue?.body?.events) ? webhookValue.body.events : [];
  const webhookOnline = Boolean(webhookValue?.ok && webhookValue?.body?.enabled && events.includes("MESSAGES_UPSERT"));
  return {
    evolutionOnline,
    evolutionDetail: evolutionOnline ? "WhatsApp conectado" : state ? `Sessão ${state}` : "Evolution indisponível",
    webhookOnline,
    webhookDetail: webhookOnline ? "Recebimento de mensagens ativo" : "Webhook indisponível ou incompleto",
  };
}
