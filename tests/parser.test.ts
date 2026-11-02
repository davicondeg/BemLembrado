import test from "node:test";
import assert from "node:assert/strict";
import { parseReminderCommand } from "../lib/reminders/parser.ts";

const now = new Date("2026-11-02T15:00:00.000Z"); // 12:00 em São Paulo

test("cria lembrete para hoje e converte para UTC", () => {
  const result = parseReminderCommand("Me lembre de tomar creatina hoje às 20h.", now);
  assert.equal(result.kind, "create");
  if (result.kind === "create") {
    assert.equal(result.message, "tomar creatina");
    assert.equal(result.scheduledAt, "2026-11-02T23:00:00.000Z");
    assert.equal(result.timezone, "America/Sao_Paulo");
  }
});

test("cria lembrete para amanhã", () => {
  const result = parseReminderCommand("Amanhã às 8h me lembra de pagar a conta.", now);
  assert.equal(result.kind, "create");
  if (result.kind === "create") assert.equal(result.scheduledAt, "2026-11-03T11:00:00.000Z");
});

test("cria recorrência diária", () => {
  const result = parseReminderCommand("Todo dia às 7h me lembre de beber água.", now);
  assert.equal(result.kind, "create");
  if (result.kind === "create") {
    assert.equal(result.scheduledAt, "2026-11-03T10:00:00.000Z");
    assert.equal(result.recurrenceRule, "FREQ=DAILY;BYHOUR=7;BYMINUTE=0");
  }
});

test("pede esclarecimento quando falta a data", () => {
  const result = parseReminderCommand("Me lembre de pagar a conta às 8h", now);
  assert.equal(result.kind, "ambiguous");
});

test("reconhece listagem e cancelamento", () => {
  assert.deepEqual(parseReminderCommand("Quais são meus lembretes?", now), { kind: "list" });
  assert.deepEqual(parseReminderCommand("Cancele o lembrete de pagar a conta", now), { kind: "cancel", query: "pagar a conta" });
});
