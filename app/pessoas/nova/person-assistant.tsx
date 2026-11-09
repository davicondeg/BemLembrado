"use client";

import { FormEvent, useState } from "react";
import { createAssistedPerson } from "../actions";

type Message = { role: "user" | "assistant"; text: string };
type Draft = { fullName: string; phone: string; contactName: string; contactPhone: string; consentConfirmed: boolean };
type AssistantResponse = { reply: string; complete: boolean; draft: Draft; error?: string };

const initialMessages: Message[] = [{
  role: "assistant",
  text: "Vamos cadastrar uma pessoa para receber os lembretes. Qual é o nome completo da pessoa assistida?",
}];

function displayPhone(value: string) {
  const digits = value.replace(/\D/g, "").replace(/^55(?=\d{10,11}$)/, "");
  if (digits.length === 11) return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  if (digits.length === 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  return value;
}

export function PersonAssistant() {
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [input, setInput] = useState("");
  const [conversationDraft, setConversationDraft] = useState<Draft | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function send(event: FormEvent) {
    event.preventDefault();
    const text = input.trim();
    if (!text || loading) return;
    if (/^limpar\s+(?:a\s+)?conversa[.!?]*$/i.test(text)) {
      setMessages(initialMessages); setConversationDraft(null); setDraft(null); setInput(""); setError("");
      return;
    }
    const next = [...messages, { role: "user" as const, text }];
    setMessages(next); setInput(""); setLoading(true); setError(""); setDraft(null);
    try {
      const response = await fetch("/api/people/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: next, draft: conversationDraft }),
      });
      const result = await response.json() as AssistantResponse;
      if (!response.ok) throw new Error(result.error || "Não foi possível conversar com o assistente.");
      setMessages((current) => [...current, { role: "assistant", text: result.reply }]);
      setConversationDraft(result.draft);
      setDraft(result.complete ? result.draft : null);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Não foi possível conversar com o assistente.");
    } finally {
      setLoading(false);
    }
  }

  return <div className="assistantLayout personAssistantLayout">
    <section className="card assistantChat">
      <div className="assistantIntro"><span>✦</span><div><strong>Assistente de cadastro</strong><p>Responda uma pergunta por vez e revise tudo antes de salvar.</p></div></div>
      <div className="chatMessages" aria-live="polite">
        {messages.map((item, index) => <div className={`chatBubble ${item.role}`} key={index}>{item.text}</div>)}
        {loading && <div className="chatBubble assistant loadingBubble">Organizando o cadastro…</div>}
      </div>
      {error && <p className="formMessage error">{error}</p>}
      <form className="chatComposer" onSubmit={send}>
        <textarea value={input} onChange={(event) => setInput(event.target.value)} rows={2} maxLength={500} placeholder="Digite sua resposta aqui…" />
        <button disabled={loading || !input.trim()}>Enviar</button>
      </form>
      <p className="assistantPrivacy">Os dados informados são enviados ao Gemini somente para organizar este cadastro. Digite “limpar conversa” para recomeçar.</p>
    </section>

    <aside className="card assistantReview">
      <p className="eyebrow">REVISÃO OBRIGATÓRIA</p>
      {!draft ? <div className="assistantWaiting"><span>☷</span><strong>O cadastro aparecerá aqui</strong><p>O assistente perguntará os dados da pessoa, do responsável e pedirá a autorização.</p></div> : <>
        <h2>Confira antes de cadastrar</h2>
        <dl>
          <div><dt>Pessoa assistida</dt><dd>{draft.fullName}</dd></div>
          <div><dt>WhatsApp da pessoa</dt><dd>{displayPhone(draft.phone)}</dd></div>
          <div><dt>Contato responsável</dt><dd>{draft.contactName}</dd></div>
          <div><dt>WhatsApp do responsável</dt><dd>{displayPhone(draft.contactPhone)}</dd></div>
          <div><dt>Autorização</dt><dd>Confirmada pelos participantes</dd></div>
        </dl>
        <form action={createAssistedPerson}>
          <input type="hidden" name="fullName" value={draft.fullName} />
          <input type="hidden" name="phone" value={draft.phone} />
          <input type="hidden" name="contactName" value={draft.contactName} />
          <input type="hidden" name="contactPhone" value={draft.contactPhone} />
          <input type="hidden" name="consent" value="on" />
          <button className="primary wide">Confirmar e cadastrar</button>
        </form>
        <button className="assistantChange" type="button" onClick={() => setDraft(null)}>Quero corrigir uma informação</button>
      </>}
    </aside>
  </div>;
}
