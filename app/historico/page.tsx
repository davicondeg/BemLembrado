import { AppShell } from "@/components/app-shell";
import { requireUser } from "@/lib/auth/require-user";
import { isMockMode, mockHistory } from "@/lib/mock/data";

export default async function History() {
  const { user, supabase } = await requireUser();
  const mock = await isMockMode();
  const { data: storedData } = mock ? { data: null } : await supabase.from("reminders").select("id,title,status,scheduled_for,sent_at,last_error,assisted_people(full_name)").in("status", ["sent","failed","cancelled","confirmed","not_done","expired"]).order("updated_at", { ascending: false }).limit(100);
  const data = mock ? mockHistory : storedData;
  const labels: Record<string, string> = { sent: "Enviado", confirmed: "Confirmado", not_done: "Não confirmado", failed: "Não foi possível enviar", cancelled: "Cancelado", expired: "Prazo encerrado" };
  return <AppShell email={user.email || "Responsável"} active="/historico"><header className="sectionHeader"><div><p className="eyebrow">ACOMPANHAMENTO</p><h1>O que aconteceu</h1><p>Acompanhe os lembretes enviados, confirmados e aqueles que precisam de atenção.</p></div></header><section className="card tableCard">{!data?.length ? <div className="emptyState"><strong>Nenhuma atividade por enquanto</strong><p>Os resultados dos lembretes aparecerão aqui.</p></div> : <div className="dataTable">{data.map((item) => <article className="tableRow historyRow" key={item.id}><div><strong>{item.title}</strong><span>{item.assisted_people?.[0]?.full_name || "Pessoa assistida"}{item.last_error ? " · Verifique o envio" : ""}</span></div><time>{new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" }).format(new Date(item.sent_at || item.scheduled_for))}</time><span className={`badge ${item.status === "failed" || item.status === "not_done" ? "pending" : item.status === "sent" || item.status === "confirmed" ? "success" : "scheduled"}`}>{labels[item.status] || "Atualizado"}</span></article>)}</div>}</section></AppShell>;
}
