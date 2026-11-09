"use client";

import { archiveReminder, cancelReminder, deleteReminder, pauseReminder, restoreReminder, resumeReminder } from "./actions";

type Props = {
  id: string;
  title: string;
  status: string;
  recurring: boolean;
  archived: boolean;
};

function ActionForm({ id, action, label, danger = false, confirmMessage }: { id: string; action: (formData: FormData) => void; label: string; danger?: boolean; confirmMessage?: string }) {
  return <form action={action} onSubmit={(event) => { if (confirmMessage && !window.confirm(confirmMessage)) event.preventDefault(); }}>
    <input type="hidden" name="id" value={id} />
    <button type="submit" className={danger ? "danger" : ""}>{label}</button>
  </form>;
}

export function ReminderActions({ id, title, status, recurring, archived }: Props) {
  if (archived) return <details className="rowActions"><summary aria-label={`Ações para ${title}`}>•••</summary><div><ActionForm id={id} action={restoreReminder} label="Restaurar para a lista" /><ActionForm id={id} action={deleteReminder} label="Excluir permanentemente" danger confirmMessage={`Excluir permanentemente o lembrete “${title}”? O histórico relacionado também será removido.`} /></div></details>;
  const canStop = !["queued", "cancelled"].includes(status);
  return <details className="rowActions"><summary aria-label={`Ações para ${title}`}>•••</summary><div>
    {recurring && status === "scheduled" && <ActionForm id={id} action={pauseReminder} label="Pausar recorrência" />}
    {recurring && status === "paused" && <ActionForm id={id} action={resumeReminder} label="Retomar recorrência" />}
    {canStop && status !== "paused" && <ActionForm id={id} action={cancelReminder} label="Cancelar lembrete" danger confirmMessage={`Cancelar o lembrete “${title}”?`} />}
    {status !== "queued" && <ActionForm id={id} action={archiveReminder} label="Arquivar" />}
    {status === "queued" && <p>Aguarde o processamento da mensagem para gerenciar este lembrete.</p>}
  </div></details>;
}
