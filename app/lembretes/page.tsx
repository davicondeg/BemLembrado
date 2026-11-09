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

const labels: Record<string,string> = { scheduled: "Agendado", queued: "Preparando envio", sent: "Enviado", paused: "Pausado", cancelled: "Cancelado", failed: "Não foi possível enviar", confirmed: "Confirmado", not_done: "Não confirmado" };

function ReminderRow({ item, mock }: { item: ReminderItem; mock: boolean }) {
  const recurrence = recurrenceLabel(item.recurrence_rule);
  return <article className="tableRow reminderTableRow"><div><strong>{item.title}</strong><span>{item.message}</span></div><time>{new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" }).format(new Date(item.scheduled_for))}{recurrence ? ` · ${recurrence}` : ""}</time><span className={`badge ${item.status === "failed" || item.status === "not_done" ? "pending" : item.status === "sent" || item.status === "confirmed" ? "success" : "scheduled"}`}>{labels[item.status] || "Atualizado"}</span>{!mock ? <ReminderActions id={item.id} title={item.title} status={item.status} recurring={Boolean(item.recurrence_rule)} archived={Boolean(item.archived_at)} /> : <span/>}</article>;
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
  const grouped = people.map((person) => ({ person, reminders: data.filter((item) => reminderPerson(item.assisted_people)?.id === person.id) })).filter((group) => group.reminders.length || params.pessoa === group.person.id);
  const queryFor = (extra: Record<string,string>) => { const values = { ...params, ...extra }; const search = new URLSearchParams(); Object.entries(values).forEach(([key,value]) => value && search.set(key, value)); return `/lembretes?${search}`; };
  const listView = params.visualizacao === "lista" || Boolean(params.arquivados);
  return <AppShell email={user.email || "Responsável"} active="/lembretes"><header className="sectionHeader"><div><p className="eyebrow">AGENDA</p><h1>Lembretes</h1><p>Acompanhe a rotina organizada por pessoa assistida.</p></div><a className="primary buttonLink" href={params.pessoa ? `/lembretes/novo?pessoa=${params.pessoa}` : "/lembretes/novo"}>+ Novo lembrete</a></header>{params.sucesso && <p className="formMessage success">{params.sucesso}</p>}{params.erro && <p className="formMessage error">{params.erro}</p>}
    <section className="reminderToolbar"><form className="searchForm"><input type="hidden" name="pessoa" value={params.pessoa || ""}/><input type="hidden" name="status" value={params.status || ""}/><input name="busca" defaultValue={params.busca || ""} placeholder="Buscar lembrete..."/><button>Buscar</button></form><div className="viewToggle"><a className={!listView ? "active" : ""} href={queryFor({ visualizacao: "" })}>Por pessoa</a><a className={listView ? "active" : ""} href={queryFor({ visualizacao: "lista" })}>Cronológica</a></div></section>
    <nav className="personTabs"><a className={!params.pessoa ? "active" : ""} href={queryFor({ pessoa: "" })}>Todas</a>{people.map((person) => <a className={params.pessoa === person.id ? "active" : ""} key={person.id} href={queryFor({ pessoa: person.id })}>{person.full_name}</a>)}</nav>
    <nav className="filters"><a href={queryFor({ status: "", arquivados: "" })}>Todos</a><a href={queryFor({ status: "scheduled", arquivados: "" })}>Agendados</a><a href={queryFor({ status: "paused", arquivados: "" })}>Pausados</a><a href={queryFor({ status: "sent", arquivados: "" })}>Enviados</a><a href={queryFor({ status: "not_done", arquivados: "" })}>Não confirmados</a><a href={queryFor({ status: "failed", arquivados: "" })}>Não enviados</a><a href={queryFor({ status: "", arquivados: "1" })}>Arquivados</a></nav>
    {!data.length ? <section className="card emptyState"><strong>Nenhum lembrete encontrado</strong><p>Ajuste os filtros ou crie um novo lembrete.</p></section> : listView ? <section className="card tableCard"><div className="dataTable">{data.map((item) => <ReminderRow key={item.id} item={item} mock={mock}/>)}</div></section> : <div className="reminderGroups">{grouped.map(({ person, reminders }) => { const waiting = reminders.filter((item) => item.status === "sent").length; const scheduled = reminders.filter((item) => item.status === "scheduled").length; return <section className="card reminderGroup" key={person.id}><header><div><span className="personAvatar smallAvatar">{person.full_name.split(" ").slice(0,2).map((word) => word[0]).join("")}</span><div><h2>{person.full_name}</h2><p>{scheduled} agendado(s) · {waiting} aguardando confirmação</p></div></div><a href={`/lembretes/novo?pessoa=${person.id}`}>+ Adicionar</a></header><div className="dataTable">{reminders.map((item) => <ReminderRow key={item.id} item={item} mock={mock}/>)}</div></section>; })}</div>}
  </AppShell>;
}
