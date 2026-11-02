import { updatePassword } from "@/app/auth/actions";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export default async function NewPassword({ searchParams }: { searchParams: Promise<{ erro?: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/esqueci-senha?erro=Abra novamente o link enviado por e-mail.");
  const params = await searchParams;
  return <main className="simpleAuthPage"><section className="authCard compactCard">
    <p className="eyebrow">NOVA SENHA</p><h1>Crie uma nova senha</h1><p className="formIntro">Use pelo menos oito caracteres e não reutilize uma senha importante.</p>
    {params.erro && <p className="formMessage error">{params.erro}</p>}
    <form><label>Nova senha<input name="password" type="password" autoComplete="new-password" minLength={8} required /></label><label>Confirmar nova senha<input name="confirmation" type="password" autoComplete="new-password" minLength={8} required /></label><button className="primary wide" formAction={updatePassword}>Salvar nova senha</button></form>
  </section></main>;
}
