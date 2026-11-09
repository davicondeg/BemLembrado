"use client";

import { useState } from "react";

type Contact = { id: string; full_name: string; personName: string };
type EscalationMode = "record" | "notify" | "priority";

const options: Array<{ value: EscalationMode; title: string; description: string }> = [
  { value: "record", title: "Apenas registrar", description: "Marca como não confirmado no histórico, sem enviar mensagem ao responsável." },
  { value: "notify", title: "Avisar o responsável", description: "Envia um aviso normal depois da última tentativa sem resposta." },
  { value: "priority", title: "Alerta prioritário", description: "Envia uma mensagem destacada recomendando contato com a pessoa assistida." },
];

export function EscalationOptions({ contacts }: { contacts: Contact[] }) {
  const [mode, setMode] = useState<EscalationMode>("notify");

  return (
    <div className="escalationSettings">
      <div className="escalationOptions" role="radiogroup" aria-label="Conduta após a última tentativa">
        {options.map((option) => (
          <label key={option.value} className="escalationOption">
            <input name="escalationMode" type="radio" value={option.value} checked={mode === option.value} onChange={() => setMode(option.value)} />
            <span><strong>{option.title}</strong><small>{option.description}</small></span>
          </label>
        ))}
      </div>
      {mode !== "record" && (
        <label className="escalationContact">Quem deverá receber a mensagem?
          <select name="alertContactId" defaultValue="" required>
            <option value="">Selecione o responsável</option>
            {contacts.map((contact) => <option key={contact.id} value={contact.id}>{contact.full_name} — {contact.personName}</option>)}
          </select>
        </label>
      )}
      <p className="fieldHelp">O sistema informa somente que não houve resposta. Isso não significa que a atividade não foi realizada ou que existe uma emergência.</p>
    </div>
  );
}
