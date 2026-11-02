import test from "node:test";
import assert from "node:assert/strict";
import { extractIncomingMessage } from "../lib/whatsapp/evolution.ts";

test("extrai mensagem de texto da Evolution", () => {
  const result = extractIncomingMessage({
    event: "messages.upsert",
    instance: "bem-lembrado",
    data: {
      key: { id: "ABC123", remoteJid: "5527999999999@s.whatsapp.net", fromMe: false },
      message: { conversation: "Me lembre de beber água hoje às 20h" },
    },
  });
  assert.deepEqual(result, {
    event: "messages.upsert", instanceName: "bem-lembrado", messageId: "ABC123",
    sender: "5527999999999", text: "Me lembre de beber água hoje às 20h", fromMe: false,
  });
});

test("ignora grupo e evento diferente", () => {
  assert.equal(extractIncomingMessage({ event: "connection.update", data: {} }), null);
  assert.equal(extractIncomingMessage({
    event: "messages.upsert",
    data: { key: { id: "1", remoteJid: "123@g.us" }, message: { conversation: "oi" } },
  }), null);
});
