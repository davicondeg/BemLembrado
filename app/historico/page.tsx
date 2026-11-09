import { AppShell } from "@/components/app-shell";
import { requireUser } from "@/lib/auth/require-user";
import { isMockMode, mockHistory, mockPeople } from "@/lib/mock/data";
import { reminderPerson, type ReminderPerson } from "@/lib/reminders/person-relation";

type ReminderRecord = { id: string; title: string; confirmation_required: boolean; assisted_people: ReminderPerson | ReminderPerson[] | null };
type Occurrence = { id: string; scheduled_for: string; status: string; attempts: number; sent_at: string | null; confirmed_at: string | null; finished_at: string | null; last_error: string | null; reminders: ReminderRecord | ReminderRecord[] | null };
type Filter = "todos" | "atencao" | "confirmados";
const zone = "America/Sao_Paulo";
const dateTime = new Intl.DateTimeFormat("pt-BR", { timeZone: zone, dateStyle: "short", timeStyle: "short" });
const shortDate = new Intl.DateTimeFormat("pt-BR", { timeZone: zone, day: "2-digit", month: "2-digit" });
const attentionStatuses = new Set(["failed", "not_done"]);

function reminderOf(value: Occurrence["reminders"]) { return Array.isArray(value) ? value[0] || null : value; }
function readableFailure(error: string | null) {
  const value = error?.toLowerCase() || "";
  if (value.includes("disconnect") || value.includes("connection") || value.includes("econn")) return "O WhatsApp estava desconectado.";
  if (value.includes("timeout") || value.includes("timed out")) return "O serviço demorou para responder.";
  if (value.includes("phone") || value.includes("recipient") || value.includes("number")) return "Confira o número de WhatsApp.";
  return "Confira a conexão do WhatsApp e tente novamente.";
}
function statusView(item: Occurrence) {
  if (item.status === "confirmed") return { label: "Confirmado", tone: "success", explanation: "A pessoa respondeu ao lembrete." };
  if (item.status === "not_done") return { label: "Sem resposta", tone: "attention", explanation: "Não recebemos resposta. Isso não confirma se a tarefa foi realizada." };
  if (item.status === "failed") return { label: "Não enviado", tone: "attention", explanation: readableFailure(item.last_error) };
  if (item.status === "cancelled") return { label: "Cancelado", tone: "neutral", explanation: "O envio foi interrompido." };
  if (item.status === "queued") return { label: "Preparando envio", tone: "waiting", explanation: "A mensagem está na fila de envio." };
  return { label: "Enviado", tone: "waiting", explanation: "A mensagem foi enviada; ainda não há confirmação." };
}
function weekStart(date: Date) { const value = new Date(date); const day = value.getDay(); value.setHours(0, 0, 0, 0); value.setDate(value.getDate() - ((day + 6) % 7)); return value; }

