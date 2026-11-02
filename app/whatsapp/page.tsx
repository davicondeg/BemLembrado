import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import LinkCodePanel from "./link-code-panel";
import { AppShell } from "@/components/app-shell";

export default async function WhatsAppPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: link } = await supabase.from("whatsapp_links").select("phone,linked_at,code_expires_at").eq("user_id", user.id).maybeSingle();

  return <AppShell email={user.email || "Responsável"} active="/whatsapp"><div className="narrowPage">
    <header className="pageHeading"><p className="eyebrow">CONEXÃO DO MVP</p><h1>Vincular WhatsApp</h1><p>Associe o telefone que conversará com o bot à sua conta.</p></header>
    {link?.linked_at && link.phone ? <section className="card connectedCard"><span className="statusDot"/><div><h2>WhatsApp vinculado</h2><p>Número terminado em <strong>{link.phone.slice(-4)}</strong>. Vinculado em {new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" }).format(new Date(link.linked_at))}.</p></div></section> : <LinkCodePanel />}
    <section className="card warningCard"><h2>Antes de conectar</h2><ul><li>Use um número secundário exclusivo para o MVP.</li><li>A integração pela Evolution API não é oficial.</li><li>O número pode ser desconectado ou bloqueado pelo WhatsApp.</li><li>Não use para spam ou mensagens sem consentimento.</li></ul></section>
  </div></AppShell>;
}
