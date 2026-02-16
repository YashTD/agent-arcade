import OpenAI from "openai";
import type { SessionAgent, Tool } from "@prisma/client";
import { dbToolToSDKTool, type SDKTool } from "@/lib/tools/tool-registry";

type SessionAgentWithTools = SessionAgent & {
  tools: { tool: Tool }[];
};

export interface AgentInstance {
  id: string;
  name: string;
  model: string;
  systemPrompt: string;
  color: string;
  orderIndex: number;
  tools: SDKTool[];
  client: OpenAI;
}

/**
 * Create an AgentInstance from a database SessionAgent record.
 */
export function createAgentInstance(
  dbAgent: SessionAgentWithTools,
  client: OpenAI
): AgentInstance {
  const tools = dbAgent.tools.map((at) => dbToolToSDKTool(at.tool));

  return {
    id: dbAgent.id,
    name: dbAgent.name,
    model: dbAgent.model,
    systemPrompt: dbAgent.systemPrompt,
    color: dbAgent.color,
    orderIndex: dbAgent.orderIndex,
    tools,
    client,
  };
}

/**
 * Convert SDK tools to OpenAI function format for chat completions.
 */
export function toolsToOpenAIFormat(
  tools: SDKTool[]
): OpenAI.Chat.Completions.ChatCompletionTool[] {
  return tools.map((tool) => ({
    type: "function" as const,
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters,
    },
  }));
}
