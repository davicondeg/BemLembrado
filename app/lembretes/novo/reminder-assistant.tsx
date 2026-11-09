"use client";

import { FormEvent, useState } from "react";
import { createReminder } from "../actions";

type Person = { id: string; full_name: string; authorized_contacts: { id: string; full_name: string }[] };
type Message = { role: "user" | "assistant"; text: string };
type Draft = { personId: string; kind: string; title: string; message: string; date: string; time: string; repeat: boolean; weekdays: string[]; recurrenceConfirmed: boolean; confirmationRequired: boolean; timeout: number; maxAttempts: number; repeatInterval: number; escalationMode: string; alertContactId: string; responsePlanConfirmed: boolean };
type AssistantResponse = { reply: string; complete: boolean; draft: Draft };
const initialMessages: Message[] = [{ role: "assistant", text: "Conte qual lembrete você deseja criar. Por exemplo: “Lembre a Dona Luzia de tomar o medicamento às 8h, de segunda a sexta”." }];
const dayNames: Record<string, string> = { MO: "segunda", TU: "terça", WE: "quarta", TH: "quinta", FR: "sexta", SA: "sábado", SU: "domingo" };
const escalationNames: Record<string, string> = { record: "apenas registrar", notify: "avisar o responsável", priority: "enviar alerta prioritário" };

export function ReminderAssistant({ people }: { people: Person[] }) {
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [input, setInput] = useState(""); const [conversationDraft, setConversationDraft] = useState<Draft | null>(null); const [draft, setDraft] = useState<Draft | null>(null); const [loading, setLoading] = useState(false); const [error, setError] = useState("");
  async function send(event: FormEvent) {
    event.preventDefault(); const text = input.trim(); if (!text || loading) return;
    if (/^limpar\s+(?:a\s+)?conversa[.!?]*$/i.test(text)) {
      setMessages(initialMessages); setConversationDraft(null); setDraft(null); setInput(""); setError("");
      return;
    }
    const next = [...messages, { role: "user" as const, text }]; setMessages(next); setInput(""); setLoading(true); setError("");
    try {
      const response = await fetch("/api/reminders/assistant", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ messages: next, draft: conversationDraft }) });
      const result = await response.json() as AssistantResponse & { error?: string };
      if (!response.ok) throw new Error(result.error || "Não foi possível conversar com o assistente.");
      setMessages((current) => [...current, { role: "assistant", text: result.reply }]); setConversationDraft(result.draft); setDraft(result.complete ? result.draft : null);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Não foi possível conversar com o assistente."); } finally { setLoading(false); }
  }
  const person = people.find((item) => item.id === draft?.personId); const contact = person?.authorized_contacts.find((item) => item.id === draft?.alertContactId);
  return <div className="assistantLayout"><section className="card assistantChat"><div className="assistantIntro"><span>✦</span><div><strong>Assistente de lembretes</strong><p>Descreva com suas palavras. Você poderá revisar tudo antes de salvar.</p></div></div><div className="chatMessages" aria-live="polite">{messages.map((item, index) => <div className={`chatBubble ${item.role}`} key={index}>{item.text}</div>)}{loading && <div className="chatBubble assistant loadingBubble">Organizando o lembrete…</div>}</div>{error && <p className="formMessage error">{error}</p>}<form className="chatComposer" onSubmit={send}><textarea value={input} onChange={(event) => setInput(event.target.value)} rows={2} maxLength={1000} placeholder="Digite o lembrete aqui…"/><button disabled={loading || !input.trim()}>Enviar</button></form><p className="assistantPrivacy">A mensagem é enviada ao Gemini apenas para organizar este lembrete. Dados médicos sensíveis não devem ser incluídos além do necessário.</p></section>
    <aside className="card assistantReview"><p className="eyebrow">REVISÃO OBRIGATÓRIA</p>{!draft ? <div className="assistantWaiting"><span>☷</span><strong>O rascunho aparecerá aqui</strong><p>O assistente perguntará também sobre repetição, confirmação e ausência de resposta.</p></div> : <><h2>Confira antes de agendar</h2><dl><div><dt>Pessoa</dt><dd>{person?.full_name}</dd></div><div><dt>Lembrete</dt><dd>{draft.title}</dd></div><div><dt>Mensagem</dt><dd>{draft.message}</dd></div><div><dt>Quando</dt><dd>{draft.date.split("-").reverse().join("/")} às {draft.time}</dd></div><div><dt>Repetição</dt><dd>{draft.repeat ? draft.weekdays.map((day) => dayNames[day]).join(", ") : "Envio único, sem repetição"}</dd></div><div><dt>Confirmação e novas tentativas</dt><dd>{draft.confirmationRequired ? `Solicitar confirmação · ${draft.maxAttempts} tentativa(s) · esperar ${draft.repeatInterval} min` : "Não solicitar confirmação"}</dd></div>{draft.confirmationRequired && <div><dt>Se não houver resposta</dt><dd>{escalationNames[draft.escalationMode]}{contact ? ` (${contact.full_name})` : ""}</dd></div>}</dl><form action={createReminder}>{Object.entries({ personId: draft.personId, kind: draft.kind, title: draft.title, message: draft.message, date: draft.date, time: draft.time, timeout: draft.timeout, maxAttempts: draft.maxAttempts, repeatInterval: draft.repeatInterval, escalationMode: draft.escalationMode, alertContactId: draft.alertContactId }).map(([name, value]) => <input key={name} type="hidden" name={name} value={String(value)}/>)}{draft.repeat && <input type="hidden" name="repeat" value="on"/>}{draft.weekdays.map((day) => <input key={day} type="hidden" name="weekdays" value={day}/>)}{draft.confirmationRequired && <input type="hidden" name="confirmationRequired" value="on"/>}<button className="primary wide">Confirmar e agendar</button></form><button className="assistantChange" type="button" onClick={() => setDraft(null)}>Quero fazer uma alteração</button></>}</aside></div>;
}
