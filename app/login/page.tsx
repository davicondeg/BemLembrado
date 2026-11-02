import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { signIn, signUp } from "@/app/auth/actions";

export default async function Login({ searchParams }: { searchParams: Promise<{ erro?: string; sucesso?: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (user) redirect("/dashboard");
  const params = await searchParams;

  return <main className="authShell">
    <section className="authIntro"><span className="brandMark">✓</span><p className="eyebrow">BEM LEMBRADO</p><h1>Cuidado presente, sem complicação.</h1><p>Organize lembretes e acompanhe confirmações usando um canal que já faz parte da rotina: o WhatsApp.</p></section>
    <section className="authCard">
      <p className="eyebrow">ACESSO DO RESPONSÁVEL</p><h2>Entre no painel</h2>
      {params.erro && <p className="formMessage error">{params.erro}</p>}
      {params.sucesso && <p className="formMessage success">{params.sucesso}</p>}
      <form>
        <label>E-mail<input name="email" type="email" autoComplete="email" required /></label>
        <label>Senha<input name="password" type="password" autoComplete="current-password" minLength={8} required /></label>
        <a className="formLink" href="/esqueci-senha">Esqueci minha senha</a>
        <button className="primary wide" formAction={signIn}>Entrar</button>
        <details><summary>Criar minha conta</summary><label>Nome completo<input name="fullName" autoComplete="name" /></label><button className="secondary" formAction={signUp}>Cadastrar</button></details>
      </form>
      <small>Este MVP não substitui atendimento médico ou serviço de emergência.</small>
    </section>
  </main>;
}
