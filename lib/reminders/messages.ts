export function initialMessage(message: string) {
  return `${message}\n\nResponda “sim” para confirmar.`;
}

export function retryMessage(message: string, attempt: number, maximum: number) {
  return `Lembrete (${attempt}/${maximum}): ${message}\n\nAinda não recebemos sua confirmação.`;
}

export function alertMessage(personName: string, reminderTitle: string, attempts: number) {
  return `Bem Lembrado: ${personName} não confirmou o lembrete “${reminderTitle}” após ${attempts} tentativa(s).`;
}
