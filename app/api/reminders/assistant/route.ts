import { createClient } from "@/lib/supabase/server";

type ChatMessage = { role: "user" | "assistant"; text: string };

const schema = {
  type: "object",
  required: ["reply", "complete", "missingFields", "draft"],
  properties: {
    reply: { type: "string", description: "Resposta curta e acolhedora em português brasileiro." },
    complete: { type: "boolean" },
    missingFields: { type: "array", items: { type: "string" } },
    draft: {
      type: "object",
      required: ["personId", "kind", "title", "message", "date", "time", "repeat", "weekdays", "confirmationRequired", "timeout", "maxAttempts", "repeatInterval", "escalationMode", "alertContactId"],
      properties: {
        personId: { type: "string" }, kind: { type: "string", enum: ["medication", "appointment", "task"] },
        title: { type: "string" }, message: { type: "string" }, date: { type: "string" }, time: { type: "string" },
        repeat: { type: "boolean" }, weekdays: { type: "array", items: { type: "string", enum: ["MO", "TU", "WE", "TH", "FR", "SA", "SU"] } },
        confirmationRequired: { type: "boolean" }, timeout: { type: "integer" }, maxAttempts: { type: "integer" }, repeatInterval: { type: "integer" },
        escalationMode: { type: "string", enum: ["record", "notify", "priority"] }, alertContactId: { type: "string" },
      },
    },
  },
};

export async function POST(request: Request) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return Response.json({ error: "Gemini não configurado." }, { status: 503 });
  const body = await request.json().catch(() => null) as { messages?: ChatMessage[] } | null;
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
  const systemInstruction = `Você ajuda um responsável a preencher um lembrete, sem dar orientação médica. Hoje é ${localNow}, fuso America/Sao_Paulo. Pessoas e contatos permitidos: ${JSON.stringify(directory)}. Faça uma pergunta por vez quando faltar pessoa, título/tarefa, data ou horário. Interprete hoje, amanhã e dias da semana usando a data informada. Nunca invente pessoa ou contato. Para repetição, use códigos MO,TU,WE,TH,FR,SA,SU. Se repetir e a data inicial não cair em um dia escolhido, mantenha a data solicitada; o sistema alinhará. Valores padrão quando não mencionados: confirmationRequired=true, timeout=30, maxAttempts=2, repeatInterval=15. Se houver contato primário, escalationMode=notify e use seu ID; sem contato, escalationMode=record e alertContactId vazio. "Alerta prioritário" somente quando o usuário pedir explicitamente. A mensagem deve ser gentil e objetiva, sem prescrever, diagnosticar ou alterar medicamento/dose. complete só pode ser true quando personId, title, message, date YYYY-MM-DD e time HH:mm estiverem preenchidos e, se repeat=true, weekdays não estiver vazio. Na resposta final, peça para a pessoa revisar antes de agendar.`;
  const model = process.env.GEMINI_MODEL || "gemini-3.5-flash-lite";
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
    method: "POST", signal: AbortSignal.timeout(20_000),
    headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: systemInstruction }] },
      contents: messages.map((item) => ({ role: item.role === "assistant" ? "model" : "user", parts: [{ text: item.text }] })),
      generationConfig: { responseMimeType: "application/json", responseSchema: schema, temperature: 0.2 },
    }),
  }).catch(() => null);
  if (!response?.ok) return Response.json({ error: "O assistente não conseguiu responder agora. Tente novamente." }, { status: 502 });
  const result = await response.json();
  const text = result.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) return Response.json({ error: "O assistente retornou uma resposta vazia." }, { status: 502 });
  const parsed = JSON.parse(text);
  const person = people.find((item) => item.id === parsed.draft?.personId);
  const contact = person?.authorized_contacts.find((item) => item.id === parsed.draft?.alertContactId);
  if (!person) parsed.complete = false;
  if (parsed.draft?.escalationMode !== "record" && !contact) { parsed.draft.escalationMode = "record"; parsed.draft.alertContactId = ""; }
  return Response.json(parsed);
}
