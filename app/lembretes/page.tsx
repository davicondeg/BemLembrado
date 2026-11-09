import { AppShell } from "@/components/app-shell";
import { requireUser } from "@/lib/auth/require-user";
import { isMockMode, mockPeople, mockReminders } from "@/lib/mock/data";
import { reminderPerson, type ReminderPerson } from "@/lib/reminders/person-relation";
import { recurrenceLabel } from "@/lib/reminders/recurrence";
import { ReminderActions } from "./reminder-actions";

type ReminderItem = {
  id: string; title: string; message: string; scheduled_for: string; status: string;
  recurrence_rule: string | null; archived_at: string | null; assisted_people: ReminderPerson | ReminderPerson[] | null;
};
type ReminderOccurrence = { reminder_id: string; status: string; confirmed_at: string | null; scheduled_for: string };

const labels: Record<string,string> = { scheduled: "Agendado", queued: "Preparando envio", sent: "Enviado", paused: "Pausado", cancelled: "Cancelado", failed: "Não foi possível enviar", confirmed: "Confirmado", not_done: "Não confirmado" };

function ReminderRow({ item, mock, lastOccurrence }: { item: ReminderItem; mock: boolean; lastOccurrence?: ReminderOccurrence }) {
  const recurrence = recurrenceLabel(item.recurrence_rule);
  const scheduled = new Date(item.scheduled_for);
  const date = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", timeZone: "America/Sao_Paulo" }).format(scheduled).replace(".", "");
  const time = new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" }).format(scheduled);
  const lastWasConfirmed = Boolean(item.recurrence_rule && lastOccurrence?.status === "confirmed");
  const badgeKind = lastWasConfirmed || item.status === "sent" || item.status === "confirmed" ? "success" : item.status === "failed" || item.status === "not_done" ? "pending" : "scheduled";
  const statusLabel = lastWasConfirmed ? "Confirmado" : labels[item.status] || "Atualizado";
  return <article className="reminderTableRow"><div className="reminderMain"><span className={`reminderStateDot ${badgeKind}`} aria-hidden="true"/><div><strong>{item.title}</strong><span>{item.message}</span></div></div><div className="reminderSchedule"><time dateTime={item.scheduled_for}><span>{lastWasConfirmed ? "Próximo" : date}</span><strong>{lastWasConfirmed ? `${date} · ${time}` : time}</strong></time><small>{lastWasConfirmed ? `Último envio confirmado${lastOccurrence?.confirmed_at ? ` às ${new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" }).format(new Date(lastOccurrence.confirmed_at))}` : ""}` : recurrence || "Não se repete"}</small></div><span className={`badge ${badgeKind}`}>{statusLabel}</span>{!mock ? <ReminderActions id={item.id} title={item.title} status={item.status} recurring={Boolean(item.recurrence_rule)} archived={Boolean(item.archived_at)} /> : <span/>}</article>;
}

export default async function Reminders({ searchParams }: { searchParams: Promise<{ sucesso?: string; erro?: string; status?: string; pessoa?: string; busca?: string; visualizacao?: string; arquivados?: string }> }) {
  const { user, supabase } = await requireUser(); const params = await searchParams; const mock = await isMockMode();
  const { data: storedPeople } = mock ? { data: null } : await supabase.from("assisted_people").select("id,full_name,active").is("archived_at", null).order("full_name");
  const people: { id: string; full_name: string; active: boolean }[] = (mock ? mockPeople.filter((person) => person.active).map(({ id, full_name, active }) => ({ id, full_name, active })) : storedPeople || []) as { id: string; full_name: string; active: boolean }[];
  let data: ReminderItem[];
  if (mock) {
    data = params.arquivados ? [] : mockReminders.filter((item) => (!params.status || item.status === params.status) && (!params.pessoa || reminderPerson(item.assisted_people)?.id === params.pessoa) && (!params.busca || `${item.title} ${item.message}`.toLowerCase().includes(params.busca.toLowerCase()))).map((item) => ({ ...item, archived_at: null })) as ReminderItem[];
  } else {
    let request = supabase.from("reminders").select("id,title,message,scheduled_for,status,recurrence_rule,archived_at,assisted_people(id,full_name)").order("scheduled_for", { ascending: true }).limit(200);
    request = params.arquivados ? request.not("archived_at", "is", null) : request.is("archived_at", null);
    if (params.status) request = request.eq("status", params.status);
    if (params.pessoa) request = request.eq("assisted_person_id", params.pessoa);
    if (params.busca) request = request.or(`title.ilike.%${params.busca}%,message.ilike.%${params.busca}%`);
    data = ((await request).data || []) as ReminderItem[];
  }
  const lastOccurrenceByReminder = new Map<string, ReminderOccurrence>();
  if (!mock && data.length) {
    const { data: occurrences } = await supabase.from("reminder_occurrences").select("reminder_id,status,confirmed_at,scheduled_for").in("reminder_id", data.map((item) => item.id)).order("scheduled_for", { ascending: false }).limit(500);
    for (const occurrence of (occurrences || []) as ReminderOccurrence[]) if (!lastOccurrenceByReminder.has(occurrence.reminder_id)) lastOccurrenceByReminder.set(occurrence.reminder_id, occurrence);
  }
  const grouped = people.map((person) => ({ person, reminders: data.filter((item) => reminderPerson(item.assisted_people)?.id === person.id) })).filter((group) => group.reminders.length || params.pessoa === group.person.id);
  const queryFor = (extra: Record<string,string>) => { const values = { ...params, ...extra }; const search = new URLSearchParams(); Object.entries(values).forEach(([key,value]) => value && search.set(key, value)); return `/lembretes?${search}`; };
  const listView = params.visualizacao === "lista" || Boolean(params.arquivados);
  const scheduledCount = data.filter((item) => item.status === "scheduled").length;
  const waitingCount = data.filter((item) => item.status === "sent").length;
  const attentionCount = data.filter((item) => item.status === "failed" || item.status === "not_done").length;
  return <AppShell email={user.email || "Responsável"} active="/lembretes"><header className="sectionHeader"><div><p className="eyebrow">AGENDA</p><h1>Lembretes</h1><p>Acompanhe a rotina organizada por pessoa assistida.</p></div><a className="primary buttonLink" href={params.pessoa ? `/lembretes/novo?pessoa=${params.pessoa}` : "/lembretes/novo"}>+ Novo lembrete</a></header>{params.sucesso && <p className="formMessage success">{params.sucesso}</p>}{params.erro && <p className="formMessage error">{params.erro}</p>}
    <section className="reminderOverview" aria-label="Resumo dos lembretes"><article><span className="overviewIcon scheduled" aria-hidden="true">◷</span><div><strong>{scheduledCount}</strong><p>Próximos agendamentos</p></div></article><article><span className="overviewIcon waiting" aria-hidden="true">…</span><div><strong>{waitingCount}</strong><p>Aguardando confirmação</p></div></article><article className={attentionCount ? "hasAttention" : ""}><span className="overviewIcon attention" aria-hidden="true">!</span><div><strong>{attentionCount}</strong><p>Precisam de atenção</p></div></article></section>
    <section className="card reminderControls"><div className="reminderToolbar"><form className="searchForm"><input type="hidden" name="pessoa" value={params.pessoa || ""}/><input type="hidden" name="status" value={params.status || ""}/><label className="searchField"><span aria-hidden="true">⌕</span><input name="busca" defaultValue={params.busca || ""} placeholder="Buscar por nome ou mensagem" aria-label="Buscar lembrete"/></label><button>Buscar</button></form><div className="viewToggle" aria-label="Organização da lista"><a className={!listView ? "active" : ""} href={queryFor({ visualizacao: "" })}>Por pessoa</a><a className={listView ? "active" : ""} href={queryFor({ visualizacao: "lista" })}>Por data</a></div></div>
    <div className="filterBlock"><span>Mostrar pessoa</span><nav className="personTabs"><a className={!params.pessoa ? "active" : ""} href={queryFor({ pessoa: "" })}>Todas</a>{people.map((person) => <a className={params.pessoa === person.id ? "active" : ""} key={person.id} href={queryFor({ pessoa: person.id })}>{person.full_name}</a>)}</nav></div>
    <div className="filterBlock"><span>Situação</span><nav className="filters"><a className={!params.status && !params.arquivados ? "active" : ""} href={queryFor({ status: "", arquivados: "" })}>Todos</a><a className={params.status === "scheduled" ? "active" : ""} href={queryFor({ status: "scheduled", arquivados: "" })}>Agendados</a><a className={params.status === "paused" ? "active" : ""} href={queryFor({ status: "paused", arquivados: "" })}>Pausados</a><a className={params.status === "sent" ? "active" : ""} href={queryFor({ status: "sent", arquivados: "" })}>Aguardando resposta</a><a className={params.status === "not_done" ? "active" : ""} href={queryFor({ status: "not_done", arquivados: "" })}>Não confirmados</a><a className={params.status === "failed" ? "active" : ""} href={queryFor({ status: "failed", arquivados: "" })}>Não enviados</a><a className={params.arquivados ? "active" : ""} href={queryFor({ status: "", arquivados: "1" })}>Arquivados</a></nav></div></section>
    {!data.length ? <section className="card emptyState"><strong>Nenhum lembrete encontrado</strong><p>Ajuste os filtros ou crie um novo lembrete.</p><a className="primary buttonLink" href="/lembretes/novo">Criar lembrete</a></section> : listView ? <section className="card tableCard"><div className="dataTable">{data.map((item) => <ReminderRow key={item.id} item={item} mock={mock} lastOccurrence={lastOccurrenceByReminder.get(item.id)}/>)}</div></section> : <div className="reminderGroups">{grouped.map(({ person, reminders }) => { const waiting = reminders.filter((item) => item.status === "sent").length; const scheduled = reminders.filter((item) => item.status === "scheduled").length; const attention = reminders.filter((item) => item.status === "failed" || item.status === "not_done").length; return <section className="card reminderGroup" key={person.id}><header><div><span className="personAvatar smallAvatar">{person.full_name.split(" ").slice(0,2).map((word) => word[0]).join("")}</span><div><h2>{person.full_name}</h2><p>{scheduled} agendado{scheduled === 1 ? "" : "s"} · {waiting} aguardando resposta{attention ? ` · ${attention} precisa${attention === 1 ? "" : "m"} de atenção` : ""}</p></div></div><a href={`/lembretes/novo?pessoa=${person.id}`}><span>+</span> Adicionar</a></header><div className="dataTable">{reminders.map((item) => <ReminderRow key={item.id} item={item} mock={mock} lastOccurrence={lastOccurrenceByReminder.get(item.id)}/>)}</div></section>; })}</div>}
  </AppShell>;
}
