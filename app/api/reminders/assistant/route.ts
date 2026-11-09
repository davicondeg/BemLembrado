import { createClient } from "@/lib/supabase/server";

type ChatMessage = { role: "user" | "assistant"; text: string };
type AssistantDraft = Record<string, unknown>;

function localDate(dayOffset = 0) {
  const date = new Date(Date.now() + dayOffset * 86_400_000);
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(date);
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${value.year}-${value.month}-${value.day}`;
}

function mergeDraft(previous: AssistantDraft | null | undefined, current: AssistantDraft | null | undefined) {
  if (!previous) return current || {};
  if (!current) return previous;
  const merged = { ...previous, ...current };
  for (const [key, value] of Object.entries(current)) {
    if (value === "" || value === null || value === undefined || (Array.isArray(value) && value.length === 0)) merged[key] = previous[key];
  }
  return merged;
}

const schema = {
  type: "object",
  required: ["reply", "complete", "missingFields", "draft"],
  properties: {
    reply: { type: "string", description: "Resposta curta e acolhedora em português brasileiro." },
    complete: { type: "boolean" },
    missingFields: { type: "array", items: { type: "string" } },
    draft: {
      type: "object",
      required: ["personId", "kind", "title", "message", "date", "time", "repeat", "weekdays", "recurrenceConfirmed", "confirmationRequired", "timeout", "maxAttempts", "repeatInterval", "escalationMode", "alertContactId", "responsePlanConfirmed"],
      properties: {
        personId: { type: "string" }, kind: { type: "string", enum: ["medication", "appointment", "task"] },
        title: { type: "string" }, message: { type: "string" }, date: { type: "string" }, time: { type: "string" },
        repeat: { type: "boolean" }, weekdays: { type: "array", items: { type: "string", enum: ["MO", "TU", "WE", "TH", "FR", "SA", "SU"] } }, recurrenceConfirmed: { type: "boolean" },
        confirmationRequired: { type: "boolean" }, timeout: { type: "integer" }, maxAttempts: { type: "integer" }, repeatInterval: { type: "integer" },
        escalationMode: { type: "string", enum: ["record", "notify", "priority"] }, alertContactId: { type: "string" }, responsePlanConfirmed: { type: "boolean" },
      },
    },
  },
};

export async function POST(request: Request) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return Response.json({ error: "Gemini não configurado." }, { status: 503 });
  const body = await request.json().catch(() => null) as { messages?: ChatMessage[]; draft?: AssistantDraft | null } | null;
  const messages = body?.messages?.filter((item) => ["user", "assistant"].includes(item.role) && typeof item.text === "string").slice(-10);
  if (!messages?.length || messages.at(-1)?.role !== "user" || messages.at(-1)!.text.length > 1000) return Response.json({ error: "Mensagem inválida." }, { status: 400 });

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Sessão expirada." }, { status: 401 });
  const { data: people, error } = await supabase.from("assisted_people").select("id,full_name,authorized_contacts(id,full_name,is_primary)").eq("active", true).is("archived_at", null).order("full_name");
  if (error) return Response.json({ error: "Não foi possível consultar as pessoas cadastradas." }, { status: 500 });
  if (!people?.length) return Response.json({ error: "Cadastre uma pessoa assistida antes de criar lembretes." }, { status: 400 });

  const now = new Date();
  const localNow = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "full", timeStyle: "short" }).format(now);
  const directory = people.map((person) => ({ id: person.id, name: person.full_name, contacts: person.authorized_contacts.map((contact) => ({ id: contact.id, name: contact.full_name, primary: contact.is_primary })) }));
  const draftInstruction = `Rascunho parcial já obtido: ${JSON.stringify(body?.draft || {})}. Preserve todos os dados válidos desse rascunho e altere somente o que o usuário corrigir.`;
  const systemInstruction = `Você ajuda um responsável a preencher um lembrete, sem dar orientação médica. Hoje é ${localNow}, fuso America/Sao_Paulo. Pessoas e contatos permitidos: ${JSON.stringify(directory)}. Faça apenas uma pergunta por vez. Primeiro reúna pessoa, título/tarefa, data e horário. NUNCA aceite uma data passada nem um horário que já passou no dia atual; explique que o horário passou e peça uma nova data ou hora futura. Depois é OBRIGATÓRIO perguntar explicitamente se o lembrete será enviado uma única vez ou se deve repetir; só marque recurrenceConfirmed=true quando o usuário responder essa decisão. Para repetição, use códigos MO,TU,WE,TH,FR,SA,SU e pergunte os dias quando necessário. Depois é OBRIGATÓRIO perguntar se deve solicitar confirmação e, se não houver resposta, quantas tentativas fazer, quanto esperar entre elas e se deve apenas registrar, avisar o responsável ou enviar alerta prioritário; só marque responsePlanConfirmed=true depois que o usuário confirmar esse plano. Você pode oferecer os padrões de 2 tentativas, 15 minutos entre tentativas e aviso comum, mas nunca assuma silenciosamente. Se o usuário disser algo ambíguo como "repetir duas vezes", pergunte se significa repetir em dias/horários ou fazer duas tentativas sem resposta. Interprete hoje, amanhã e dias da semana usando a data informada. Nunca invente pessoa ou contato. Se repetir e a data inicial não cair em um dia escolhido, mantenha a data solicitada; o sistema alinhará. Se o plano escolhido for avisar e houver contato primário, use seu ID; sem contato, use escalationMode=record e alertContactId vazio e explique. "Alerta prioritário" somente quando o usuário pedir explicitamente. A mensagem deve ser gentil e objetiva, sem prescrever, diagnosticar ou alterar medicamento/dose. complete só pode ser true quando os campos essenciais estiverem preenchidos, a data e hora forem futuras, recurrenceConfirmed=true, responsePlanConfirmed=true e, se repeat=true, weekdays não estiver vazio. Na resposta final, resuma repetição e plano de ausência de resposta e peça revisão antes de agendar.`;
  const model = process.env.GEMINI_MODEL || "gemini-3.5-flash-lite";
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
    method: "POST", signal: AbortSignal.timeout(20_000),
    headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: `${draftInstruction}\n${systemInstruction}` }] },
      contents: messages.map((item) => ({ role: item.role === "assistant" ? "model" : "user", parts: [{ text: item.text }] })),
      generationConfig: { responseMimeType: "application/json", responseSchema: schema, temperature: 0.2 },
    }),
  }).catch(() => null);
  if (!response?.ok) return Response.json({ error: "O assistente não conseguiu responder agora. Tente novamente." }, { status: 502 });
  const result = await response.json();
  const text = result.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) return Response.json({ error: "O assistente retornou uma resposta vazia." }, { status: 502 });
  const parsed = JSON.parse(text);
  parsed.draft = mergeDraft(body?.draft, parsed.draft);
  const person = people.find((item) => item.id === parsed.draft?.personId);
  const contact = person?.authorized_contacts.find((item) => item.id === parsed.draft?.alertContactId);
  const userText = messages.filter((item) => item.role === "user").map((item) => item.text.toLocaleLowerCase("pt-BR")).join("\n");
  const lastUserText = messages.at(-1)?.text.toLocaleLowerCase("pt-BR") || "";
  const lastAssistantText = [...messages].reverse().find((item) => item.role === "assistant")?.text.toLocaleLowerCase("pt-BR") || "";
  if (/em qual dia|qual data/.test(lastAssistantText)) {
    if (/\bhoje\b/.test(lastUserText)) parsed.draft.date = localDate();
    else if (/\bamanhã\b/.test(lastUserText)) parsed.draft.date = localDate(1);
  }
  const allDaysSelected = /(?:todo|todos|toda|todas)(?:\s+os|\s+as)?\s+dias|diari/.test(lastUserText);
  const weekdayPatterns = [["MO", /segunda/], ["TU", /terça|terca/], ["WE", /quarta/], ["TH", /quinta/], ["FR", /sexta/], ["SA", /sábado|sabado/], ["SU", /domingo/]] as const;
  const selectedWeekdays = weekdayPatterns.filter(([, pattern]) => pattern.test(lastUserText)).map(([code]) => code);
  const oneTimeSelected = /sem repeti|não rep|nao rep|uma (?:única )?vez|envio único/.test(lastUserText);
  const recurringSelected = allDaysSelected || selectedWeekdays.length > 0 || /(?:repet|repert|semanal)/.test(lastUserText);
  const ambiguousRepeat = /(?:repetir|repita|repete|repertir)\s+(?:por\s+)?(?:duas|dois|três|[2-9])\s+vezes/.test(lastUserText) && !allDaysSelected && selectedWeekdays.length === 0;
  const recurrenceWasExplicit = !ambiguousRepeat && (Boolean(body?.draft?.recurrenceConfirmed) || oneTimeSelected || recurringSelected || (/repet/.test(lastAssistantText) && /^(sim|não|nao)/.test(lastUserText)));
  const responsePlanWasExplicit = /(confirma|sem resposta|se não (?:responder|houver resposta)|tentativas?|avis(?:e|ar)|alerta|apenas registr|não precisa responder|sem confirmação)/.test(userText) || (/(confirma|sem resposta|tentativ|responsável)/.test(lastAssistantText) && /^(sim|não|nao|aceito|pode ser|está bom|esta bom|ok)/.test(lastUserText));
  if (!person) parsed.complete = false;
  if (allDaysSelected) { parsed.draft.repeat = true; parsed.draft.weekdays = weekdayPatterns.map(([code]) => code); }
  else if (selectedWeekdays.length > 0) { parsed.draft.repeat = true; parsed.draft.weekdays = selectedWeekdays; }
  else if (oneTimeSelected) { parsed.draft.repeat = false; parsed.draft.weekdays = []; }
  else if (recurringSelected) { parsed.draft.repeat = true; }
  parsed.draft.recurrenceConfirmed = recurrenceWasExplicit;
  parsed.draft.responsePlanConfirmed = responsePlanWasExplicit;
  const hasDateAndTime = /^\d{4}-\d{2}-\d{2}$/.test(parsed.draft?.date || "") && /^\d{2}:\d{2}$/.test(parsed.draft?.time || "");
  const scheduled = hasDateAndTime ? new Date(`${parsed.draft.date}T${parsed.draft.time}:00-03:00`) : null;
  const dateOrTimeHasPassed = Boolean(scheduled && (!Number.isFinite(scheduled.getTime()) || scheduled <= now));
  if (dateOrTimeHasPassed) {
    parsed.complete = false;
    const displayedDate = parsed.draft.date.split("-").reverse().join("/");
    parsed.reply = `O horário ${parsed.draft.time} de ${displayedDate} já passou. Informe uma nova data ou um horário futuro para iniciar o lembrete.`;
    if (!Array.isArray(parsed.missingFields)) parsed.missingFields = [];
    if (!parsed.missingFields.includes("data e horário futuros")) parsed.missingFields.push("data e horário futuros");
  }
  if (!parsed.draft.recurrenceConfirmed || !parsed.draft.responsePlanConfirmed || ambiguousRepeat) parsed.complete = false;
  if (!dateOrTimeHasPassed) {
    const personNames = people.map((item) => item.full_name).join(", ");
    if (!person) { parsed.complete = false; parsed.reply = `Para quem é este lembrete? Pessoas cadastradas: ${personNames}.`; }
    else if (!parsed.draft?.title || !parsed.draft?.message) { parsed.complete = false; parsed.reply = `O que ${person.full_name} deve ser lembrado(a) de fazer?`; }
    else if (!/^\d{4}-\d{2}-\d{2}$/.test(parsed.draft?.date || "")) { parsed.complete = false; parsed.reply = "Em qual dia o lembrete deve ser enviado? Você pode responder, por exemplo, hoje, amanhã ou uma data específica."; }
    else if (!/^\d{2}:\d{2}$/.test(parsed.draft?.time || "")) { parsed.complete = false; parsed.reply = "Em qual horário o lembrete deve ser enviado?"; }
    else if (ambiguousRepeat) { parsed.complete = false; parsed.reply = "Quando você diz “repetir duas vezes”, quer repetir o lembrete em outros dias ou fazer duas tentativas caso não haja resposta?"; }
    else if (!parsed.draft.recurrenceConfirmed) { parsed.complete = false; parsed.reply = "Este lembrete será enviado uma única vez ou deverá se repetir? Se repetir, informe os dias da semana."; }
    else if (parsed.draft.repeat && !parsed.draft.weekdays?.length) { parsed.complete = false; parsed.reply = "Em quais dias da semana o lembrete deve se repetir?"; }
    else if (!parsed.draft.responsePlanConfirmed) { parsed.complete = false; parsed.reply = "Deseja pedir uma confirmação? Se não houver resposta, posso fazer 2 tentativas com 15 minutos de intervalo e depois avisar o responsável. Você aceita esse plano ou quer alterar alguma opção?"; }
  }
  if (parsed.draft?.escalationMode !== "record" && !contact) { parsed.draft.escalationMode = "record"; parsed.draft.alertContactId = ""; }
  return Response.json(parsed);
}
