import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { signIn } from "@/app/auth/actions";
import { getDemoSubscription } from "@/lib/auth/demo-session";

export default async function Login({ searchParams }: { searchParams: Promise<{ erro?: string; sucesso?: string }> }) {
  const demoSubscription = await getDemoSubscription();
  if (demoSubscription) redirect(demoSubscription === "active" ? "/dashboard" : "/assinatura-vencida");
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (user) redirect("/dashboard");
  const params = await searchParams;

  return <main className="minimalLogin">
    <header className="minimalLoginBrand"><span className="minimalLoginMark" aria-hidden="true">✓</span><h1>Bem Lembrado</h1><p>Rotina e acompanhamento de cuidados</p></header>
    <section className="minimalLoginCard">
      <h2>Entrar na sua conta</h2>
      {params.erro && <p className="formMessage error">{params.erro}</p>}
      {params.sucesso && <p className="formMessage success">{params.sucesso}</p>}
      <form className="minimalLoginForm">
        <label className="minimalLoginField"><span className="srOnly">E-mail</span><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/></svg><input name="email" type="email" autoComplete="email" placeholder="E-mail" required /></label>
        <label className="minimalLoginField"><span className="srOnly">Senha</span><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3M12 14v3"/></svg><input name="password" type="password" autoComplete="current-password" minLength={8} placeholder="Senha" required /></label>
        <a className="formLink" href="/esqueci-senha">Esqueci minha senha</a>
        <button className="minimalLoginSubmit" formAction={signIn}>Entrar</button>
        <div className="minimalLoginDivider"><span>ou</span></div>
        <a className="minimalSignupLink" href="/criar-conta">Criar minha conta</a>
      </form>
      <p className="minimalLoginNotice">O Bem Lembrado não substitui atendimento médico ou serviço de emergência.</p>
    </section>
  </main>;
}