export default async function History({ searchParams }: { searchParams: Promise<{ filtro?: string; pessoa?: string; periodo?: string }> }) {
  const { user, supabase } = await requireUser(); const mock = await isMockMode(); const params = await searchParams;
  const filter: Filter = ["atencao", "confirmados"].includes(params.filtro || "") ? params.filtro as Filter : "todos";
  const period = [7, 30, 90].includes(Number(params.periodo)) ? Number(params.periodo) : 30;
  const now = new Date();
  const since = new Date(now.getTime() - period * 86_400_000).toISOString();
  const { data: storedPeople } = mock ? { data: null } : await supabase.from("assisted_people").select("id,full_name").is("archived_at", null).order("full_name");
  const people = mock ? mockPeople.filter((person) => person.active).map(({ id, full_name }) => ({ id, full_name })) : storedPeople || [];
  let occurrences: Occurrence[];
  if (mock) {
    occurrences = mockHistory.map((item) => ({ id: item.id, scheduled_for: item.scheduled_for, status: item.status === "confirmed" ? "confirmed" : item.status === "failed" ? "failed" : item.status === "cancelled" ? "cancelled" : item.status === "sent" ? "sent" : "not_done", attempts: item.status === "not_done" ? 2 : 1, sent_at: item.sent_at, confirmed_at: item.status === "confirmed" ? item.sent_at : null, finished_at: item.sent_at, last_error: item.last_error, reminders: { id: item.id, title: item.title, confirmation_required: true, assisted_people: item.assisted_people as ReminderPerson[] } }));
  } else {
    let request = supabase.from("reminder_occurrences").select("id,scheduled_for,status,attempts,sent_at,confirmed_at,finished_at,last_error,reminders!inner(id,title,confirmation_required,assisted_people(id,full_name))").gte("scheduled_for", since).order("scheduled_for", { ascending: false }).limit(500);
    if (params.pessoa) request = request.eq("reminders.assisted_person_id", params.pessoa);
    occurrences = ((await request).data || []) as Occurrence[];
  }
  const visible = occurrences.filter((item) => filter === "todos" || (filter === "atencao" ? attentionStatuses.has(item.status) : item.status === "confirmed"));
  const confirmed = occurrences.filter((item) => item.status === "confirmed").length;
  const noResponse = occurrences.filter((item) => item.status === "not_done").length;
  const measurable = confirmed + noResponse;
  const confirmationRate = measurable ? Math.round(confirmed / measurable * 100) : 0;
  const currentWeek = weekStart(now);
  const weekCount = Math.ceil(period / 7);
  const weeks = Array.from({ length: weekCount }, (_, index) => {
    const start = new Date(currentWeek); start.setDate(start.getDate() - (weekCount - 1 - index) * 7);
    const end = new Date(start); end.setDate(end.getDate() + 7);
    const items = occurrences.filter((item) => { const date = new Date(item.scheduled_for); return date >= start && date < end; });
    return { label: `${shortDate.format(start)}–${shortDate.format(new Date(end.getTime() - 1))}`, confirmed: items.filter((item) => item.status === "confirmed").length, noResponse: items.filter((item) => item.status === "not_done").length, failed: items.filter((item) => item.status === "failed").length };
  });
  const maxWeekTotal = Math.max(1, ...weeks.map((week) => week.confirmed + week.noResponse + week.failed));
  const queryHref = (changes: Record<string, string>) => { const query = new URLSearchParams({ filtro: filter, periodo: String(period), pessoa: params.pessoa || "", ...changes }); for (const [key, value] of [...query]) if (!value || value === "todos") query.delete(key); const text = query.toString(); return text ? `/historico?${text}` : "/historico"; };

  return <AppShell email={user.email || "Responsável"} active="/historico">
    <header className="sectionHeader historyHeader"><div><p className="eyebrow">ACOMPANHAMENTO</p><h1>Como estão os lembretes</h1><p>Veja as confirmações registradas ao longo do tempo e identifique quando pode ser necessário entrar em contato.</p></div></header>
    <section className="historySummary" aria-label="Resumo do período"><article><span className="historySummaryIcon success">✓</span><div><strong>{confirmed}</strong><p>Confirmações recebidas</p></div></article><article><span className="historySummaryIcon attention">!</span><div><strong>{noResponse}</strong><p>Sem resposta</p></div></article><article><span className="historySummaryIcon total">%</span><div><strong>{confirmationRate}%</strong><p>Taxa de confirmação</p></div></article></section>
    <section className="historyControls card"><div className="historyFilters"><a className={filter === "todos" ? "active" : ""} href={queryHref({ filtro: "" })}>Tudo</a><a className={filter === "confirmados" ? "active" : ""} href={queryHref({ filtro: "confirmados" })}>Confirmados</a><a className={filter === "atencao" ? "active" : ""} href={queryHref({ filtro: "atencao" })}>Precisam de atenção</a></div><form><label>Pessoa assistida<select name="pessoa" defaultValue={params.pessoa || ""}><option value="">Todas</option>{people.map((person) => <option key={person.id} value={person.id}>{person.full_name}</option>)}</select></label><label>Período<select name="periodo" defaultValue={String(period)}><option value="7">Últimos 7 dias</option><option value="30">Últimos 30 dias</option><option value="90">Últimos 90 dias</option></select></label><input type="hidden" name="filtro" value={filter === "todos" ? "" : filter}/><button>Aplicar</button></form></section>
    <section className="card historyChart"><header><div><p className="eyebrow">EVOLUÇÃO SEMANAL</p><h2>Respostas ao longo do tempo</h2></div><div className="chartLegend"><span className="confirmed">Confirmados</span><span className="noResponse">Sem resposta</span><span className="failed">Não enviados</span></div></header><div className="weeklyBars">{weeks.map((week) => <div className="weekRow" key={week.label}><span>{week.label}</span><div className="barTrack" aria-label={`${week.confirmed} confirmados, ${week.noResponse} sem resposta, ${week.failed} não enviados`}><i className="confirmed" style={{ width: `${week.confirmed / maxWeekTotal * 100}%` }}/><i className="noResponse" style={{ width: `${week.noResponse / maxWeekTotal * 100}%` }}/><i className="failed" style={{ width: `${week.failed / maxWeekTotal * 100}%` }}/></div><strong>{week.confirmed + week.noResponse + week.failed}</strong></div>)}</div><p className="chartHelp">O gráfico mostra respostas registradas, não comprova que um medicamento foi tomado.</p></section>
    <section className="card occurrenceTable"><header><div><p className="eyebrow">REGISTRO DETALHADO</p><h2>Cada lembrete do período</h2></div><span>{visible.length} registro(s)</span></header>{!visible.length ? <div className="emptyState"><strong>Nenhum registro encontrado</strong><p>Altere os filtros ou aguarde os próximos lembretes.</p></div> : <div className="occurrenceRows">{visible.map((item) => { const reminder = reminderOf(item.reminders); const person = reminderPerson(reminder?.assisted_people); const status = statusView(item); return <article key={item.id}><div><strong>{reminder?.title || "Lembrete"}</strong><span>{person?.full_name || "Pessoa assistida"}</span></div><time>{dateTime.format(new Date(item.scheduled_for))}</time><div className="attemptCount"><strong>{item.attempts}</strong><span>{item.attempts === 1 ? "tentativa" : "tentativas"}</span></div><div className="occurrenceResult"><span className={`historyStatus ${status.tone}`}>{status.label}</span><small>{status.explanation}</small></div></article>; })}</div>}</section>
    <p className="historySafetyNote"><strong>Importante:</strong> “confirmado” significa que uma resposta foi recebida pelo WhatsApp. “Sem resposta” não significa que o medicamento deixou de ser tomado.</p>
  </AppShell>;
}
