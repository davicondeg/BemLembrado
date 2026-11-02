import { requestPasswordReset } from "@/app/auth/actions";

export default async function ForgotPassword({ searchParams }: { searchParams: Promise<{ erro?: string; sucesso?: string }> }) {
  const params = await searchParams;
  return <main className="simpleAuthPage"><section className="authCard compactCard">
    <a className="backLink" href="/login">← Voltar ao login</a>
    <p className="eyebrow">RECUPERAÇÃO DE ACESSO</p><h1>Redefinir senha</h1><p className="formIntro">Informe o e-mail usado no cadastro. Enviaremos um link seguro para criar uma nova senha.</p>
    {params.erro && <p className="formMessage error">{params.erro}</p>}
    {params.sucesso && <p className="formMessage success">{params.sucesso}</p>}
    <form><label>E-mail<input name="email" type="email" autoComplete="email" required /></label><button className="primary wide" formAction={requestPasswordReset}>Enviar link</button></form>
  </section></main>;
}
