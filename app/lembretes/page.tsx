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
type Search = { sucesso?: string; erro?: string; status?: string; pessoa?: string; busca?: string; periodo?: string; arquivados?: string };

const labels: Record<string, string> = { scheduled: "Agendado", queued: "Preparando envio", sent: "Aguardando confirmação", paused: "Pausado", cancelled: "Cancelado", failed: "Não foi possível enviar", confirmed: "Confirmado", not_done: "Não confirmado" };

type PageIconName = "calendar" | "clock" | "alert" | "search";
function PageIcon({ name, className }: { name: PageIconName; className?: string }) {
  const paths = {
    calendar: <><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/><path d="M8 14h3v3H8z"/></>,
    clock: <><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></>,
    alert: <><path d="M10.3 3.8 2.2 18a2 2 0 0 0 1.8 3h16a2 2 0 0 0 1.8-3L13.7 3.8a2 2 0 0 0-3.4 0Z"/><path d="M12 9v4M12 17h.01"/></>,
    search: <><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></>,
  };
  return <svg className={className} viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{paths[name]}</svg>;
}

function initials(name: string) {
  return name.split(" ").filter(Boolean).slice(0, 2).map((word) => word[0]).join("").toLocaleUpperCase("pt-BR");
}

function ReminderRow({ item, mock, lastOccurrence }: { item: ReminderItem; mock: boolean; lastOccurrence?: ReminderOccurrence }) {
  const person = reminderPerson(item.assisted_people);
  const recurrence = recurrenceLabel(item.recurrence_rule);
  const scheduled = new Date(item.scheduled_for);
  const formattedDate = new Intl.DateTimeFormat("pt-BR", { weekday: "short", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" }).format(scheduled).replaceAll(".", "");
  const lastWasConfirmed = Boolean(item.recurrence_rule && lastOccurrence?.status === "confirmed");
  const badgeKind = lastWasConfirmed || item.status === "confirmed" ? "success" : item.status === "sent" ? "waiting" : item.status === "failed" || item.status === "not_done" ? "danger" : item.status === "paused" || item.status === "cancelled" ? "neutral" : "scheduled";
  const statusLabel = lastWasConfirmed ? "Confirmado" : labels[item.status] || "Atualizado";
  return <article className="remindersListRow">
    <div className="reminderPersonCell"><span className="reminderPersonAvatar">{initials(person?.full_name || "Pessoa")}</span><strong>{person?.full_name || "Pessoa assistida"}</strong></div>
    <div className="reminderMessageCell"><strong>{item.title}</strong><small>{item.message}</small></div>
    <div className="reminderDateCell"><PageIcon name="calendar"/><div><time dateTime={item.scheduled_for}>{formattedDate}</time>{recurrence && <small>{recurrence}</small>}</div></div>
    <div className="reminderStatusCell"><span className={`reminderStatusPill ${badgeKind}`}>{statusLabel}</span>{lastWasConfirmed && lastOccurrence?.confirmed_at && <small>Confirmado às {new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" }).format(new Date(lastOccurrence.confirmed_at))}</small>}</div>
    {!mock ? <ReminderActions id={item.id} title={item.title} status={item.status} recurring={Boolean(item.recurrence_rule)} archived={Boolean(item.archived_at)} /> : <span/>}
  </article>;
}

export default async function Reminders({ searchParams }: { searchParams: Promise<Search> }) {
  const { user, supabase } = await requireUser();
  const params = await searchParams;
  const mock = await isMockMode();
  const { data: storedPeople } = mock ? { data: null } : await supabase.from("assisted_people").select("id,full_name,active").is("archived_at", null).order("full_name");
  const people: { id: string; full_name: string; active: boolean }[] = (mock ? mockPeople.filter((person) => person.active).map(({ id, full_name, active }) => ({ id, full_name, active })) : storedPeople || []) as { id: string; full_name: string; active: boolean }[];

  let allData: ReminderItem[];
  if (mock) {
    allData = mockReminders.map((item) => ({ ...item, archived_at: null })) as ReminderItem[];
  } else {
    const { data } = await supabase.from("reminders").select("id,title,message,scheduled_for,status,recurrence_rule,archived_at,assisted_people(id,full_name)").order("scheduled_for", { ascending: true }).limit(500);
    allData = (data || []) as ReminderItem[];
  }

  const activeData = allData.filter((item) => !item.archived_at);
  const archivedView = params.status === "archived" || Boolean(params.arquivados);
  let data = allData.filter((item) => archivedView ? Boolean(item.archived_at) : !item.archived_at);
  if (params.status && params.status !== "archived") data = data.filter((item) => item.status === params.status);
  if (params.pessoa) data = data.filter((item) => reminderPerson(item.assisted_people)?.id === params.pessoa);
  if (params.periodo) {
    const now = new Date();
    const start = params.periodo === "hoje" ? new Date(now.getFullYear(), now.getMonth(), now.getDate()) : now;
    const end = params.periodo === "hoje" ? new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1) : new Date(now.getTime() + Number(params.periodo) * 86_400_000);
    data = data.filter((item) => { const date = new Date(item.scheduled_for); return date >= start && date < end; });
  }
  if (params.busca?.trim()) {
    const search = params.busca.trim().toLocaleLowerCase("pt-BR");
    data = data.filter((item) => {
      const person = reminderPerson(item.assisted_people)?.full_name || "";
      const date = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" }).format(new Date(item.scheduled_for));
      return `${person} ${item.title} ${item.message} ${date}`.toLocaleLowerCase("pt-BR").includes(search);
    });
  }

  const lastOccurrenceByReminder = new Map<string, ReminderOccurrence>();
  if (!mock && data.length) {
    const { data: occurrences } = await supabase.from("reminder_occurrences").select("reminder_id,status,confirmed_at,scheduled_for").in("reminder_id", data.map((item) => item.id)).order("scheduled_for", { ascending: false }).limit(1000);
    for (const occurrence of (occurrences || []) as ReminderOccurrence[]) if (!lastOccurrenceByReminder.has(occurrence.reminder_id)) lastOccurrenceByReminder.set(occurrence.reminder_id, occurrence);
  }

  const scheduledCount = activeData.filter((item) => ["scheduled", "queued"].includes(item.status)).length;
  const waitingCount = activeData.filter((item) => item.status === "sent").length;
  const attentionCount = activeData.filter((item) => ["failed", "not_done"].includes(item.status)).length;
  const newAction = people.length ? { href: "/lembretes/novo", label: "+ Novo lembrete" } : { href: "/pessoas/nova", label: "+ Cadastrar pessoa" };

  return <AppShell email={user.email || "Responsável"} active="/lembretes">
    <header className="remindersPageHeader"><div className="remindersHeading"><span className="remindersPageIcon"><PageIcon name="calendar"/></span><div><h1>Lembretes</h1><p>Acompanhe e gerencie os lembretes da rotina de cuidado.</p></div></div><a className="primary buttonLink" href={newAction.href}>{newAction.label}</a></header>
    {params.sucesso && <p className="formMessage success">{params.sucesso}</p>}{params.erro && <p className="formMessage error">{params.erro}</p>}

    <section className="remindersSummary" aria-label="Resumo dos lembretes"><article className="upcoming"><span className="summaryIcon"><PageIcon name="calendar"/></span><div><strong>{scheduledCount}</strong><p>Próximos agendamentos</p></div><i aria-hidden="true"><b/><b/><b/><b/></i></article><article className="waiting"><span className="summaryIcon"><PageIcon name="clock"/></span><div><strong>{waitingCount}</strong><p>Aguardando confirmação</p></div></article><article className="attention"><span className="summaryIcon"><PageIcon name="alert"/></span><div><strong>{attentionCount}</strong><p>Precisam de atenção</p></div></article></section>

    <form className="card reminderFilterPanel">
      <label className="reminderSearch"><PageIcon name="search"/><input name="busca" defaultValue={params.busca || ""} placeholder="Buscar por pessoa, mensagem ou data..." aria-label="Buscar lembretes"/></label>
      <label><span>Situação</span><select name="status" defaultValue={archivedView ? "archived" : params.status || ""}><option value="">Todas</option><option value="scheduled">Agendados</option><option value="sent">Aguardando confirmação</option><option value="paused">Pausados</option><option value="not_done">Não confirmados</option><option value="failed">Não enviados</option><option value="archived">Arquivados</option></select></label>
      <label><span>Pessoa</span><select name="pessoa" defaultValue={params.pessoa || ""}><option value="">Todas</option>{people.map((person) => <option key={person.id} value={person.id}>{person.full_name}</option>)}</select></label>
      <label><span>Período</span><select name="periodo" defaultValue={params.periodo || ""}><option value="">Todo o período</option><option value="hoje">Hoje</option><option value="7">Próximos 7 dias</option><option value="30">Próximos 30 dias</option></select></label>
      <button>Aplicar</button>
    </form>

    <section className="card remindersListCard"><header><h2>Lembretes <span>({data.length})</span></h2>{(params.busca || params.status || params.pessoa || params.periodo || params.arquivados) && <a href="/lembretes">Limpar filtros</a>}</header>
      {!data.length ? <div className="emptyState"><strong>{people.length ? "Nenhum lembrete encontrado" : "Cadastre a primeira pessoa"}</strong><p>{people.length ? "Ajuste os filtros ou crie um novo lembrete." : "Antes de criar um lembrete, informe quem receberá as mensagens."}</p><a className="primary buttonLink" href={newAction.href}>{newAction.label.replace("+ ", "")}</a></div> : <div className="remindersList"><div className="remindersListHead"><span>Pessoa</span><span>Mensagem</span><span>Data e hora</span><span>Situação</span><span aria-hidden="true"/></div>{data.map((item) => <ReminderRow key={item.id} item={item} mock={mock} lastOccurrence={lastOccurrenceByReminder.get(item.id)}/>)}</div>}
    </section>
  </AppShell>;
}
