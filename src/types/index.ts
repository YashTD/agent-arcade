import type {
  Tool,
  Session,
  SessionAgent,
  Message,
  ConversationSummary,
  AgentTemplate,
} from "@prisma/client";

// Re-export Prisma types
export type { Tool, Session, SessionAgent, Message, ConversationSummary, AgentTemplate };

// Extended types with relations
export type SessionAgentWithTools = SessionAgent & {
  tools: { tool: Tool }[];
};

export type SessionWithAgents = Session & {
  agents: SessionAgentWithTools[];
};

export type SessionWithAll = Session & {
  agents: SessionAgentWithTools[];
  messages: MessageWithAgent[];
};

export type MessageWithAgent = Message & {
  agent: SessionAgent | null;
};

// SSE Event types
export type SSEEventType =
  | "turn_start"
  | "token"
  | "turn_end"
  | "tool_call"
  | "tool_result"
  | "approval_required"
  | "error"
  | "conversation_paused"
  | "conversation_resting"
  | "conversation_complete";

export interface SSEEvent {
  type: SSEEventType;
  data: Record<string, unknown>;
}

export interface TurnStartEvent {
  type: "turn_start";
  data: {
    agentId: string;
    agentName: string;
    turnIndex: number;
  };
}

export interface TokenEvent {
  type: "token";
  data: {
    agentId: string;
    token: string;
  };
}

export interface TurnEndEvent {
  type: "turn_end";
  data: {
    agentId: string;
    messageId: string;
    content: string;
  };
}

export interface ToolCallEvent {
  type: "tool_call";
  data: {
    agentId: string;
    toolName: string;
    args: Record<string, unknown>;
  };
}

export interface ToolResultEvent {
  type: "tool_result";
  data: {
    agentId: string;
    toolName: string;
    result: unknown;
  };
}

export interface ApprovalRequiredEvent {
  type: "approval_required";
  data: {
    agentId: string;
    toolName: string;
    toolCode: string;
    toolDescription: string;
    toolParameters: Record<string, unknown>;
    approvalId: string;
  };
}

export interface ErrorEvent {
  type: "error";
  data: {
    message: string;
    agentId?: string;
  };
}

// API request/response types
export interface CreateSessionRequest {
  name: string;
  turnOrder?: "ROUND_ROBIN" | "MANUAL" | "ORCHESTRATED";
  memoryStrategy?: "SLIDING_WINDOW" | "SUMMARIZATION";
  memoryWindowSize?: number;
}

export interface CreateAgentRequest {
  name: string;
  model?: string;
  systemPrompt: string;
  color?: string;
  orderIndex?: number;
  toolIds?: string[];
}

export interface CreateToolRequest {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  implementation: string;
}

export interface CreateAgentTemplateRequest {
  name: string;
  model?: string;
  systemPrompt: string;
  toolIds?: string[];
}

export interface SendMessageRequest {
  content: string;
  targetAgentId?: string; // For manual mode
}

export interface ProgressConversationRequest {
  turns?: number; // Number of turns to progress (default 1)
}

// Agent colors for automatic assignment
export const AGENT_COLORS = [
  "#3B82F6", // blue
  "#EF4444", // red
  "#10B981", // green
  "#F59E0B", // amber
  "#8B5CF6", // violet
  "#EC4899", // pink
  "#06B6D4", // cyan
  "#F97316", // orange
];
