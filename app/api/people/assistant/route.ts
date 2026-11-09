import { createClient } from "@/lib/supabase/server";
import { normalizeBrazilianPhone } from "@/lib/whatsapp/phone";

type ChatMessage = { role: "user" | "assistant"; text: string };
type Draft = { fullName?: string; phone?: string; contactName?: string; contactPhone?: string; consentConfirmed?: boolean };

const schema = {
  type: "object",
  required: ["reply", "complete", "draft"],
  properties: {
    reply: { type: "string" },
    complete: { type: "boolean" },
    draft: {
      type: "object",
      required: ["fullName", "phone", "contactName", "contactPhone", "consentConfirmed"],
      properties: {
        fullName: { type: "string" }, phone: { type: "string" }, contactName: { type: "string" },
        contactPhone: { type: "string" }, consentConfirmed: { type: "boolean" },
      },
    },
  },
};

function mergeDraft(previous: Draft | null | undefined, current: Draft | null | undefined): Draft {
  const merged = { ...(previous || {}), ...(current || {}) };
  for (const [key, value] of Object.entries(current || {})) {
    if (value === "" || value === null || value === undefined) merged[key as keyof Draft] = previous?.[key as keyof Draft] as never;
  }
  return merged;
}

function validName(value?: string) { return Boolean(value && value.trim().length >= 2); }

export async function POST(request: Request) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return Response.json({ error: "Gemini não configurado." }, { status: 503 });
  const body = await request.json().catch(() => null) as { messages?: ChatMessage[]; draft?: Draft | null } | null;
  const messages = body?.messages?.filter((item) => ["user", "assistant"].includes(item.role) && typeof item.text === "string").slice(-12);
  if (!messages?.length || messages.at(-1)?.role !== "user" || messages.at(-1)!.text.length > 500) return Response.json({ error: "Mensagem inválida." }, { status: 400 });

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Sessão expirada." }, { status: 401 });

  const systemInstruction = `Você ajuda a preencher o cadastro de uma pessoa assistida em um sistema de lembretes por WhatsApp. Fale em português brasileiro, de maneira acolhedora, clara e curta. Faça somente uma pergunta por vez. Reúna nesta ordem: nome completo da pessoa assistida, WhatsApp com DDD, nome completo do contato responsável e WhatsApp do responsável com DDD. Preserve os dados do rascunho: ${JSON.stringify(body?.draft || {})}. Não invente, não corrija nomes por conta própria e não troque quem é a pessoa e quem é o responsável. Se um telefone parecer incompleto, peça novamente. Depois dos quatro dados, explique que ambos precisam ter autorizado o uso dos dados e o recebimento de mensagens pelo WhatsApp e pergunte explicitamente se essa autorização foi obtida. Nunca presuma autorização e só defina consentConfirmed=true após uma resposta afirmativa explícita a essa pergunta. complete só pode ser true quando todos os dados forem válidos e o consentimento estiver confirmado. Ao final, apresente um resumo curto e peça que a pessoa revise o quadro antes de cadastrar.`;
  const model = process.env.GEMINI_MODEL || "gemini-3.5-flash-lite";
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
    method: "POST", signal: AbortSignal.timeout(20_000),
    headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: systemInstruction }] },
      contents: messages.map((item) => ({ role: item.role === "assistant" ? "model" : "user", parts: [{ text: item.text }] })),
      generationConfig: { responseMimeType: "application/json", responseSchema: schema, temperature: 0.15 },
    }),
  }).catch(() => null);
  if (!response?.ok) return Response.json({ error: "O assistente não conseguiu responder agora. Tente novamente." }, { status: 502 });
  const result = await response.json();
  const text = result.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) return Response.json({ error: "O assistente retornou uma resposta vazia." }, { status: 502 });

  const parsed = JSON.parse(text) as { reply: string; complete: boolean; draft: Draft };
  parsed.draft = mergeDraft(body?.draft, parsed.draft);
  const phone = normalizeBrazilianPhone(parsed.draft.phone || "");
  const contactPhone = normalizeBrazilianPhone(parsed.draft.contactPhone || "");
  const lastAssistant = [...messages].reverse().find((item) => item.role === "assistant")?.text.toLocaleLowerCase("pt-BR") || "";
  const lastAnswer = messages.at(-1)?.text.toLocaleLowerCase("pt-BR") || "";
  const authorizationWasAsked = /autoriz|consent/.test(lastAssistant);
  const explicitConsent = authorizationWasAsked && /^(sim|confirmo|foi autorizad|foram autorizad|está autorizad|esta autorizad|autorizado|autorizada|autorizamos|de acordo|concordam|concordo)\b/.test(lastAnswer.trim());
  parsed.draft.consentConfirmed = Boolean(body?.draft?.consentConfirmed || explicitConsent);
  parsed.complete = false;

  if (!validName(parsed.draft.fullName)) parsed.reply = "Qual é o nome completo da pessoa que receberá os lembretes?";
  else if (!phone) parsed.reply = `Qual é o WhatsApp de ${parsed.draft.fullName}, com DDD?`;
  else if (!validName(parsed.draft.contactName)) parsed.reply = "Qual é o nome completo do responsável que deverá receber os alertas?";
  else if (!contactPhone) parsed.reply = `Qual é o WhatsApp de ${parsed.draft.contactName}, com DDD?`;
  else if (!parsed.draft.consentConfirmed) parsed.reply = "A pessoa assistida e o responsável autorizaram o uso desses dados e o recebimento de lembretes e alertas pelo WhatsApp?";
  else {
    parsed.draft.phone = phone;
    parsed.draft.contactPhone = contactPhone;
    parsed.complete = true;
    parsed.reply = `Cadastro organizado: ${parsed.draft.fullName} receberá os lembretes e ${parsed.draft.contactName} será o contato responsável. Confira os dados no quadro ao lado antes de cadastrar.`;
  }
  return Response.json(parsed);
}
