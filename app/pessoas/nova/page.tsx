import { AppShell } from "@/components/app-shell";
import { requireUser } from "@/lib/auth/require-user";
import { createAssistedPerson } from "../actions";
import { PersonAssistant } from "./person-assistant";

export default async function NewPerson({ searchParams }: { searchParams: Promise<{ erro?: string; modo?: string }> }) {
  const { user } = await requireUser();
  const params = await searchParams;

  return (
    <AppShell email={user.email || "Responsável"} active="/pessoas">
      <a className="backLink" href="/pessoas">← Voltar para pessoas</a>
      <header className="sectionHeader assistedHeader">
        <div>
          <p className="eyebrow">NOVO CADASTRO</p>
          <h1>Quem será acompanhado?</h1>
          <p>Cadastre a pessoa que receberá os lembretes e quem deverá ser avisado quando ela precisar de ajuda.</p>
        </div>
      </header>

      <nav className="reminderModeTabs" aria-label="Forma de cadastrar a pessoa">
        <a className={params.modo === "assistente" ? "active" : ""} href="/pessoas/nova?modo=assistente">✦ Conversar com o assistente</a>
        <a className={params.modo !== "assistente" ? "active" : ""} href="/pessoas/nova">Preencher formulário</a>
      </nav>

      {params.modo === "assistente" ? <PersonAssistant /> : <div className="assistedSignupLayout">
        <section className="card formCard assistedFormCard">
          {params.erro && <p className="formMessage error">{params.erro}</p>}
          <form action={createAssistedPerson}>
            <section className="assistedFormSection">
              <div className="assistedSectionHeading">
                <span>1</span>
                <span><strong>Pessoa assistida</strong><small>Quem receberá os lembretes no WhatsApp.</small></span>
              </div>
              <div className="formGrid">
                <label>Nome completo<input name="fullName" autoComplete="name" placeholder="Ex.: Maria de Souza" required /></label>
                <label>WhatsApp da pessoa<input name="phone" type="tel" inputMode="tel" autoComplete="tel" placeholder="(27) 99999-9999" aria-describedby="assisted-phone-help" required /><small id="assisted-phone-help">Informe o DDD; o código 55 será adicionado automaticamente.</small></label>
              </div>
            </section>

            <section className="assistedFormSection">
              <div className="assistedSectionHeading">
                <span>2</span>
                <span><strong>Contato responsável</strong><small>Quem receberá os alertas de acompanhamento.</small></span>
              </div>
              <div className="formGrid">
                <label>Nome completo<input name="contactName" autoComplete="name" placeholder="Ex.: João de Souza" required /></label>
                <label>WhatsApp do responsável<input name="contactPhone" type="tel" inputMode="tel" autoComplete="tel" placeholder="(27) 99999-9999" aria-describedby="contact-phone-help" required /><small id="contact-phone-help">Informe o DDD; o código 55 será adicionado automaticamente.</small></label>
              </div>
            </section>

            <section className="assistedConsent">
              <div className="assistedSectionHeading"><span>3</span><strong>Autorização</strong></div>
              <label className="checkLabel">
                <input name="consent" type="checkbox" required />
                <span><strong>Confirmo que os participantes autorizaram este cadastro.</strong><small>A autorização inclui o uso dos dados informados e o recebimento de lembretes e alertas pelo WhatsApp.</small></span>
              </label>
            </section>

            <div className="assistedFormActions">
              <a className="secondary buttonLink" href="/pessoas">Cancelar</a>
              <button className="primary">Salvar pessoa assistida</button>
            </div>
          </form>
        </section>

        <aside className="assistedGuide" aria-label="Como funciona o acompanhamento">
          <p className="eyebrow">COMO FUNCIONA</p>
          <h2>Um cuidado simples e conectado</h2>
          <ol>
            <li><span>✓</span><div><strong>Lembretes no WhatsApp</strong><p>A pessoa recebe mensagens nos horários cadastrados.</p></div></li>
            <li><span>✓</span><div><strong>Confirmação da rotina</strong><p>Ela pode responder para confirmar que realizou a atividade.</p></div></li>
            <li><span>✓</span><div><strong>Alerta ao responsável</strong><p>Se não houver confirmação, o contato indicado pode ser avisado.</p></div></li>
          </ol>
          <p className="assistedPrivacy">Os números não ficam expostos nas telas de consulta do sistema.</p>
        </aside>
      </div>}
    </AppShell>
  );
}
