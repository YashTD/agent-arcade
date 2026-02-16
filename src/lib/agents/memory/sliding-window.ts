import type { Message, SessionAgent } from "@prisma/client";

type MessageWithAgent = Message & { agent: SessionAgent | null };

/**
 * Apply sliding window memory strategy.
 * Keeps the most recent N messages.
 */
export function applySlidingWindow(
  messages: MessageWithAgent[],
  windowSize: number
): MessageWithAgent[] {
  if (messages.length <= windowSize) {
    return messages;
  }
  return messages.slice(-windowSize);
}
