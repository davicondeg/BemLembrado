import assert from "node:assert/strict";
import test from "node:test";
import { buildWeeklyRecurrence, firstOccurrenceOnOrAfter, nextFutureOccurrence, nextOccurrence, recurrenceLabel } from "../lib/reminders/recurrence.ts";

test("monta recorrência com dias da semana selecionados", () => {
  assert.equal(buildWeeklyRecurrence(["MO", "WE", "FR"], 8, 30), "FREQ=WEEKLY;BYDAY=MO,WE,FR;BYHOUR=8;BYMINUTE=30");
});

test("agenda a próxima ocorrência pulando dias não selecionados", () => {
  assert.equal(nextOccurrence("2026-11-09T11:30:00.000Z", "FREQ=WEEKLY;BYDAY=MO,WE,FR;BYHOUR=8;BYMINUTE=30"), "2026-11-11T11:30:00.000Z");
  assert.equal(nextOccurrence("2026-11-13T11:30:00.000Z", "FREQ=WEEKLY;BYDAY=MO,WE,FR;BYHOUR=8;BYMINUTE=30"), "2026-11-16T11:30:00.000Z");
  assert.equal(nextOccurrence("2026-11-10T02:00:00.000Z", "FREQ=WEEKLY;BYDAY=MO,WE,FR;BYHOUR=23;BYMINUTE=0"), "2026-11-12T02:00:00.000Z");
});

test("alinha a data inicial ao primeiro dia selecionado", () => {
  assert.equal(firstOccurrenceOnOrAfter("2026-11-10T11:30:00.000Z", ["MO", "WE", "FR"]), "2026-11-11T11:30:00.000Z");
});

test("descreve os dias selecionados para a interface", () => {
  assert.equal(recurrenceLabel("FREQ=WEEKLY;BYDAY=MO,WE,FR;BYHOUR=8;BYMINUTE=30"), "segunda, quarta, sexta");
  assert.equal(recurrenceLabel("FREQ=DAILY;BYHOUR=8;BYMINUTE=30"), "todos os dias");
});

test("retoma uma recorrência no próximo horário futuro válido", () => {
  const rule = "FREQ=WEEKLY;BYDAY=MO,WE,FR;BYHOUR=8;BYMINUTE=30";
  assert.equal(nextFutureOccurrence(rule, new Date("2026-11-09T12:00:00.000Z")), "2026-11-11T11:30:00.000Z");
});
