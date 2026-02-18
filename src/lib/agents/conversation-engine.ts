import OpenAI from "openai";
import type { Session, SessionAgent, Message, Tool } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getOpenRouterClient } from "@/lib/openrouter";
import {
  createAgentInstance,
  toolsToOpenAIFormat,
  type AgentInstance,
} from "./agent-factory";
import { formatMessagesForAgent } from "@/lib/utils/message-formatter";
import { applySlidingWindow } from "./memory/sliding-window";
import { applySummarization } from "./memory/summarization";
import { getNextRoundRobin } from "./turn-strategies/round-robin";
import { getManualAgent } from "./turn-strategies/manual";
import { getOrchestratedAgent } from "./orchestrator";
import { toolLogger } from "@/lib/tools/tool-logger";
import { getBrowserManager } from "@/lib/tools/browser-manager";
import type { ToolContext } from "@/lib/tools/tool-registry";

type SessionAgentWithTools = SessionAgent & {
  tools: { tool: Tool }[];
};

type MessageWithAgent = Message & { agent: SessionAgent | null };

export interface SSEWriter {
  write: (event: string, data: Record<string, unknown>) => void;
  close: () => void;
}

export class ConversationEngine {
  private session: Session;
  private agents: AgentInstance[];
  private dbAgents: SessionAgentWithTools[];
  private client: OpenAI;
  private sseWriter: SSEWriter;
  private abortSignal?: AbortSignal;
  private restRequested = false;

  constructor(
    session: Session,
    dbAgents: SessionAgentWithTools[],
    sseWriter: SSEWriter,
    abortSignal?: AbortSignal
  ) {
    this.session = session;
    this.dbAgents = dbAgents;
    this.client = getOpenRouterClient();
    this.agents = dbAgents.map((a) => createAgentInstance(a, this.client));
    this.sseWriter = sseWriter;
    this.abortSignal = abortSignal;
  }

  /**
   * Add a human message to the conversation.
   */
  async addHumanMessage(content: string): Promise<MessageWithAgent> {
    const message = await prisma.message.create({
      data: {
        sessionId: this.session.id,
        role: "HUMAN",
        content,
      },
      include: { agent: true },
    });
    return message;
  }

  /**
   * Execute a single turn of conversation.
   */
  async executeTurn(targetAgentId?: string): Promise<MessageWithAgent | null> {
    if (this.abortSignal?.aborted) return null;

    // Slow mode: wait 5 seconds before each turn
    if (this.session.isSlow) {
      await new Promise((resolve) => setTimeout(resolve, 5000));
      if (this.abortSignal?.aborted) return null;
    }

    // Determine next speaker
    const nextAgent = await this.getNextSpeaker(targetAgentId);
    if (!nextAgent) {
      this.sseWriter.write("error", {
        message: "No agent available to speak",
      });
      return null;
    }

    const agentInstance = this.agents.find((a) => a.id === nextAgent.id);
    if (!agentInstance) return null;

    // Emit turn start
    this.sseWriter.write("turn_start", {
      agentId: nextAgent.id,
      agentName: nextAgent.name,
      turnIndex: this.session.currentTurnIndex,
    });

    // Get messages and apply memory strategy
    const messages = await this.getContextMessages();

    // Format messages for this agent's perspective
    const formatted = formatMessagesForAgent(
      messages,
      nextAgent.id,
      agentInstance.systemPrompt,
      { singleAgent: this.dbAgents.length === 1 }
    );

    try {
      // Call the model
      const tools = toolsToOpenAIFormat(agentInstance.tools);
      const response = await this.callModel(
        agentInstance,
        formatted,
        tools
      );

      if (this.abortSignal?.aborted) return null;

      // Handle tool calls if any
      let finalContent = response.content || "";

      if (response.tool_calls && response.tool_calls.length > 0) {
        finalContent = await this.handleToolCalls(
          agentInstance,
          response.tool_calls,
          response.content || null,
          formatted,
          tools
        );
      }

      // Save the final agent message (post-tool summary, or the only message if no tools)
      const agentMessage = await prisma.message.create({
        data: {
          sessionId: this.session.id,
          agentId: nextAgent.id,
          role: "AGENT",
          content: finalContent,
        },
        include: { agent: true },
      });

      // Update turn index
      await prisma.session.update({
        where: { id: this.session.id },
        data: {
          currentTurnIndex: this.session.currentTurnIndex + 1,
          status: "ACTIVE",
        },
      });
      this.session.currentTurnIndex += 1;

      // Emit turn end
      this.sseWriter.write("turn_end", {
        agentId: nextAgent.id,
        messageId: agentMessage.id,
        content: finalContent,
        message: agentMessage,
      });

      return agentMessage;
    } catch (error) {
      const errMsg =
        error instanceof Error ? error.message : "Unknown error";
      this.sseWriter.write("error", {
        message: errMsg,
        agentId: nextAgent.id,
      });
      return null;
    }
  }

