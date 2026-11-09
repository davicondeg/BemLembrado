const WEEKDAYS = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"] as const;

export type WeekdayCode = (typeof WEEKDAYS)[number];

const weekdayLabels: Record<WeekdayCode, string> = {
  SU: "domingo",
  MO: "segunda",
  TU: "terça",
  WE: "quarta",
  TH: "quinta",
  FR: "sexta",
  SA: "sábado",
};

function weekdayInSaoPaulo(date: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return WEEKDAYS[new Date(Date.UTC(Number(value.year), Number(value.month) - 1, Number(value.day))).getUTCDay()];
}

export function isWeekdayCode(value: string): value is WeekdayCode {
  return WEEKDAYS.includes(value as WeekdayCode);
}

export function buildWeeklyRecurrence(days: WeekdayCode[], hour: number, minute: number) {
  const uniqueDays = WEEKDAYS.filter((day) => days.includes(day));
  return `FREQ=WEEKLY;BYDAY=${uniqueDays.join(",")};BYHOUR=${hour};BYMINUTE=${minute}`;
}

export function recurrenceDays(rule: string | null | undefined): WeekdayCode[] {
  if (!rule) return [];
  if (rule.includes("FREQ=DAILY")) return [...WEEKDAYS];
  const byDay = rule.match(/(?:^|;)BYDAY=([^;]+)/)?.[1];
  if (!byDay) return [];
  return byDay.split(",").filter(isWeekdayCode);
}

export function nextOccurrence(current: string | Date, rule: string) {
  const currentDate = new Date(current);
  const days = recurrenceDays(rule);
  if (!Number.isFinite(currentDate.getTime()) || !days.length) return null;

  for (let offset = 1; offset <= 7; offset += 1) {
    const candidate = new Date(currentDate.getTime() + offset * 86_400_000);
    if (days.includes(weekdayInSaoPaulo(candidate))) return candidate.toISOString();
  }
  return null;
}

export function firstOccurrenceOnOrAfter(start: string | Date, days: WeekdayCode[]) {
  const startDate = new Date(start);
  if (!Number.isFinite(startDate.getTime()) || !days.length) return null;
  for (let offset = 0; offset < 7; offset += 1) {
    const candidate = new Date(startDate.getTime() + offset * 86_400_000);
    if (days.includes(weekdayInSaoPaulo(candidate))) return candidate.toISOString();
  }
  return null;
}

export function recurrenceLabel(rule: string | null | undefined) {
  if (!rule) return null;
  if (rule.includes("FREQ=DAILY")) return "todos os dias";
  const days = recurrenceDays(rule);
  if (!days.length) return "recorrente";
  return days.map((day) => weekdayLabels[day]).join(", ");
}

export function nextFutureOccurrence(rule: string, now = new Date()) {
  const days = recurrenceDays(rule);
  const hour = Number(rule.match(/(?:^|;)BYHOUR=(\d{1,2})/)?.[1]);
  const minute = Number(rule.match(/(?:^|;)BYMINUTE=(\d{1,2})/)?.[1]);
  if (!days.length || !Number.isInteger(hour) || !Number.isInteger(minute)) return null;

  const localParts = Object.fromEntries(new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(now).map((part) => [part.type, part.value]));
  const localStart = new Date(`${localParts.year}-${localParts.month}-${localParts.day}T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00-03:00`);
  for (let offset = 0; offset < 8; offset += 1) {
    const candidate = new Date(localStart.getTime() + offset * 86_400_000);
    if (candidate > now && days.includes(weekdayInSaoPaulo(candidate))) return candidate.toISOString();
  }
  return null;
}
