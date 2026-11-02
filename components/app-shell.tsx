import type { ReactNode } from "react";
import { signOut } from "@/app/auth/actions";
import { toggleMockMode } from "@/app/mock/actions";
import { isMockMode } from "@/lib/mock/data";

export async function AppShell({ email, active, children }: { email: string; active: string; children: ReactNode }) {
  const mock = await isMockMode();
  const links = [["/dashboard", "Início"], ["/pessoas", "Pessoas assistidas"], ["/lembretes", "Lembretes"], ["/historico", "Histórico"], ["/simulador", "Simulador do bot"], ["/diagnostico", "Diagnóstico"], ["/whatsapp", "WhatsApp"]];
  return <main className="shell">
    <aside className="sidebar"><div className="brand"><span className="brandMark">✓</span><span>Bem Lembrado</span></div><nav aria-label="Navegação principal">{links.map(([href, label]) => <a key={href} className={`navItem ${active === href ? "active" : ""}`} href={href}>{label}</a>)}</nav><form action={toggleMockMode}><button className={`mockToggle ${mock ? "on" : ""}`}><span className="mockSwitch"/>Dados de exemplo</button></form><div className="sidebarAccount"><span>{email}</span><form action={signOut}><button>Sair</button></form></div></aside>
    <section className={`content ${mock ? "mockMode" : ""}`}>{mock && <div className="mockNotice"><strong>Modo demonstração ativo</strong><span>Os dados exibidos são exemplos e não foram gravados no Supabase.</span></div>}{children}</section>
  </main>;
}
