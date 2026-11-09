import { redirect } from "next/navigation";
import { renewDemoSubscription, signOut } from "@/app/auth/actions";
import { getDemoSubscription } from "@/lib/auth/demo-session";

export default async function ExpiredSubscriptionPage() {
  const subscription = await getDemoSubscription();
  if (subscription === "active") redirect("/dashboard");
  if (subscription !== "expired") redirect("/login");

  return <main className="subscriptionPage">
    <header className="minimalLoginBrand"><span className="minimalLoginMark" aria-hidden="true">✓</span><h1>Bem Lembrado</h1><p>Rotina e acompanhamento de cuidados</p></header>
    <section className="subscriptionCard"><span className="subscriptionIcon" aria-hidden="true">!</span><p className="eyebrow">ASSINATURA SUSPENSA</p><h2>Sua assinatura venceu</h2><p className="subscriptionLead">Seu plano venceu em 5 de novembro de 2026. Seus dados e lembretes continuam preservados, mas o acesso ao painel e o envio de novas mensagens estão temporariamente suspensos.</p><div className="subscriptionSummary"><div><span>Plano</span><strong>Família</strong></div><div><span>Situação</span><strong>Pagamento pendente</strong></div><div><span>Dados</span><strong>Preservados</strong></div></div><div className="subscriptionActions"><form action={renewDemoSubscription}><button className="minimalLoginSubmit">Simular renovação</button></form><a className="secondary buttonLink" href="mailto:suporte@bemlembrado.demo">Falar com o suporte</a></div><p className="subscriptionHelp">Na versão comercial, a renovação levará ao checkout seguro do provedor de pagamento.</p><form action={signOut}><button className="subscriptionLogout">Sair e usar outra conta</button></form></section>
  </main>;
}
