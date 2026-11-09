import { redirect } from "next/navigation";
import { signUp } from "@/app/auth/actions";
import { createClient } from "@/lib/supabase/server";

const plans = [
  { id: "individual", name: "Individual", description: "Para acompanhar uma pessoa assistida com lembretes, confirmações e alertas.", capacity: "1 pessoa assistida", highlight: null },
  { id: "family", name: "Família", description: "Para famílias que precisam organizar o cuidado de mais de uma pessoa.", capacity: "Até 3 pessoas assistidas", highlight: "Mais escolhido" },
  { id: "complete", name: "Cuidado Completo", description: "Para uma rotina de cuidado mais ampla, com visão consolidada no painel.", capacity: "Até 5 pessoas assistidas", highlight: null },
] as const;

export default async function CreateAccountPage({ searchParams }: { searchParams: Promise<{ erro?: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (user) redirect(user.user_metadata?.subscription_status === "pending" ? "/assinatura-pendente" : "/dashboard");
  const params = await searchParams;

  return (
    <main className="signupPage">
      <header className="minimalLoginBrand">
        <span className="minimalLoginMark" aria-hidden="true">✓</span>
        <h1>Bem Lembrado</h1>
        <p>Rotina e acompanhamento de cuidados</p>
      </header>
      <section className="signupCard">
        <a className="backLink" href="/login">← Voltar ao login</a>
        <p className="eyebrow">NOVA ASSINATURA</p>
        <h2>Crie sua conta</h2>
        <p className="signupLead">Cadastre o responsável e escolha o plano mais adequado à sua rotina de cuidado. O acesso será liberado após a confirmação da assinatura.</p>
        {params.erro && <p className="formMessage error">{params.erro}</p>}
        <form action={signUp}>
          <div className="signupFields">
            <label>Nome completo<input name="fullName" autoComplete="name" required /></label>
            <label>E-mail<input name="email" type="email" autoComplete="email" required /></label>
            <label>Senha<input name="password" type="password" autoComplete="new-password" minLength={8} required /><small>Use pelo menos oito caracteres.</small></label>
          </div>
          <fieldset className="planChoice">
            <legend>Escolha seu plano</legend>
            <div className="planOptions">
              {plans.map((plan) => (
                <label key={plan.id} className="planOption">
                  <input name="plan" type="radio" value={plan.id} defaultChecked={plan.id === "family"} />
                  <span className="planOptionContent">
                    <span className="planOptionHeading"><strong>{plan.name}</strong>{plan.highlight && <b>{plan.highlight}</b>}</span>
                    <small>{plan.description}</small>
                    <em>{plan.capacity}</em>
                  </span>
                </label>
              ))}
            </div>
            <p>Todos os planos têm cobrança mensal. Os valores e os dados de pagamento serão apresentados no checkout.</p>
          </fieldset>
          <label className="signupTerms"><input name="terms" type="checkbox" required /><span>Li e aceito os termos de uso, a política de privacidade e a cobrança recorrente do plano escolhido.</span></label>
          <button className="minimalLoginSubmit">Criar conta e continuar</button>
        </form>
        <p className="minimalLoginNotice">A assinatura pode ser cancelada conforme as condições apresentadas no checkout.</p>
      </section>
    </main>
  );
}
