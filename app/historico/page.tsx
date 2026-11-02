import { AppShell } from "@/components/app-shell";
import { requireUser } from "@/lib/auth/require-user";
import { isMockMode, mockHistory } from "@/lib/mock/data";

export default async function History() {
  const { user, supabase } = await requireUser();
  const mock = await isMockMode();
  const { data: storedData } = mock ? { data: null } : await supabase.from("reminders").select("id,title,status,scheduled_for,sent_at,last_error,assisted_people(full_name)").in("status", ["sent","failed","cancelled","confirmed","not_done","expired"]).order("updated_at", { ascending: false }).limit(100);
  const data = mock ? mockHistory : storedData;
  return <AppShell email={user.email || "Responsável"} active="/historico"><header className="sectionHeader"><div><p className="eyebrow">ACOMPANHAMENTO</p><h1>Histórico</h1><p>Consulte envios, cancelamentos e falhas registrados no Supabase.</p></div></header><section className="card tableCard">{!data?.length ? <div className="emptyState"><strong>O histórico ainda está vazio</strong><p>Os resultados dos lembretes aparecerão aqui.</p></div> : <div className="dataTable">{data.map((item) => <article className="tableRow historyRow" key={item.id}><div><strong>{item.title}</strong><span>{item.assisted_people?.[0]?.full_name || "Usuário do bot"}{item.last_error ? ` · ${item.last_error}` : ""}</span></div><time>{new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" }).format(new Date(item.sent_at || item.scheduled_for))}</time><span className={`badge ${item.status === "failed" ? "pending" : item.status === "sent" || item.status === "confirmed" ? "success" : "scheduled"}`}>{item.status}</span></article>)}</div>}</section></AppShell>;
}
