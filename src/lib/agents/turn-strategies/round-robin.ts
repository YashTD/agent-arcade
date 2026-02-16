import type { SessionAgent } from "@prisma/client";

/**
 * Round-robin turn strategy.
 * Returns the next agent in order, cycling back to the first after the last.
 */
export function getNextRoundRobin(
  agents: SessionAgent[],
  currentTurnIndex: number
): { agent: SessionAgent; nextIndex: number } {
  const sorted = [...agents].sort((a, b) => a.orderIndex - b.orderIndex);
  const index = currentTurnIndex % sorted.length;
  return {
    agent: sorted[index],
    nextIndex: currentTurnIndex + 1,
  };
}
