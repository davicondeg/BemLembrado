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
  const peopleCount = mock ? mockPeople.filter((person) => person.active).length : storedPeopleCount || 0;
  const hasReminders = Boolean(reminders?.length);

  return <AppShell email={user.email || "Responsável"} active="/dashboard">
    <header className="sectionHeader"><div><p className="eyebrow">SUA ROTINA DE CUIDADO</p><h1>Visão geral</h1><p>Veja rapidamente o que está programado, aguardando resposta ou concluído.</p></div></header>
    {!peopleCount ? <section className="card onboardingCard"><div className="onboardingGuide"><span className="onboardingAvatar" aria-hidden="true">✦</span><div className="onboardingSpeech"><p className="eyebrow">PRIMEIRA ETAPA</p><h2>Você ainda não tem ninguém cadastrado</h2><p>Vamos começar informando quem receberá os lembretes e quem deverá ser avisado caso essa pessoa precise de ajuda.</p><a className="primary buttonLink" href="/pessoas/nova">Cadastrar primeira pessoa <span aria-hidden="true">→</span></a></div></div><ol className="onboardingSteps" aria-label="Etapas para começar"><li className="active"><span>1</span><div><strong>Cadastrar pessoa</strong><small>Informe quem será acompanhado.</small></div></li><li><span>2</span><div><strong>Criar lembrete</strong><small>Defina mensagem, dia e horário.</small></div></li><li><span>3</span><div><strong>Acompanhar</strong><small>Veja envios e confirmações.</small></div></li></ol></section> : !hasReminders ? <section className="card onboardingCard"><div className="onboardingGuide"><span className="onboardingAvatar success" aria-hidden="true">✓</span><div className="onboardingSpeech"><p className="eyebrow">SEGUNDA ETAPA</p><h2>A pessoa já está cadastrada. Agora crie o primeiro lembrete</h2><p>Escolha o que ela deve lembrar, quando receberá a mensagem e o que fazer caso não haja resposta.</p><a className="primary buttonLink" href="/lembretes/novo">Criar primeiro lembrete <span aria-hidden="true">→</span></a></div></div><ol className="onboardingSteps" aria-label="Etapas para começar"><li className="complete"><span>✓</span><div><strong>Pessoa cadastrada</strong><small>Primeira etapa concluída.</small></div></li><li className="active"><span>2</span><div><strong>Criar lembrete</strong><small>Defina mensagem, dia e horário.</small></div></li><li><span>3</span><div><strong>Acompanhar</strong><small>Veja envios e confirmações.</small></div></li></ol></section> : <><section className="stats"><article><span className="statIcon green">✓</span><div><strong>{completed}</strong><p>Concluídos</p></div></article><article><span className="statIcon amber">◷</span><div><strong>{inProgress.length}</strong><p>Em acompanhamento</p></div></article><article><span className="statIcon blue">↗</span><div><strong>{peopleCount}</strong><p>Pessoas acompanhadas</p></div></article></section>
    <section className="setupBanner"><div><p className="eyebrow">ROTINA ORGANIZADA</p><strong>{peopleCount} {peopleCount === 1 ? "pessoa acompanhada" : "pessoas acompanhadas"}</strong><p>Crie um novo lembrete para manter os cuidados em dia.</p></div><a className="primary buttonLink" href="/lembretes/novo">Criar lembrete</a></section>
    <section className="card"><div className="cardTitle"><div><p className="eyebrow">ACOMPANHAMENTO</p><h2>Lembretes em andamento</h2></div></div>
      {!inProgress.length ? <div className="emptyState"><strong>Nenhum lembrete em andamento</strong><p>Quando você agendar um lembrete ou estiver aguardando uma confirmação, ele aparecerá aqui.</p></div> : <div className="reminderList">{inProgress.map((item) => { const recurrence = recurrenceLabel(item.recurrence_rule); return <article className="reminder" key={item.id}><time>{new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" }).format(new Date(item.scheduled_for))}</time><div className="reminderText"><strong>{item.title}</strong><span>{new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short" }).format(new Date(item.scheduled_for))}{recurrence ? ` · ${recurrence}` : ""}</span></div><span className={`badge ${item.status === "sent" ? "pending" : "scheduled"}`}>{labels[item.status] || "Em acompanhamento"}</span></article>; })}</div>}
    </section></>}
  </AppShell>;
}