  /**
   * Run multiple turns of conversation.
   */
  async runTurns(count: number, targetAgentId?: string): Promise<void> {
    for (let i = 0; i < count; i++) {
      if (this.abortSignal?.aborted) break;
      const result = await this.executeTurn(
        i === 0 ? targetAgentId : undefined
      );
      if (!result) break;
      if (this.restRequested) {
        this.sseWriter.write("conversation_resting", {});
        return;
      }
      // Small delay between turns
      if (i < count - 1) {
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
    }
    this.sseWriter.write("conversation_paused", {});
  }

  /**
   * Run infinite conversation loop.
   */
  async runInfinite(): Promise<void> {
    while (!this.abortSignal?.aborted) {
      const result = await this.executeTurn();
      if (!result) break;
      if (this.restRequested) {
        this.sseWriter.write("conversation_resting", {});
        return;
      }
      // 1 second delay between turns
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
    this.sseWriter.write("conversation_complete", {});
  }

  private async getNextSpeaker(
    targetAgentId?: string
  ): Promise<SessionAgent | null> {
    const agents = this.dbAgents;
    if (agents.length === 0) return null;

    // Single-agent fast path: skip orchestrator/round-robin when there's only one agent
    if (agents.length === 1) return agents[0];

    switch (this.session.turnOrder) {
      case "MANUAL": {
        if (!targetAgentId) {
          // In manual mode without target, use round-robin as fallback
          const { agent } = getNextRoundRobin(
            agents,
            this.session.currentTurnIndex
          );
          return agent;
        }
        return getManualAgent(agents, targetAgentId);
      }

      case "ORCHESTRATED": {
        const messages = await prisma.message.findMany({
          where: { sessionId: this.session.id },
          orderBy: { createdAt: "desc" },
          include: { agent: true },
          take: 40,
        });
        messages.reverse();
        return getOrchestratedAgent(
          this.dbAgents,
          messages,
          this.client,
          this.session.orchestratorModel
        );
      }

      case "ROUND_ROBIN":
      default: {
        const { agent } = getNextRoundRobin(
          agents,
          this.session.currentTurnIndex
        );
        return agent;
      }
    }
  }

  private async getContextMessages(): Promise<MessageWithAgent[]> {
    const allMessages = await prisma.message.findMany({
      where: { sessionId: this.session.id },
      orderBy: { createdAt: "asc" },
      include: { agent: true },
    });

    switch (this.session.memoryStrategy) {
      case "SUMMARIZATION": {
        const { messages } = await applySummarization(
          allMessages,
          this.session.id,
          this.client
        );
        return messages;
      }

      case "SLIDING_WINDOW":
      default:
        return applySlidingWindow(allMessages, this.session.memoryWindowSize);
    }
  }

  private async callModel(
    agent: AgentInstance,
    messages: { role: string; content: string }[],
    tools: OpenAI.Chat.Completions.ChatCompletionTool[]
  ): Promise<OpenAI.Chat.Completions.ChatCompletionMessage> {
    const params: OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming =
      {
        model: agent.model,
        messages: messages as OpenAI.Chat.Completions.ChatCompletionMessageParam[],
        max_tokens: 4096,
      };

    if (tools.length > 0) {
      params.tools = tools;
      params.tool_choice = "auto";
    }

    const response = await this.client.chat.completions.create(params);
    return response.choices[0].message;
  }

  private static MAX_TOOL_ROUNDS = 10;

  private async handleToolCalls(
    agent: AgentInstance,
    toolCalls: OpenAI.Chat.Completions.ChatCompletionMessageToolCall[],
    initialContent: string | null,
    existingMessages: { role: string; content: string }[],
    tools: OpenAI.Chat.Completions.ChatCompletionTool[]
  ): Promise<string> {
    const toolMessages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] =
      [...(existingMessages as OpenAI.Chat.Completions.ChatCompletionMessageParam[])];

    const logCtx = { agentId: agent.id, agentName: agent.name, sessionId: this.session.id };

    // Build context for tools that need session-aware services (e.g. browser)
    const toolContext: ToolContext = {
      sessionId: this.session.id,
      browserManager: getBrowserManager(),
      requestRest: () => { this.restRequested = true; },
    };

    let currentToolCalls = toolCalls;
    let currentContent = initialContent;

    for (let round = 0; round < ConversationEngine.MAX_TOOL_ROUNDS; round++) {
      if (this.abortSignal?.aborted) return "";

      toolLogger.api("handleToolCalls", `Processing ${currentToolCalls.length} tool call(s) (round ${round + 1})`, logCtx);

      // Add the assistant message with tool calls (preserve any accompanying text)
      toolMessages.push({
        role: "assistant",
        content: currentContent || null,
        tool_calls: currentToolCalls,
      });

      for (const toolCall of currentToolCalls) {
        const toolName = toolCall.function.name;
        let args: Record<string, unknown> = {};
        try {
          args = JSON.parse(toolCall.function.arguments);
        } catch {
          toolLogger.argsParseFailed(toolName, toolCall.function.arguments, logCtx);
          args = {};
        }

        this.sseWriter.write("tool_call", {
          agentId: agent.id,
          agentName: agent.name,
          toolName,
          args,
        });

        // Save tool call message
        await prisma.message.create({
          data: {
            sessionId: this.session.id,
            agentId: agent.id,
            role: "TOOL_CALL",
            content: JSON.stringify(args),
            toolName,
            toolArgs: JSON.parse(JSON.stringify(args)),
          },
        });

        // Execute the tool
        const sdkTool = agent.tools.find((t) => t.name === toolName);
        let result: unknown;

        if (sdkTool) {
          const start = performance.now();
          try {
            result = await sdkTool.execute(args, toolContext);
          } catch (error) {
            const durationMs = Math.round(performance.now() - start);
            toolLogger.execError(toolName, error, durationMs, logCtx);
            result = {
              error:
                error instanceof Error ? error.message : "Tool execution failed",
            };
          }
        } else {
          toolLogger.notFound(toolName, logCtx);
          result = { error: `Tool "${toolName}" not found` };
        }

        this.sseWriter.write("tool_result", {
          agentId: agent.id,
          agentName: agent.name,
          toolName,
          result,
        });

        // Save tool result message
        await prisma.message.create({
          data: {
            sessionId: this.session.id,
            agentId: agent.id,
            role: "TOOL_RESULT",
            content: JSON.stringify(result),
            toolName,
          },
        });

        // Add tool result to messages for follow-up
        toolMessages.push({
          role: "tool",
          tool_call_id: toolCall.id,
          content: JSON.stringify(result),
        });
      }

      // Call the model with tool results
      toolLogger.api("handleToolCalls", `Calling model for follow-up (round ${round + 1})`, logCtx);

      const params: OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming =
        {
          model: agent.model,
          messages: toolMessages,
          max_tokens: 4096,
        };
      if (tools.length > 0) {
        params.tools = tools;
        params.tool_choice = "auto";
      }

      const followUp = await this.client.chat.completions.create(params);
      const followUpMessage = followUp.choices[0].message;

      // If the model wants more tool calls, emit any accompanying text
      // as a separate message, then loop for the next round
      if (followUpMessage.tool_calls && followUpMessage.tool_calls.length > 0) {
        if (followUpMessage.content) {
          const intermediateMsg = await prisma.message.create({
            data: {
              sessionId: this.session.id,
              agentId: agent.id,
              role: "AGENT",
              content: followUpMessage.content,
            },
            include: { agent: true },
          });
          this.sseWriter.write("turn_end", {
            agentId: agent.id,
            messageId: intermediateMsg.id,
            content: followUpMessage.content,
            message: intermediateMsg,
          });
        }
        currentToolCalls = followUpMessage.tool_calls;
        currentContent = followUpMessage.content;
        continue;
      }

      return followUpMessage.content || "";
    }

    // Exhausted max rounds — force a final text response without tools
    toolLogger.api("handleToolCalls", `Reached max tool rounds (${ConversationEngine.MAX_TOOL_ROUNDS}), forcing text response`, logCtx);

    const finalParams: OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming =
      {
        model: agent.model,
        messages: toolMessages,
        max_tokens: 4096,
      };

    const finalResponse = await this.client.chat.completions.create(finalParams);
    return finalResponse.choices[0].message.content || "";
  }
}
