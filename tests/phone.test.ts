import test from "node:test";
import assert from "node:assert/strict";
import { normalizeBrazilianPhone } from "../lib/whatsapp/phone.ts";

test("adiciona DDI 55 a celular brasileiro com DDD", () => {
  assert.equal(normalizeBrazilianPhone("(27) 99878-8334"), "5527998788334");
});

test("preserva número brasileiro que já possui DDI", () => {
  assert.equal(normalizeBrazilianPhone("+55 27 99878-8334"), "5527998788334");
});

test("recusa telefone brasileiro incompleto", () => {
  assert.equal(normalizeBrazilianPhone("99878-8334"), null);
});
