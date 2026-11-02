export type ReminderEngineInput = {
  confirmationRequired: boolean;
  currentAttempt: number;
  maxAttempts: number;
  recurring: boolean;
};

export type ReminderDecision =
  | { action: "complete"; status: "sent" }
  | { action: "wait_confirmation"; status: "sent" }
  | { action: "retry"; nextAttempt: number }
  | { action: "alert"; status: "not_done" }
  | { action: "reschedule"; status: "scheduled" };

export function afterSuccessfulSend(input: ReminderEngineInput): ReminderDecision {
  if (!input.confirmationRequired) return input.recurring ? { action: "reschedule", status: "scheduled" } : { action: "complete", status: "sent" };
  return { action: "wait_confirmation", status: "sent" };
}

export function afterConfirmationTimeout(input: ReminderEngineInput): ReminderDecision {
  if (!input.confirmationRequired) return { action: "complete", status: "sent" };
  if (input.currentAttempt < input.maxAttempts) return { action: "retry", nextAttempt: input.currentAttempt + 1 };
  return input.recurring ? { action: "reschedule", status: "scheduled" } : { action: "alert", status: "not_done" };
}

export function afterConfirmation(input: ReminderEngineInput): ReminderDecision {
  return input.recurring ? { action: "reschedule", status: "scheduled" } : { action: "complete", status: "sent" };
}
