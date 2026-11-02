import { cookies } from "next/headers";

export async function isMockMode() {
  return (await cookies()).get("bem_lembrado_mock")?.value === "1";
}

const today = new Date();
const at = (days: number, hour: number, minute = 0) => {
  const date = new Date(today);
  date.setDate(date.getDate() + days);
  date.setHours(hour, minute, 0, 0);
  return date.toISOString();
};

export const mockPeople = [
  { id: "mock-lucia", full_name: "Dona Lúcia", whatsapp_e164: "5527999994821", active: true, created_at: at(-12, 10), authorized_contacts: [{ full_name: "Davi Conde", whatsapp_e164: "5527999991122", is_primary: true }] },
  { id: "mock-antonio", full_name: "Seu Antônio", whatsapp_e164: "5527999997350", active: true, created_at: at(-8, 14), authorized_contacts: [{ full_name: "Marina Souza", whatsapp_e164: "5527999993344", is_primary: true }] },
  { id: "mock-maria", full_name: "Dona Maria", whatsapp_e164: "5527999992098", active: false, created_at: at(-5, 9), authorized_contacts: [{ full_name: "Paulo Lima", whatsapp_e164: "5527999995566", is_primary: true }] },
];

export const mockReminders = [
  { id: "mock-1", title: "Medicamento da manhã", message: "Está na hora de tomar o medicamento da manhã.", scheduled_for: at(0, 8), status: "sent", recurrence_rule: "FREQ=DAILY;BYHOUR=8;BYMINUTE=0", assisted_people: [{ id: "mock-lucia", full_name: "Dona Lúcia" }] },
  { id: "mock-2", title: "Consulta com cardiologista", message: "Sua consulta é hoje às 14h30. Não esqueça os documentos.", scheduled_for: at(0, 13, 30), status: "scheduled", recurrence_rule: null, assisted_people: [{ id: "mock-antonio", full_name: "Seu Antônio" }] },
  { id: "mock-3", title: "Medicamento após o jantar", message: "Lembrete do medicamento após o jantar.", scheduled_for: at(0, 19), status: "scheduled", recurrence_rule: "FREQ=DAILY;BYHOUR=19;BYMINUTE=0", assisted_people: [{ id: "mock-lucia", full_name: "Dona Lúcia" }] },
  { id: "mock-4", title: "Beber água", message: "Que tal beber um copo de água agora?", scheduled_for: at(1, 10), status: "scheduled", recurrence_rule: "FREQ=DAILY;BYHOUR=10;BYMINUTE=0", assisted_people: [{ id: "mock-antonio", full_name: "Seu Antônio" }] },
];

export const mockHistory = [
  { id: "mock-h1", title: "Medicamento da manhã", status: "confirmed", scheduled_for: at(0, 8), sent_at: at(0, 8), last_error: null, assisted_people: [{ full_name: "Dona Lúcia" }] },
  { id: "mock-h2", title: "Caminhada da tarde", status: "sent", scheduled_for: at(-1, 16), sent_at: at(-1, 16), last_error: null, assisted_people: [{ full_name: "Seu Antônio" }] },
  { id: "mock-h3", title: "Consulta odontológica", status: "cancelled", scheduled_for: at(-2, 9), sent_at: null, last_error: null, assisted_people: [{ full_name: "Dona Lúcia" }] },
  { id: "mock-h4", title: "Medicamento noturno", status: "failed", scheduled_for: at(-2, 21), sent_at: null, last_error: "WhatsApp temporariamente desconectado", assisted_people: [{ full_name: "Seu Antônio" }] },
];
