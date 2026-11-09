import { AppShell } from "@/components/app-shell";
import { requireUser } from "@/lib/auth/require-user";
import { createReminder } from "../actions";
import { EscalationOptions } from "./escalation-options";
import { RepeatOptions } from "./repeat-options";
import { ReminderAssistant } from "./reminder-assistant";

export default async function NewReminder({ searchParams }: { searchParams: Promise<{ erro?: string; pessoa?: string; modo?: string }> }) {
  const { user, supabase } = await requireUser();
  const query = await searchParams;
  const { data: people } = await supabase.from("assisted_people").select("id,full_name,authorized_contacts(id,full_name,is_primary)").eq("active", true).order("full_name");
  const contacts = people?.flatMap((person) => person.authorized_contacts.map((contact) => ({ ...contact, personName: person.full_name }))) || [];

  return (
    <AppShell email={user.email || "Responsável"} active="/lembretes">
      <a className="backLink" href="/lembretes">← Voltar</a>
      <header className="sectionHeader"><div><p className="eyebrow">NOVO AGENDAMENTO</p><h1>Criar lembrete</h1><p>Escolha a mensagem, o horário e o que deve acontecer caso não haja resposta.</p></div></header>
      <nav className="reminderModeTabs" aria-label="Forma de criar o lembrete"><a className={query.modo === "assistente" ? "active" : ""} href="/lembretes/novo?modo=assistente">✦ Conversar com o assistente</a><a className={query.modo !== "assistente" ? "active" : ""} href="/lembretes/novo">Preencher formulário</a></nav>
      {query.modo === "assistente" && people?.length ? <ReminderAssistant people={people} /> : <section className="card formCard">
        {query.erro && <p className="formMessage error">{query.erro}</p>}
        {!people?.length ? (
          <div className="emptyState"><strong>Cadastre uma pessoa primeiro</strong><p>É preciso ter um perfil ativo para direcionar a mensagem.</p><a className="primary buttonLink" href="/pessoas/nova">Cadastrar pessoa</a></div>
        ) : (
          <form action={createReminder}>
            <label>Pessoa assistida<select name="personId" defaultValue={query.pessoa || ""} required><option value="">Selecione</option>{people.map((person) => <option key={person.id} value={person.id}>{person.full_name}</option>)}</select></label>
            <div className="formGrid"><label>Tipo<select name="kind"><option value="medication">Medicamento prescrito</option><option value="appointment">Consulta</option><option value="task">Tarefa</option></select></label><label>Título<input name="title" maxLength={100} required /></label></div>
            <label>Mensagem no WhatsApp<textarea name="message" maxLength={500} rows={4} placeholder="Está na hora de tomar o medicamento da manhã." required /></label>
            <div className="formGrid three"><label>Data de início<input name="date" type="date" required /></label><label>Horário<input name="time" type="time" required /></label><label>Tempo para responder<select name="timeout" defaultValue="30"><option value="15">15 minutos</option><option value="30">30 minutos</option><option value="60">1 hora</option><option value="120">2 horas</option></select></label></div>
            <RepeatOptions />
            <fieldset className="ruleBox">
              <legend>Se não houver resposta</legend>
              <label className="checkLabel"><input name="confirmationRequired" type="checkbox" defaultChecked /><span>Solicitar confirmação da pessoa</span></label>
              <div className="formGrid twoRuleFields"><label>Quantas vezes lembrar<select name="maxAttempts" defaultValue="2"><option value="1">1 envio</option><option value="2">2 envios</option><option value="3">3 envios</option></select></label><label>Repetir depois de<select name="repeatInterval" defaultValue="15"><option value="5">5 minutos</option><option value="15">15 minutos</option><option value="30">30 minutos</option><option value="60">1 hora</option></select></label></div>
              <EscalationOptions contacts={contacts} />
            </fieldset>
            <button className="primary">Agendar lembrete</button>
          </form>
        )}
      </section>}
    </AppShell>
  );
}
