export function normalizePhone(value: string): string | null {
  const digits = value.replace(/\D/g, "");
  if (digits.length < 10 || digits.length > 15) return null;
  return digits;
}

export function normalizeBrazilianPhone(value: string): string | null {
  const digits = value.replace(/\D/g, "").replace(/^0(?=\d{10,11}$)/, "");
  if (digits.length === 10 || digits.length === 11) return `55${digits}`;
  if ((digits.length === 12 || digits.length === 13) && digits.startsWith("55")) return digits;
  return null;
}

export function phoneFromJid(jid: string): string | null {
  if (!jid || jid.endsWith("@g.us")) return null;
  return normalizePhone(jid.split("@")[0]);
}
