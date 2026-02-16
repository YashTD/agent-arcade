/**
 * Simple token counter - approximates token count using character/word heuristics.
 * For production, use tiktoken or similar library.
 */
export function estimateTokens(text: string): number {
  // Rough approximation: ~4 characters per token for English text
  return Math.ceil(text.length / 4);
}

export function estimateMessagesTokens(
  messages: { content: string }[]
): number {
  return messages.reduce(
    (total, msg) => total + estimateTokens(msg.content) + 4, // +4 for message overhead
    0
  );
}
