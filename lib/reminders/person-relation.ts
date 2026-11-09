export type ReminderPerson = { id: string; full_name: string };

export function reminderPerson(value: ReminderPerson | ReminderPerson[] | null | undefined): ReminderPerson | null {
  if (!value) return null;
  return Array.isArray(value) ? value[0] || null : value;
}
