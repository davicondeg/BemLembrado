import { phoneFromJid } from "./phone.ts";

type Json = Record<string, unknown>;

export type IncomingMessage = {
  event: string;
  instanceName: string;
  messageId: string;
  sender: string;
  text: string;
  fromMe: boolean;
};

function object(value: unknown): Json {
  return value && typeof value === "object" ? (value as Json) : {};
}

function string(value: unknown): string {
  return typeof value === "string" ? value : "";
}

export function extractIncomingMessage(payload: unknown): IncomingMessage | null {
  const root = object(payload);
  const event = string(root.event).toLowerCase().replaceAll("_", ".");
  if (event !== "messages.upsert") return null;

  const data = object(root.data);
  const key = object(data.key);
  const message = object(data.message);
  const extended = object(message.extendedTextMessage);
  const text = string(message.conversation) || string(extended.text);
  const remoteJid = string(key.remoteJid);
  const sender = phoneFromJid(remoteJid);

  if (!sender || !text.trim()) return null;
  return {
    event,
    instanceName: string(root.instance) || string(root.instanceName),
    messageId: string(key.id),
    sender,
    text: text.trim().slice(0, 2000),
    fromMe: key.fromMe === true,
  };
}
