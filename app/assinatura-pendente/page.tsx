import { redirect } from "next/navigation";
import { signOut, simulateSubscriptionPayment } from "@/app/auth/actions";
import { createClient } from "@/lib/supabase/server";

export default async function PendingSubscriptionPage({ searchParams }: { searchParams: Promise<{ erro?: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  if (user.user_metadata?.subscription_status !== "pending") redirect("/dashboard");
  const params = await searchParams;
  const planNames: Record<string, string> = { individual: "Individual", family: "Família", complete: "Cuidado Completo" };
  const selectedPlan = planNames[String(user.user_metadata?.selected_plan)] || "Família";

  return <main className="subscriptionPage"><header className="minimalLoginBrand"><span className="minimalLoginMark" aria-hidden="true">✓</span><h1>Bem Lembrado</h1><p>Rotina e acompanhamento de cuidados</p></header><section className="subscriptionCard"><span className="subscriptionIcon pendingPayment" aria-hidden="true">$</span><p className="eyebrow">ÚLTIMA ETAPA</p><h2>Ative sua assinatura</h2><p className="subscriptionLead">Sua conta foi criada. Para acessar o painel e iniciar os lembretes, falta confirmar a assinatura mensal.</p>{params.erro && <p className="formMessage error">{params.erro}</p>}<div className="subscriptionSummary"><div><span>Plano</span><strong>{selectedPlan}</strong></div><div><span>Cobrança</span><strong>Mensal</strong></div><div><span>Conta</span><strong>{user.email}</strong></div></div><form action={simulateSubscriptionPayment}><button className="minimalLoginSubmit wide">Simular pagamento e ativar</button></form><p className="subscriptionHelp">Esta etapa simula o checkout do MVP. Na versão comercial, o pagamento será processado por um provedor seguro.</p><form action={signOut}><button className="subscriptionLogout">Sair e concluir depois</button></form></section></main>;
}
