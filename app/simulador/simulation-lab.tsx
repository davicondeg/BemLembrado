"use client";

import { FormEvent, useMemo, useRef, useState } from "react";

type Role = "elder" | "caregiver" | "bot";
type Channel = "elder" | "caregiver";
type EscalationMode = "record" | "notify" | "priority";
type Message = { id: number; channel: Channel; role: Role; text: string; time: string };
type TimelineEvent = { id: number; tone: "info" | "success" | "warning"; text: string; time: string };

const initialMessages: Message[] = [
  { id: 1, channel: "elder", role: "bot", text: "Olá, Dona Lúcia! Estou por aqui para ajudar com seus lembretes. 💚", time: "08:00" },
  { id: 2, channel: "caregiver", role: "bot", text: "Bom dia, Ana! Acompanharei os lembretes de Dona Lúcia e aviso você se ela precisar de ajuda.", time: "08:00" },
];

const currentTime = () => new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" }).format(new Date());

function Phone({ channel, title, subtitle, messages, onSend }: { channel: Channel; title: string; subtitle: string; messages: Message[]; onSend: (text: string) => void }) {
  const [text, setText] = useState("");
  function submit(event: FormEvent) { event.preventDefault(); if (!text.trim()) return; onSend(text.trim()); setText(""); }
  return <article className="simPhone">
    <div className="phoneSpeaker" />
    <header className="phoneHeader"><button type="button" aria-label="Voltar">‹</button><span className="phoneAvatar">BL</span><div><strong>{title}</strong><small><i /> {subtitle}</small></div><span className="phoneMenu">•••</span></header>
    <div className="phoneChat" aria-live="polite"><div className="chatDate">HOJE</div>{messages.map((message) => <div key={message.id} className={`chatBubble ${message.role === "bot" ? "received" : "sent"}`}><p>{message.text}</p><time>{message.time}{message.role !== "bot" && " ✓✓"}</time></div>)}</div>
    <form className="phoneComposer" onSubmit={submit}><button type="button" aria-label="Adicionar">＋</button><input value={text} onChange={(event) => setText(event.target.value)} placeholder={channel === "elder" ? "Responder como Dona Lúcia" : "Responder como Ana"} aria-label="Mensagem"/><button className="sendMessage" aria-label="Enviar">➤</button></form>
    <div className="phoneHome" />
  </article>;
}

