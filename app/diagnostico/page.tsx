import { AppShell } from "@/components/app-shell";
import { requireUser } from "@/lib/auth/require-user";
import { heartbeatStatus, readEvolutionStatus } from "@/lib/diagnostics/live-status";
import { alertMessage, initialMessage, retryMessage } from "@/lib/reminders/messages";
import { AutoRefresh } from "./auto-refresh";

export default async function Diagnostics() {
  const { user, supabase } = await requireUser();
  const [{ count: queued, error: queueError }, { count: failed, error: failedError }, { data: next, error: nextError }, { data: workers, error: workerError }, evolution] = await Promise.all([
    supabase.from("bot_outbox").select("id", { count: "exact", head: true }).in("status", ["queued", "sending"]),
    supabase.from("bot_outbox").select("id", { count: "exact", head: true }).eq("status", "failed"),
    supabase.from("reminders").select("title,scheduled_for").eq("status", "scheduled").order("scheduled_for").limit(1),
    supabase.from("worker_heartbeats").select("worker_id,last_seen_at,last_cycle_ok,last_error").order("last_seen_at", { ascending: false }).limit(1),
    readEvolutionStatus(),
  ]);

  const worker = workers?.[0];
  const heartbeat = heartbeatStatus(worker?.last_seen_at, worker?.last_cycle_ok);
  const relayOnline = heartbeat.online;
  const heartbeatSeconds = heartbeat.seconds;
  const supabaseOnline = !queueError && !failedError && !nextError && !workerError;
  const backendReady = Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY && process.env.RELAY_SECRET && process.env.JOBS_SECRET);
  const checks = [
    ["Supabase", supabaseOnline, supabaseOnline ? "Consulta ao banco concluída" : "Não foi possível consultar o banco"],
    ["Backend", backendReady, backendReady ? "Credenciais administrativas disponíveis" : "Configuração administrativa incompleta"],
    ["WhatsApp", evolution.evolutionOnline, evolution.evolutionDetail],
    ["Webhook", evolution.webhookOnline, evolution.webhookDetail],
    ["Relay", relayOnline, relayOnline ? `Sinal recebido há ${heartbeatSeconds}s` : worker ? "Heartbeat ausente ou desatualizado" : "Nenhum heartbeat recebido"],
  ] as const;

  return <AppShell email={user.email || "Responsável"} active="/diagnostico">
    <header className="sectionHeader"><div><p className="eyebrow">OPERAÇÃO EM TEMPO REAL</p><h1>Central de diagnóstico</h1><p>Verificações reais da infraestrutura, conexão do WhatsApp e processamento do bot.</p></div><AutoRefresh /></header>
    <section className="statusGrid liveStatusGrid">{checks.map(([name, ok, detail]) => <article className="card statusCard" key={name}><span className={`healthDot ${ok ? "healthy" : "offline"}`} /><div><strong>{name}</strong><p>{detail}</p></div></article>)}</section>
    <section className="stats"><article><span className="statIcon amber">◷</span><div><strong>{queued || 0}</strong><p>Mensagens na fila</p></div></article><article><span className="statIcon green">✓</span><div><strong>{relayOnline ? "Online" : "Offline"}</strong><p>Relay agora</p></div></article><article><span className="statIcon blue">↗</span><div><strong>{failed || 0}</strong><p>Falhas no histórico</p></div></article></section>
    {Boolean(failed) && <p className="diagnosticNote"><strong>Falhas no histórico não significam indisponibilidade atual.</strong> Elas permanecem registradas para auditoria. Use os indicadores acima para conferir o estado dos serviços agora.</p>}
    <section className="card nextDispatch"><p className="eyebrow">PRÓXIMO ENVIO</p>{next?.[0] ? <><h2>{next[0].title}</h2><p>{new Intl.DateTimeFormat("pt-BR", { dateStyle: "full", timeStyle: "short", timeZone: "America/Sao_Paulo" }).format(new Date(next[0].scheduled_for))}</p></> : <p className="mutedText">Nenhum lembrete agendado.</p>}</section>
    <section className="previewSection"><div><p className="eyebrow">PRÉVIA</p><h2>Mensagens que serão enviadas</h2></div><div className="messagePreviews"><article className="phoneMessage"><span>Lembrete inicial</span><p>{initialMessage("Está na hora de tomar o medicamento da manhã.")}</p></article><article className="phoneMessage"><span>Nova tentativa</span><p>{retryMessage("Está na hora de tomar o medicamento da manhã.", 2, 3)}</p></article><article className="phoneMessage alertPreview"><span>Alerta ao responsável</span><p>{alertMessage("Dona Lúcia", "Medicamento da manhã", 3)}</p></article></div></section>
  </AppShell>;
}
