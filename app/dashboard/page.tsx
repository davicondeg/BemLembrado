import { AppShell } from "@/components/app-shell";
import { requireUser } from "@/lib/auth/require-user";
import { isMockMode, mockPeople, mockReminders } from "@/lib/mock/data";
import { recurrenceLabel } from "@/lib/reminders/recurrence";

export default async function Dashboard() {
  const { user, supabase } = await requireUser();
  const mock = await isMockMode();
  const { data: storedReminders } = mock
    ? { data: null }
    : await supabase.from("reminders").select("id,title,message,scheduled_for,status,recurrence_rule,confirmation_required,confirmation_deadline").order("scheduled_for").limit(20);
  const reminders = mock ? mockReminders : storedReminders;
  const requiresConfirmation = (item: NonNullable<typeof reminders>[number]) => "confirmation_required" in item ? Boolean(item.confirmation_required) : item.status === "sent";
  const inProgress = reminders?.filter((item) => ["scheduled", "queued"].includes(item.status) || (item.status === "sent" && requiresConfirmation(item))) || [];
  const completed = reminders?.filter((item) => item.status === "confirmed" || (item.status === "sent" && !requiresConfirmation(item))).length || 0;
  const labels: Record<string, string> = { scheduled: "Agendado", queued: "Preparando envio", sent: "Aguardando confirmação" };
  const { count: storedPeopleCount } = mock ? { count: null } : await supabase.from("assisted_people").select("id", { count: "exact", head: true }).eq("active", true);
  const peopleCount = mock ? mockPeople.filter((person) => person.active).length : storedPeopleCount;

  return <AppShell email={user.email || "Responsável"} active="/dashboard">
    <header className="sectionHeader"><div><p className="eyebrow">SUA ROTINA DE CUIDADO</p><h1>Visão geral</h1><p>Veja rapidamente o que está programado, aguardando resposta ou concluído.</p></div></header>
    <section className="stats"><article><span className="statIcon green">✓</span><div><strong>{completed}</strong><p>Concluídos</p></div></article><article><span className="statIcon amber">◷</span><div><strong>{inProgress.length}</strong><p>Em acompanhamento</p></div></article><article><span className="statIcon blue">↗</span><div><strong>{peopleCount}</strong><p>Pessoas acompanhadas</p></div></article></section>
    {!peopleCount ? <section className="setupBanner"><div><p className="eyebrow">COMECE POR AQUI</p><strong>Cadastre a primeira pessoa assistida</strong><p>Depois, você poderá organizar os lembretes da rotina dela.</p></div><a className="primary buttonLink" href="/pessoas/nova">Cadastrar pessoa</a></section> : <section className="setupBanner"><div><p className="eyebrow">ROTINA ORGANIZADA</p><strong>{peopleCount} {peopleCount === 1 ? "pessoa acompanhada" : "pessoas acompanhadas"}</strong><p>Crie um novo lembrete para manter os cuidados em dia.</p></div><a className="primary buttonLink" href="/lembretes/novo">Criar lembrete</a></section>}
    <section className="card"><div className="cardTitle"><div><p className="eyebrow">ACOMPANHAMENTO</p><h2>Lembretes em andamento</h2></div></div>
      {!inProgress.length ? <div className="emptyState"><strong>Nenhum lembrete em andamento</strong><p>Quando você agendar um lembrete ou estiver aguardando uma confirmação, ele aparecerá aqui.</p></div> : <div className="reminderList">{inProgress.map((item) => { const recurrence = recurrenceLabel(item.recurrence_rule); return <article className="reminder" key={item.id}><time>{new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" }).format(new Date(item.scheduled_for))}</time><div className="reminderText"><strong>{item.title}</strong><span>{new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short" }).format(new Date(item.scheduled_for))}{recurrence ? ` · ${recurrence}` : ""}</span></div><span className={`badge ${item.status === "sent" ? "pending" : "scheduled"}`}>{labels[item.status] || "Em acompanhamento"}</span></article>; })}</div>}
    </section>
  </AppShell>;
}
