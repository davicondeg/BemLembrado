import test from "node:test";
import assert from "node:assert/strict";
import { afterConfirmation, afterConfirmationTimeout, afterSuccessfulSend } from "../lib/reminders/engine.ts";

test("envio sem confirmação termina imediatamente", () => {
  assert.deepEqual(afterSuccessfulSend({ confirmationRequired: false, currentAttempt: 1, maxAttempts: 2, recurring: false }), { action: "complete", status: "sent" });
});

test("envio com confirmação entra em espera", () => {
  assert.deepEqual(afterSuccessfulSend({ confirmationRequired: true, currentAttempt: 1, maxAttempts: 2, recurring: false }), { action: "wait_confirmation", status: "sent" });
});

test("tempo esgotado repete até o limite", () => {
  assert.deepEqual(afterConfirmationTimeout({ confirmationRequired: true, currentAttempt: 1, maxAttempts: 3, recurring: false }), { action: "retry", nextAttempt: 2 });
});

test("tempo esgotado alerta depois da última tentativa", () => {
  assert.deepEqual(afterConfirmationTimeout({ confirmationRequired: true, currentAttempt: 3, maxAttempts: 3, recurring: false }), { action: "alert", status: "not_done" });
});

test("confirmação de recorrente agenda a próxima ocorrência", () => {
  assert.deepEqual(afterConfirmation({ confirmationRequired: true, currentAttempt: 1, maxAttempts: 2, recurring: true }), { action: "reschedule", status: "scheduled" });
});
