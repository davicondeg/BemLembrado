import { notFound } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { requireUser } from "@/lib/auth/require-user";
import { updateAssistedPerson } from "../../actions";

export default async function EditPerson({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ erro?: string }> }) {
  const { id } = await params; const query = await searchParams;
  const { user, supabase } = await requireUser();
  const { data: person } = await supabase.from("assisted_people").select("id,full_name,whatsapp_e164,authorized_contacts(id,full_name,whatsapp_e164,is_primary)").eq("id", id).maybeSingle();
  if (!person) notFound();
  const contact = person.authorized_contacts?.find((item) => item.is_primary) || person.authorized_contacts?.[0];
  return <AppShell email={user.email || "Responsável"} active="/pessoas"><a className="backLink" href={`/pessoas/${id}`}>← Voltar ao perfil</a><header className="sectionHeader"><div><p className="eyebrow">EDIÇÃO</p><h1>Editar cadastro</h1><p>Alterações de telefone afetam os próximos lembretes criados.</p></div></header><section className="card formCard">{query.erro && <p className="formMessage error">{query.erro}</p>}<form action={updateAssistedPerson}><input type="hidden" name="id" value={id}/><input type="hidden" name="contactId" value={contact?.id || ""}/><fieldset><legend>Dados da pessoa</legend><label>Nome completo<input name="fullName" defaultValue={person.full_name} required/></label><label>WhatsApp<input name="phone" defaultValue={person.whatsapp_e164} required/></label></fieldset><fieldset><legend>Contato autorizado principal</legend><label>Nome completo<input name="contactName" defaultValue={contact?.full_name || ""} required/></label><label>WhatsApp<input name="contactPhone" defaultValue={contact?.whatsapp_e164 || ""} required/></label></fieldset><button className="primary">Salvar alterações</button></form></section></AppShell>;
}
