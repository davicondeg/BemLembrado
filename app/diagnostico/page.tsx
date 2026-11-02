import { AppShell } from "@/components/app-shell";
import { requireUser } from "@/lib/auth/require-user";
import { alertMessage, initialMessage, retryMessage } from "@/lib/reminders/messages";

export default async function Diagnostics() {
  const { user, supabase } = await requireUser();
  const [{ count: queued }, { count: failed }, { data: next }, { data: workers }] = await Promise.all([
    supabase.from("bot_outbox").select("id", { count: "exact", head: true }).in("status", ["queued","sending"]),
    supabase.from("bot_outbox").select("id", { count: "exact", head: true }).eq("status", "failed"),
    supabase.from("reminders").select("title,scheduled_for").eq("status", "scheduled").order("scheduled_for").limit(1),
    supabase.from("worker_heartbeats").select("worker_id,last_seen_at,last_cycle_ok,last_error").order("last_seen_at", { ascending: false }).limit(1),
  ]);
  const worker = workers?.[0]; const relayOnline = Boolean(worker?.last_cycle_ok);
  const checks = [
    ["Supabase", true, "Banco e autenticação disponíveis"],
    ["Backend administrativo", Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY), "Necessário para webhook e relay"],
    ["Evolution API", Boolean(process.env.EVOLUTION_API_KEY), "Será configurada quando o chip estiver disponível"],
    ["Relay", relayOnline, worker ? `Último sinal: ${new Intl.DateTimeFormat("pt-BR", { timeStyle: "medium", timeZone: "America/Sao_Paulo" }).format(new Date(worker.last_seen_at))}` : "Nenhum heartbeat recebido"],
  ] as const;
  return <AppShell email={user.email || "Responsável"} active="/diagnostico"><header className="sectionHeader"><div><p className="eyebrow">OPERAÇÃO</p><h1>Central de diagnóstico</h1><p>Visão rápida da infraestrutura, fila e mensagens do bot.</p></div></header><section className="statusGrid">{checks.map(([name, ok, detail]) => <article className="card statusCard" key={name}><span className={`healthDot ${ok ? "healthy" : "offline"}`}/><div><strong>{name}</strong><p>{detail}</p></div></article>)}</section><section className="stats"><article><span className="statIcon amber">◷</span><div><strong>{queued || 0}</strong><p>Na fila</p></div></article><article><span className="statIcon green">✓</span><div><strong>{worker?.last_cycle_ok ? "OK" : "—"}</strong><p>Último ciclo</p></div></article><article><span className="statIcon blue">↗</span><div><strong>{failed || 0}</strong><p>Falhas</p></div></article></section>
    <section className="card nextDispatch"><p className="eyebrow">PRÓXIMO ENVIO</p>{next?.[0] ? <><h2>{next[0].title}</h2><p>{new Intl.DateTimeFormat("pt-BR", { dateStyle: "full", timeStyle: "short", timeZone: "America/Sao_Paulo" }).format(new Date(next[0].scheduled_for))}</p></> : <p className="mutedText">Nenhum lembrete agendado.</p>}</section>
    <section className="previewSection"><div><p className="eyebrow">PRÉVIA</p><h2>Mensagens que serão enviadas</h2></div><div className="messagePreviews"><article className="phoneMessage"><span>Lembrete inicial</span><p>{initialMessage("Está na hora de tomar o medicamento da manhã.")}</p></article><article className="phoneMessage"><span>Nova tentativa</span><p>{retryMessage("Está na hora de tomar o medicamento da manhã.", 2, 3)}</p></article><article className="phoneMessage alertPreview"><span>Alerta ao responsável</span><p>{alertMessage("Dona Lúcia", "Medicamento da manhã", 3)}</p></article></div></section>
  </AppShell>;
}
