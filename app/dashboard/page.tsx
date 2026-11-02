import { AppShell } from "@/components/app-shell";
import { requireUser } from "@/lib/auth/require-user";
import { isMockMode, mockPeople, mockReminders } from "@/lib/mock/data";

export default async function Dashboard() {
  const { user, supabase } = await requireUser();
  const mock = await isMockMode();
  const { data: storedReminders } = mock ? { data: null } : await supabase.from("reminders").select("id,title,message,scheduled_for,status,recurrence_rule").order("scheduled_for").limit(20);
  const reminders = mock ? mockReminders : storedReminders;
  const pending = reminders?.filter((item) => ["scheduled", "queued"].includes(item.status)) || [];
  const completed = reminders?.filter((item) => ["sent", "confirmed"].includes(item.status)).length || 0;
  const labels: Record<string, string> = { scheduled: "Agendado", queued: "Preparando envio" };

  const { count: storedPeopleCount } = mock ? { count: null } : await supabase.from("assisted_people").select("id", { count: "exact", head: true }).eq("active", true);
  const peopleCount = mock ? mockPeople.filter((person) => person.active).length : storedPeopleCount;
  return <AppShell email={user.email || "Responsável"} active="/dashboard">
    <header className="sectionHeader"><div><p className="eyebrow">SUA ROTINA DE CUIDADO</p><h1>Visão geral</h1><p>Veja rapidamente o que está programado e o que já foi realizado.</p></div></header>
    <section className="stats"><article><span className="statIcon green">✓</span><div><strong>{completed}</strong><p>Realizados</p></div></article><article><span className="statIcon amber">◷</span><div><strong>{pending.length}</strong><p>Próximos lembretes</p></div></article><article><span className="statIcon blue">↗</span><div><strong>{peopleCount}</strong><p>Pessoas acompanhadas</p></div></article></section>
    {!peopleCount ? <section className="setupBanner"><div><p className="eyebrow">COMECE POR AQUI</p><strong>Cadastre a primeira pessoa assistida</strong><p>Depois, você poderá organizar os lembretes da rotina dela.</p></div><a className="primary buttonLink" href="/pessoas/nova">Cadastrar pessoa</a></section> : <section className="setupBanner"><div><p className="eyebrow">ROTINA ORGANIZADA</p><strong>{peopleCount} {peopleCount === 1 ? "pessoa acompanhada" : "pessoas acompanhadas"}</strong><p>Crie um novo lembrete para manter os cuidados em dia.</p></div><a className="primary buttonLink" href="/lembretes/novo">Criar lembrete</a></section>}
    <section className="card"><div className="cardTitle"><div><p className="eyebrow">AGENDA</p><h2>Próximos lembretes</h2></div></div>
      {!pending.length ? <div className="emptyState"><strong>Nenhum lembrete próximo</strong><p>Quando você criar um lembrete, ele aparecerá aqui.</p></div> :
      <div className="reminderList">{pending.map((item) => <article className="reminder" key={item.id}><time>{new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" }).format(new Date(item.scheduled_for))}</time><div className="reminderText"><strong>{item.title}</strong><span>{new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short" }).format(new Date(item.scheduled_for))}{item.recurrence_rule ? " · todos os dias" : ""}</span></div><span className="badge scheduled">{labels[item.status] || "Agendado"}</span></article>)}</div>}
    </section>
  </AppShell>;
}
