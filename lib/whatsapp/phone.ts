export function normalizePhone(value: string): string | null {
  const digits = value.replace(/\D/g, "");
  if (digits.length < 10 || digits.length > 15) return null;
  return digits;
}

export function phoneFromJid(jid: string): string | null {
  if (!jid || jid.endsWith("@g.us")) return null;
  return normalizePhone(jid.split("@")[0]);
}
