import { AppShell } from "@/components/app-shell";
import { requireUser } from "@/lib/auth/require-user";
import { cancelReminder } from "./actions";
import { isMockMode, mockPeople, mockReminders } from "@/lib/mock/data";

type ReminderItem = {
  id: string; title: string; message: string; scheduled_for: string; status: string;
  recurrence_rule: string | null; assisted_people: { id: string; full_name: string }[];
};

const labels: Record<string,string> = { scheduled: "Agendado", queued: "Preparando envio", sent: "Enviado", cancelled: "Cancelado", failed: "Não foi possível enviar", confirmed: "Confirmado", not_done: "Não confirmado" };

function ReminderRow({ item, mock }: { item: ReminderItem; mock: boolean }) {
  return <article className="tableRow"><div><strong>{item.title}</strong><span>{item.message}</span></div><time>{new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" }).format(new Date(item.scheduled_for))}{item.recurrence_rule ? " · diário" : ""}</time><span className={`badge ${item.status === "failed" || item.status === "not_done" ? "pending" : item.status === "sent" || item.status === "confirmed" ? "success" : "scheduled"}`}>{labels[item.status] || "Atualizado"}</span>{item.status === "scheduled" && !mock ? <form action={cancelReminder}><input type="hidden" name="id" value={item.id}/><button className="textDanger">Cancelar</button></form> : <span/>}</article>;
}

export default async function Reminders({ searchParams }: { searchParams: Promise<{ sucesso?: string; status?: string; pessoa?: string; busca?: string; visualizacao?: string }> }) {
  const { user, supabase } = await requireUser(); const params = await searchParams; const mock = await isMockMode();
  const { data: storedPeople } = mock ? { data: null } : await supabase.from("assisted_people").select("id,full_name,active").is("archived_at", null).order("full_name");
  const people: { id: string; full_name: string; active: boolean }[] = (mock ? mockPeople.filter((person) => person.active).map(({ id, full_name, active }) => ({ id, full_name, active })) : storedPeople || []) as { id: string; full_name: string; active: boolean }[];
  let data: ReminderItem[];
  if (mock) {
    data = mockReminders.filter((item) => (!params.status || item.status === params.status) && (!params.pessoa || item.assisted_people[0]?.id === params.pessoa) && (!params.busca || `${item.title} ${item.message}`.toLowerCase().includes(params.busca.toLowerCase()))) as ReminderItem[];
  } else {
    let request = supabase.from("reminders").select("id,title,message,scheduled_for,status,recurrence_rule,assisted_people(id,full_name)").order("scheduled_for", { ascending: true }).limit(200);
    if (params.status) request = request.eq("status", params.status);
    if (params.pessoa) request = request.eq("assisted_person_id", params.pessoa);
    if (params.busca) request = request.or(`title.ilike.%${params.busca}%,message.ilike.%${params.busca}%`);
    data = ((await request).data || []) as ReminderItem[];
  }
  const grouped = people.map((person) => ({ person, reminders: data.filter((item) => item.assisted_people[0]?.id === person.id) })).filter((group) => group.reminders.length || params.pessoa === group.person.id);
  const queryFor = (extra: Record<string,string>) => { const values = { ...params, ...extra }; const search = new URLSearchParams(); Object.entries(values).forEach(([key,value]) => value && search.set(key, value)); return `/lembretes?${search}`; };
  const listView = params.visualizacao === "lista";
  return <AppShell email={user.email || "Responsável"} active="/lembretes"><header className="sectionHeader"><div><p className="eyebrow">AGENDA</p><h1>Lembretes</h1><p>Acompanhe a rotina organizada por pessoa assistida.</p></div><a className="primary buttonLink" href={params.pessoa ? `/lembretes/novo?pessoa=${params.pessoa}` : "/lembretes/novo"}>+ Novo lembrete</a></header>{params.sucesso && <p className="formMessage success">{params.sucesso}</p>}
    <section className="reminderToolbar"><form className="searchForm"><input type="hidden" name="pessoa" value={params.pessoa || ""}/><input type="hidden" name="status" value={params.status || ""}/><input name="busca" defaultValue={params.busca || ""} placeholder="Buscar lembrete..."/><button>Buscar</button></form><div className="viewToggle"><a className={!listView ? "active" : ""} href={queryFor({ visualizacao: "" })}>Por pessoa</a><a className={listView ? "active" : ""} href={queryFor({ visualizacao: "lista" })}>Cronológica</a></div></section>
    <nav className="personTabs"><a className={!params.pessoa ? "active" : ""} href={queryFor({ pessoa: "" })}>Todas</a>{people.map((person) => <a className={params.pessoa === person.id ? "active" : ""} key={person.id} href={queryFor({ pessoa: person.id })}>{person.full_name}</a>)}</nav>
    <nav className="filters"><a href={queryFor({ status: "" })}>Todos</a><a href={queryFor({ status: "scheduled" })}>Agendados</a><a href={queryFor({ status: "sent" })}>Enviados</a><a href={queryFor({ status: "not_done" })}>Não confirmados</a><a href={queryFor({ status: "failed" })}>Não enviados</a></nav>
    {!data.length ? <section className="card emptyState"><strong>Nenhum lembrete encontrado</strong><p>Ajuste os filtros ou crie um novo lembrete.</p></section> : listView ? <section className="card tableCard"><div className="dataTable">{data.map((item) => <ReminderRow key={item.id} item={item} mock={mock}/>)}</div></section> : <div className="reminderGroups">{grouped.map(({ person, reminders }) => { const waiting = reminders.filter((item) => item.status === "sent").length; const scheduled = reminders.filter((item) => item.status === "scheduled").length; return <section className="card reminderGroup" key={person.id}><header><div><span className="personAvatar smallAvatar">{person.full_name.split(" ").slice(0,2).map((word) => word[0]).join("")}</span><div><h2>{person.full_name}</h2><p>{scheduled} agendado(s) · {waiting} aguardando confirmação</p></div></div><a href={`/lembretes/novo?pessoa=${person.id}`}>+ Adicionar</a></header><div className="dataTable">{reminders.map((item) => <ReminderRow key={item.id} item={item} mock={mock}/>)}</div></section>; })}</div>}
  </AppShell>;
}
