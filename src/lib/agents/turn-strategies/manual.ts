import type { SessionAgent } from "@prisma/client";

/**
 * Manual turn strategy.
 * The user explicitly selects which agent speaks next.
 * Returns the specified agent.
 */
export function getManualAgent(
  agents: SessionAgent[],
  targetAgentId: string
): SessionAgent | null {
  return agents.find((a) => a.id === targetAgentId) || null;
}
