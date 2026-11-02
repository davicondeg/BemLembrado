export type ParsedCommand =
  | { kind: "create"; message: string; scheduledAt: string; timezone: string; recurrenceRule: string | null; confirmation: string }
  | { kind: "list" }
  | { kind: "cancel"; query: string }
  | { kind: "ambiguous"; reason: string }
  | { kind: "unknown" };

const DEFAULT_TIMEZONE = "America/Sao_Paulo";

function saoPauloOffset(date: Date): string {
  const part = new Intl.DateTimeFormat("en-US", { timeZone: DEFAULT_TIMEZONE, timeZoneName: "longOffset" })
    .formatToParts(date).find((item) => item.type === "timeZoneName")?.value;
  return part?.replace("GMT", "") || "-03:00";
}

function localDateParts(now: Date, addDays: number) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: DEFAULT_TIMEZONE, year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(now);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  const noon = new Date(`${values.year}-${values.month}-${values.day}T12:00:00${saoPauloOffset(now)}`);
  noon.setUTCDate(noon.getUTCDate() + addDays);
  const next = new Intl.DateTimeFormat("en-CA", {
    timeZone: DEFAULT_TIMEZONE, year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(noon);
  return Object.fromEntries(next.map((part) => [part.type, part.value]));
}

function cleanMessage(text: string): string {
  return text
    .replace(/^(me\s+)?lembre(?:-me)?\s+(de\s+)?/i, "")
    .replace(/^(amanhã|hoje)\s+(às?|as)\s+\d{1,2}(?::\d{2})?\s*(?:h|horas?)?\s*(?:,?\s*)?(me\s+)?lembr(?:e|a)(?:-me)?\s+(de\s+)?/i, "")
    .replace(/\s+(hoje|amanhã)\s+(às?|as)\s+\d{1,2}(?::\d{2})?\s*(?:h|horas?)?[.!]?$/i, "")
    .replace(/^(todo dia|diariamente)\s+(às?|as)\s+\d{1,2}(?::\d{2})?\s*(?:h|horas?)?\s*(me\s+)?lembre(?:-me)?\s+(de\s+)?/i, "")
    .replace(/[.!]+$/, "")
    .trim();
}

export function parseReminderCommand(text: string, now = new Date()): ParsedCommand {
  const normalized = text.trim();
  if (/^(quais|liste|listar|mostre).*(lembretes?)|^meus lembretes\??$/i.test(normalized)) return { kind: "list" };
  const cancel = normalized.match(/^(?:cancele|cancelar|apague|exclua)(?:\s+o)?(?:\s+lembrete)?(?:\s+de)?\s+(.+)$/i);
  if (cancel) return { kind: "cancel", query: cancel[1].replace(/[.!?]+$/, "").trim() };

  const time = normalized.match(/(?:às?|as)\s*(\d{1,2})(?::(\d{2}))?\s*(?:h|horas?)?/i);
  const looksLikeReminder = /lembr(?:e|a)|todo dia|diariamente/i.test(normalized);
  if (!looksLikeReminder) return { kind: "unknown" };
  if (!time) return { kind: "ambiguous", reason: "Qual horário devo usar? Exemplo: hoje às 20h." };

  const hour = Number(time[1]);
  const minute = Number(time[2] || 0);
  if (hour > 23 || minute > 59) return { kind: "ambiguous", reason: "Não consegui entender o horário. Use, por exemplo, 20h ou 20:30." };

  const recurring = /\b(todo dia|diariamente)\b/i.test(normalized);
  const tomorrow = /(?:^|\s)amanhã(?:\s|$)/i.test(normalized);
  const today = /(?:^|\s)hoje(?:\s|$)/i.test(normalized);
  if (!recurring && !tomorrow && !today) return { kind: "ambiguous", reason: "É para hoje ou amanhã?" };

  const date = localDateParts(now, tomorrow ? 1 : 0);
  const offset = saoPauloOffset(now);
  const isoLocal = `${date.year}-${date.month}-${date.day}T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00${offset}`;
  let scheduled = new Date(isoLocal);
  if (recurring && scheduled <= now) {
    const next = localDateParts(now, 1);
    scheduled = new Date(`${next.year}-${next.month}-${next.day}T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00${offset}`);
  }
  if (!recurring && scheduled <= now) return { kind: "ambiguous", reason: "Esse horário já passou. Informe um horário futuro." };

  const message = cleanMessage(normalized);
  if (!message || message.length > 500) return { kind: "ambiguous", reason: "Informe uma mensagem curta para o lembrete." };
  const recurrenceRule = recurring ? `FREQ=DAILY;BYHOUR=${hour};BYMINUTE=${minute}` : null;
  const formatter = new Intl.DateTimeFormat("pt-BR", { timeZone: DEFAULT_TIMEZONE, dateStyle: "short", timeStyle: "short" });
  return {
    kind: "create", message, scheduledAt: scheduled.toISOString(), timezone: DEFAULT_TIMEZONE, recurrenceRule,
    confirmation: `Vou lembrar você de “${message}” em ${formatter.format(scheduled)}${recurring ? " e repetir todos os dias" : ""}.`,
  };
}