export function SimulationLab({ reminderTitle = "Remédio da manhã" }: { reminderTitle?: string }) {
  const [messages, setMessages] = useState(initialMessages);
  const [events, setEvents] = useState<TimelineEvent[]>([{ id: 1, tone: "info", text: "Simulação iniciada", time: "08:00" }]);
  const [status, setStatus] = useState("Aguardando cenário");
  const [escalationMode, setEscalationMode] = useState<EscalationMode>("notify");
  const id = useRef(10);
  const elderMessages = useMemo(() => messages.filter((item) => item.channel === "elder"), [messages]);
  const caregiverMessages = useMemo(() => messages.filter((item) => item.channel === "caregiver"), [messages]);
  function nextId() { id.current += 1; return id.current; }
  function addMessage(channel: Channel, role: Role, text: string) { setMessages((items) => [...items, { id: nextId(), channel, role, text, time: currentTime() }]); }
  function addEvent(text: string, tone: TimelineEvent["tone"] = "info") { setEvents((items) => [...items, { id: nextId(), text, tone, time: currentTime() }]); }
  function send(channel: Channel, text: string) {
    addMessage(channel, channel, text);
    const normalized = text.toLocaleLowerCase("pt-BR");
    if (channel === "elder") {
      if (/tomei|já tomei|feito|sim/.test(normalized)) {
        addMessage("elder", "bot", `Perfeito! Marquei “${reminderTitle}” como concluído. Obrigado por confirmar. ✅`);
        addMessage("caregiver", "bot", `Dona Lúcia confirmou o lembrete “${reminderTitle}”. Está tudo certo. ✅`);
        addEvent("Confirmação recebida da pessoa assistida", "success"); setStatus("Confirmado");
      } else if (/ajuda|não consigo|nao consigo|esqueci/.test(normalized)) {
        addMessage("elder", "bot", "Tudo bem, Dona Lúcia. Já avisei a Ana para ajudar você.");
        addMessage("caregiver", "bot", `Dona Lúcia pediu ajuda com “${reminderTitle}”. Você pode entrar em contato com ela?`);
        addEvent("Pedido de ajuda encaminhado ao responsável", "warning"); setStatus("Precisa de ajuda");
      } else addMessage("elder", "bot", "Entendi. Quando concluir, responda “Já tomei”. Se precisar, escreva “Preciso de ajuda”.");
    } else {
      if (/confirmou|tomou|status|situação|situacao/.test(normalized)) addMessage("caregiver", "bot", `O lembrete “${reminderTitle}” está com o status: ${status}.`);
      else if (/lembrar|lembrete|avisar/.test(normalized)) { addMessage("caregiver", "bot", "Certo. Vou enviar o lembrete para Dona Lúcia agora."); runReminder(false); }
      else addMessage("caregiver", "bot", "Posso informar o status ou enviar um lembrete para Dona Lúcia. O que você prefere?");
    }
  }
  function runReminder(record = true) {
    addMessage("elder", "bot", `Bom dia, Dona Lúcia! Está na hora de: ${reminderTitle}. Quando terminar, responda “Já tomei”.`);
    addMessage("caregiver", "bot", `O lembrete “${reminderTitle}” foi enviado para Dona Lúcia. Aguardando confirmação.`);
    if (record) addEvent("Lembrete enviado para a pessoa assistida");
    setStatus("Aguardando confirmação");
  }
  function runTimeout() {
    addEvent("Prazo de resposta encerrado", "warning");
    addMessage("elder", "bot", `Oi, Dona Lúcia. Ainda não recebi sua confirmação sobre “${reminderTitle}”. Você conseguiu concluir?`);
    addEvent("Nova tentativa enviada para a pessoa assistida", "warning");
    addEvent("Último prazo encerrado sem confirmação", "warning");
    if (escalationMode === "notify") {
      addMessage("caregiver", "bot", `Bem Lembrado: não recebemos resposta de Dona Lúcia sobre “${reminderTitle}” após 2 tentativas. Recomendamos verificar se está tudo bem.`);
      addEvent("Responsável avisado sobre a ausência de resposta", "warning");
      setStatus("Responsável avisado");
    } else if (escalationMode === "priority") {
      addMessage("caregiver", "bot", `⚠️ Alerta prioritário: não recebemos resposta de Dona Lúcia sobre “${reminderTitle}” após 2 tentativas. Entre em contato para verificar se está tudo bem.`);
      addEvent("Alerta prioritário enviado ao responsável", "warning");
      setStatus("Alerta prioritário");
    } else {
      addEvent("Ausência de resposta registrada no histórico", "info");
      setStatus("Não confirmado");
    }
  }
  function reset() { setMessages(initialMessages); setEvents([{ id: nextId(), tone: "info", text: "Simulação reiniciada", time: currentTime() }]); setStatus("Aguardando cenário"); }

  return <>
    <section className="simulationToolbar"><div><span className="liveDot"/><strong>Ambiente seguro</strong><small>Nenhuma mensagem será enviada pelo WhatsApp</small></div><div className="scenarioButtons"><span>Cenários rápidos:</span><button onClick={() => runReminder()}>Enviar lembrete</button><button onClick={runTimeout}>Sem resposta</button><button onClick={() => send("elder", "Já tomei")}>Confirmar</button><button className="resetScenario" onClick={reset}>Reiniciar</button></div></section>
    <section className="simulationEscalation" aria-label="Comportamento na ausência de resposta"><div><strong>Se Dona Lúcia não responder</strong><small>Escolha a regra que deseja visualizar na simulação.</small></div><div role="radiogroup">{([['record','Apenas registrar'],['notify','Avisar responsável'],['priority','Alerta prioritário']] as const).map(([value,label]) => <button key={value} type="button" role="radio" aria-checked={escalationMode === value} className={escalationMode === value ? "active" : ""} onClick={() => setEscalationMode(value)}>{label}</button>)}</div></section>
    <div className="simulationStage">
      <div className="phoneColumn"><div className="phoneRole"><span>RESPONSÁVEL</span><strong>Ana acompanha e recebe alertas</strong></div><Phone channel="caregiver" title="Bem Lembrado" subtitle="bot de acompanhamento" messages={caregiverMessages} onSend={(text) => send("caregiver", text)}/></div>
      <div className="simulationFlow"><span>conversa</span><i>⇄</i><span>sincronizada</span></div>
      <div className="phoneColumn"><div className="phoneRole elder"><span>PESSOA ASSISTIDA</span><strong>Dona Lúcia recebe os lembretes</strong></div><Phone channel="elder" title="Bem Lembrado" subtitle="assistente de lembretes" messages={elderMessages} onSend={(text) => send("elder", text)}/></div>
      <aside className="simulationEvents"><div className="eventHeading"><div><p className="eyebrow">BASTIDORES</p><h2>Linha de eventos</h2></div><span className={`simulationStatus ${status === "Confirmado" ? "ok" : ""}`}>{status}</span></div><p className="eventHelp">Aqui você vê o que o sistema entendeu em cada etapa.</p><ol>{events.map((item) => <li key={item.id} className={item.tone}><i/><div><strong>{item.text}</strong><time>{item.time}</time></div></li>)}</ol></aside>
    </div>
  </>;
}
