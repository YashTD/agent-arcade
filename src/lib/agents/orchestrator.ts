import OpenAI from "openai";
import type { SessionAgent, Message, Tool } from "@prisma/client";

type MessageWithAgent = Message & { agent: SessionAgent | null };
type AgentWithTools = SessionAgent & { tools: { tool: Tool }[] };

export async function getOrchestratedAgent(
  agents: AgentWithTools[],
  recentMessages: MessageWithAgent[],
  client: OpenAI,
  model: string = "anthropic/claude-haiku-4.5"
): Promise<SessionAgent | null> {
  if (agents.length === 0) return null;
  if (agents.length === 1) return agents[0];

  // Find who spoke last (AGENT messages only, skip TOOL_CALL/TOOL_RESULT)
  const lastAgentMsg = [...recentMessages]
    .reverse()
    .find((m) => m.role === "AGENT");
  const lastSpeakerId = lastAgentMsg?.agentId ?? null;

  // Check if the last message directly addresses an agent by name
  const lastMsg = [...recentMessages]
    .reverse()
    .find((m) => m.role === "AGENT" || m.role === "HUMAN");
  const lastContent = lastMsg?.content?.toLowerCase() || "";
  const directlyAddressed = agents.find(
    (a) =>
      a.id !== lastMsg?.agentId &&
      (lastContent.includes(`@${a.name.toLowerCase()}`) ||
        lastContent.includes(`hey ${a.name.toLowerCase()}`) ||
        lastContent.includes(`${a.name.toLowerCase()}, `))
  );

  // If someone was directly addressed, they must speak — even if they spoke last
  if (directlyAddressed) return directlyAddressed;

  // Otherwise, exclude the last speaker to avoid back-to-back turns
  const eligible = agents.filter((a) => a.id !== lastSpeakerId);
  // If somehow all filtered out (shouldn't happen with 2+ agents), allow all
  const candidates = eligible.length > 0 ? eligible : agents;

  // If only one candidate, skip the LLM call
  if (candidates.length === 1) return candidates[0];

  const agentProfiles = candidates
    .map((a) => {
      const tools = a.tools.map((t) => t.tool.name).join(", ");
      return `- "${a.name}" — ${a.systemPrompt.substring(0, 500)}${tools ? `\n  Tools: ${tools}` : ""}`;
    })
    .join("\n");

  const transcript = recentMessages
    .filter((m) => m.role === "HUMAN" || m.role === "AGENT")
    .slice(-20)
    .map((m) => {
      const sender = m.role === "HUMAN" ? "Human" : m.agent?.name || "Unknown";
      return `[${sender}]: ${m.content.substring(0, 400)}`;
    })
    .join("\n");

  // Turn counts for balancing
  const speakerCounts: Record<string, number> = {};
  for (const m of recentMessages) {
    if (m.role === "AGENT" && m.agent) {
      speakerCounts[m.agent.name] = (speakerCounts[m.agent.name] || 0) + 1;
    }
  }

  const namesStr = candidates.map((a) => `"${a.name}"`).join(", ");

  try {
    const response = await client.chat.completions.create({
      model,
      messages: [
        {
          role: "system",
          content: `You route a multi-agent conversation. Pick which agent speaks next.

ELIGIBLE AGENTS (the last speaker has already been excluded):
${agentProfiles}

ROUTING RULES (in priority order):
1. DIRECT ADDRESS — If the last message explicitly names or addresses a specific agent (e.g. "Hey Alice, what do you think?" or "@Bob"), that agent MUST speak next. This overrides all other rules.
2. QUESTION DIRECTED — If an agent was asked a question or given a request by another agent, let them reply.
3. RELEVANCE — Pick the agent whose expertise or tool set is most relevant to the current topic or request.
4. TIE-BREAK — Among otherwise equal candidates, pick the one with the fewest turns.

Turn counts so far (for context only): ${Object.entries(speakerCounts).map(([n, c]) => `${n}: ${c}`).join(", ") || "none yet"}

Reply with ONLY one of: ${namesStr}`,
        },
        {
          role: "user",
          content: transcript || "The conversation is just starting.",
        },
      ],
      max_tokens: 30,
      temperature: 0.1,
    });

    const raw = response.choices[0]?.message?.content?.trim() || "";
    const cleaned = raw.replace(/^["']|["']$/g, "").trim();

    const selected =
      candidates.find((a) => a.name === cleaned) ||
      candidates.find((a) => a.name.toLowerCase() === cleaned.toLowerCase()) ||
      candidates.find((a) => cleaned.toLowerCase().includes(a.name.toLowerCase()));

    if (selected) return selected;

    // Fallback: least turns among candidates
    const sorted = [...candidates].sort(
      (a, b) => (speakerCounts[a.name] || 0) - (speakerCounts[b.name] || 0)
    );
    return sorted[0];
  } catch (error) {
    console.error("Orchestrator error:", error);
    const sorted = [...candidates].sort(
      (a, b) => (speakerCounts[a.name] || 0) - (speakerCounts[b.name] || 0)
    );
    return sorted[0];
  }
}
