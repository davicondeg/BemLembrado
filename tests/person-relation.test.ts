import test from "node:test";
import assert from "node:assert/strict";
import { reminderPerson } from "../lib/reminders/person-relation.ts";

const person = { id: "person-1", full_name: "Luzia da Silva" };

test("aceita pessoa retornada pelo Supabase como objeto", () => {
  assert.deepEqual(reminderPerson(person), person);
});

test("aceita pessoa dos dados demonstrativos como lista", () => {
  assert.deepEqual(reminderPerson([person]), person);
});

test("retorna nulo quando o lembrete não possui pessoa", () => {
  assert.equal(reminderPerson(null), null);
  assert.equal(reminderPerson([]), null);
});
