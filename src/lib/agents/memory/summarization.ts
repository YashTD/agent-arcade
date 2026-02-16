import OpenAI from "openai";
import type { Message, SessionAgent } from "@prisma/client";
import { prisma } from "@/lib/db";
import { estimateMessagesTokens } from "@/lib/utils/token-counter";

type MessageWithAgent = Message & { agent: SessionAgent | null };

const SUMMARY_THRESHOLD = 40; // Summarize when we have more than this many messages
const MESSAGES_TO_KEEP = 15; // Keep this many recent messages unsummarized

/**
 * Apply summarization memory strategy.
 * When messages exceed threshold, summarize older messages and keep recent ones.
 */
export async function applySummarization(
  messages: MessageWithAgent[],
  sessionId: string,
  client: OpenAI,
  summaryModel: string = "anthropic/claude-haiku-4.5"
): Promise<{
  messages: MessageWithAgent[];
  summarized: boolean;
}> {
  if (messages.length <= SUMMARY_THRESHOLD) {
    // Check if we have existing summaries to prepend
    const summaries = await prisma.conversationSummary.findMany({
      where: { sessionId },
      orderBy: { messagesTo: "asc" },
    });

    if (summaries.length > 0) {
      const summaryContent = summaries
        .map((s) => s.summary)
        .join("\n\n---\n\n");

      const summaryMessage: MessageWithAgent = {
        id: "summary",
        sessionId,
        agentId: null,
        role: "SYSTEM",
        content: `[Conversation Summary]\n${summaryContent}`,
        toolName: null,
        toolArgs: null,
        createdAt: new Date(0),
        agent: null,
      };

      return {
        messages: [summaryMessage, ...messages],
        summarized: false,
      };
    }

    return { messages, summarized: false };
  }

  // Need to summarize older messages
  const messagesToSummarize = messages.slice(0, -MESSAGES_TO_KEEP);
  const recentMessages = messages.slice(-MESSAGES_TO_KEEP);

  // Generate summary
  const summaryInput = messagesToSummarize
    .map((m) => {
      const sender =
        m.role === "HUMAN"
          ? "Human"
          : m.role === "SYSTEM"
          ? "System"
          : m.agent?.name || "Unknown";
      return `${sender}: ${m.content}`;
    })
    .join("\n");

  const tokenEstimate = estimateMessagesTokens(messagesToSummarize);

  try {
    const response = await client.chat.completions.create({
      model: summaryModel,
      messages: [
        {
          role: "system",
          content:
            "You are a conversation summarizer. Provide a concise summary of the conversation that captures key points, decisions, and context needed for the conversation to continue meaningfully. Keep it under 500 words.",
        },
        {
          role: "user",
          content: `Summarize this conversation:\n\n${summaryInput}`,
        },
      ],
      max_tokens: 1000,
    });

    const summary =
      response.choices[0]?.message?.content || "Unable to generate summary.";

    // Save summary to DB
    await prisma.conversationSummary.create({
      data: {
        sessionId,
        summary,
        messagesFrom: messagesToSummarize[0].createdAt,
        messagesTo:
          messagesToSummarize[messagesToSummarize.length - 1].createdAt,
        messageCount: messagesToSummarize.length,
      },
    });

    // Get all summaries for this session
    const allSummaries = await prisma.conversationSummary.findMany({
      where: { sessionId },
      orderBy: { messagesTo: "asc" },
    });

    const fullSummary = allSummaries.map((s) => s.summary).join("\n\n---\n\n");

    const summaryMessage: MessageWithAgent = {
      id: "summary",
      sessionId,
      agentId: null,
      role: "SYSTEM",
      content: `[Conversation Summary (${tokenEstimate} tokens summarized)]\n${fullSummary}`,
      toolName: null,
      toolArgs: null,
      createdAt: new Date(0),
      agent: null,
    };

    return {
      messages: [summaryMessage, ...recentMessages],
      summarized: true,
    };
  } catch (error) {
    console.error("Summarization error:", error);
    // Fall back to sliding window
    return { messages: recentMessages, summarized: false };
  }
}
