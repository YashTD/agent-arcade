import type { Message, SessionAgent } from "@prisma/client";

type MessageWithAgent = Message & { agent: SessionAgent | null };

interface FormattedMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

/**
 * Format messages from the perspective of a specific agent.
 * - Current agent's messages → "assistant" role
 * - Other agents' messages → "user" role with [AgentName]: prefix
 * - Human messages → "user" role with [Human]: prefix
 * - System messages → "system" role
 */
export function formatMessagesForAgent(
  messages: MessageWithAgent[],
  currentAgentId: string,
  systemPrompt: string,
  options?: { singleAgent?: boolean }
): FormattedMessage[] {
  const formatted: FormattedMessage[] = [
    { role: "system", content: systemPrompt },
  ];

  // In single-agent sessions with no human input, the agent's own messages
  // would all be "assistant" role with no "user" messages in between, causing
  // models to lose track of conversation history. Instead, present prior
  // messages as numbered user-role context.
  const singleAgent = options?.singleAgent ?? false;
  const hasHumanMessages = messages.some((m) => m.role === "HUMAN");
  const useNumberedHistory = singleAgent && !hasHumanMessages;
  let prevCounter = 0;

  for (const msg of messages) {
    if (msg.role === "SYSTEM") {
      formatted.push({ role: "system", content: msg.content });
      continue;
    }

    if (msg.role === "TOOL_CALL" || msg.role === "TOOL_RESULT") {
      // Include tool interactions as system context
      const prefix =
        msg.role === "TOOL_CALL"
          ? `[Tool Call - ${msg.toolName}]`
          : `[Tool Result - ${msg.toolName}]`;
      formatted.push({
        role: "system",
        content: `${prefix}: ${msg.content}`,
      });
      continue;
    }

    if (msg.agentId === currentAgentId) {
      if (useNumberedHistory) {
        prevCounter++;
        formatted.push({
          role: "user",
          content: `[previous_message_${prevCounter}]: ${msg.content}`,
        });
      } else {
        // This agent's own messages → assistant
        formatted.push({ role: "assistant", content: msg.content });
      }
    } else if (msg.role === "HUMAN") {
      // Human messages
      formatted.push({
        role: "user",
        content: `[Human]: ${msg.content}`,
      });
    } else if (msg.role === "AGENT" && msg.agent) {
      // Other agent's messages
      formatted.push({
        role: "user",
        content: `[${msg.agent.name}]: ${msg.content}`,
      });
    } else {
      formatted.push({ role: "user", content: msg.content });
    }
  }

  // Ensure we don't end with an assistant message (some APIs require ending with user)
  // Actually for chat completions, this is fine. The model generates the next assistant message.

  return formatted;
}

/**
 * Format a single message for display in the shared chat panel.
 */
export function formatDisplayMessage(msg: MessageWithAgent): {
  sender: string;
  content: string;
  color: string;
  role: string;
} {
  if (msg.role === "HUMAN") {
    return {
      sender: "You",
      content: msg.content,
      color: "#6B7280",
      role: "human",
    };
  }

  if (msg.role === "SYSTEM") {
    return {
      sender: "System",
      content: msg.content,
      color: "#9CA3AF",
      role: "system",
    };
  }

  if (msg.role === "TOOL_CALL") {
    return {
      sender: msg.agent?.name || "Agent",
      content: msg.content,
      color: msg.agent?.color || "#6B7280",
      role: "tool_call",
    };
  }

  if (msg.role === "TOOL_RESULT") {
    return {
      sender: msg.agent?.name || "Agent",
      content: msg.content,
      color: msg.agent?.color || "#6B7280",
      role: "tool_result",
    };
  }

  if (msg.agent) {
    return {
      sender: msg.agent.name,
      content: msg.content,
      color: msg.agent.color,
      role: "agent",
    };
  }

  return {
    sender: "Unknown",
    content: msg.content,
    color: "#6B7280",
    role: msg.role.toLowerCase(),
  };
}
