import type { ReactNode } from "react";
import { signOut } from "@/app/auth/actions";
import { toggleMockMode } from "@/app/mock/actions";
import { isMockMode } from "@/lib/mock/data";

type IconName = "home" | "people" | "calendar" | "history" | "bot" | "pulse" | "whatsapp" | "logout";

function Icon({ name }: { name: IconName }) {
  const paths: Record<IconName, ReactNode> = {
    home: <><path d="m3 11 9-8 9 8"/><path d="M5 10v10h14V10"/><path d="M9 20v-6h6v6"/></>,
    people: <><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></>,
    calendar: <><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/><path d="m9 16 2 2 4-5"/></>,
    history: <><path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5M12 7v5l3 2"/></>,
    bot: <><rect x="4" y="6" width="16" height="13" rx="3"/><path d="M12 2v4M8 11h.01M16 11h.01M8 15h8"/></>,
    pulse: <><path d="M3 12h4l2-7 4 14 2-7h6"/><circle cx="12" cy="12" r="10"/></>,
    whatsapp: <><path d="M21 11.5a8.4 8.4 0 0 1-9 8.4 9.6 9.6 0 0 1-3.8-.9L3 21l1.8-5A8.5 8.5 0 1 1 21 11.5Z"/><path d="M8.2 8.1c.3 3 2.6 5.4 5.7 5.8M14 13.9l1.4-1.2M8.2 8.1l1.4-1.2"/></>,
    logout: <><path d="M10 17l5-5-5-5M15 12H3"/><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/></>,
  };
  return <svg className="navIcon" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{paths[name]}</svg>;
}

export async function AppShell({ email, active, children }: { email: string; active: string; children: ReactNode }) {
  const mock = await isMockMode();
  const links: Array<[string, string, IconName]> = [
    ["/dashboard", "Visão geral", "home"], ["/pessoas", "Pessoas assistidas", "people"],
    ["/lembretes", "Lembretes", "calendar"], ["/historico", "Histórico", "history"],
    ["/simulador", "Simulador do bot", "bot"], ["/diagnostico", "Diagnóstico", "pulse"],
    ["/whatsapp", "WhatsApp", "whatsapp"],
  ];
  const initials = email.slice(0, 2).toUpperCase();

  return <main className="shell">
    <aside className="sidebar">
      <div className="brand"><span className="brandMark" aria-hidden="true"><span>✓</span></span><span className="brandText"><strong>Bem Lembrado</strong><small>Cuidado em cada momento</small></span></div>
      <div className="navLabel">MENU PRINCIPAL</div>
      <nav aria-label="Navegação principal">{links.map(([href, label, icon]) => <a key={href} className={`navItem ${active === href ? "active" : ""}`} href={href}><Icon name={icon}/><span>{label}</span>{active === href && <i aria-hidden="true"/>}</a>)}</nav>
      <div className="sidebarTools"><p>AMBIENTE</p><form action={toggleMockMode}><button className={`mockToggle ${mock ? "on" : ""}`} aria-pressed={mock}><span className="mockSwitch"/><span><strong>Dados de exemplo</strong><small>{mock ? "Demonstração ativa" : "Visualizar cenário pronto"}</small></span></button></form></div>
      <div className="sidebarAccount"><span className="accountAvatar">{initials}</span><span className="accountInfo"><strong>Responsável</strong><small>{email}</small></span><form action={signOut}><button aria-label="Sair da conta" title="Sair"><Icon name="logout"/></button></form></div>
    </aside>
    <section className={`content ${mock ? "mockMode" : ""}`}>
      <div className="mobileBrand"><span className="brandMark"><span>✓</span></span><strong>Bem Lembrado</strong></div>
      {mock && <div className="mockNotice"><span className="mockNoticeIcon">✦</span><div><strong>Modo demonstração ativo</strong><span>Você está vendo dados de exemplo. Nada será salvo ou enviado.</span></div></div>}
      <div className="pageCanvas">{children}</div>
    </section>
  </main>;
}
