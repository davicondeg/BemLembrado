import { AppShell } from "@/components/app-shell";
import { requireUser } from "@/lib/auth/require-user";
import { createAssistedPerson } from "../actions";

export default async function NewPerson({ searchParams }: { searchParams: Promise<{ erro?: string }> }) {
  const { user } = await requireUser(); const params = await searchParams;
  return <AppShell email={user.email || "Responsável"} active="/pessoas"><a className="backLink" href="/pessoas">← Voltar</a><header className="sectionHeader"><div><p className="eyebrow">NOVO CADASTRO</p><h1>Pessoa assistida</h1><p>Use números com DDI e DDD, por exemplo: 5527999999999.</p></div></header><section className="card formCard">{params.erro && <p className="formMessage error">{params.erro}</p>}<form action={createAssistedPerson}><fieldset><legend>Dados da pessoa</legend><label>Nome completo<input name="fullName" required /></label><label>WhatsApp<input name="phone" inputMode="tel" placeholder="5527999999999" required /></label></fieldset><fieldset><legend>Contato autorizado principal</legend><label>Nome completo<input name="contactName" required /></label><label>WhatsApp<input name="contactPhone" inputMode="tel" placeholder="5527999999999" required /></label></fieldset><label className="checkLabel"><input name="consent" type="checkbox" required/><span>Confirmo que os participantes autorizaram o uso dos dados e o recebimento de lembretes.</span></label><button className="primary">Salvar cadastro</button></form></section></AppShell>;
}
