"use client";

import { ScrollArea } from "@/components/ui/scroll-area";
import { MessageBubble } from "./message-bubble";
import { useConversationStore } from "@/stores/conversation-store";
import { useUIStore } from "@/stores/ui-store";
import type { MessageWithAgent, SessionAgentWithTools } from "@/types";

interface AgentChatColumnProps {
  agent: SessionAgentWithTools;
  messages: MessageWithAgent[];
}

export function AgentChatColumn({ agent, messages }: AgentChatColumnProps) {
  const { pendingMessages } = useConversationStore();
  const { showToolCalls } = useUIStore();

  const allMessages = [
    ...messages,
    ...pendingMessages.filter(
      (pm) => !messages.find((m) => m.id === pm.id)
    ),
  ].filter((m) => showToolCalls || (m.role !== "TOOL_CALL" && m.role !== "TOOL_RESULT"));

  const isOwnMessage = (m: MessageWithAgent) =>
    m.agentId === agent.id;

  return (
    <div className="flex h-full min-w-0 flex-1 flex-col border-l-2 border-border first:border-l-0">
      <div
        className="flex items-center gap-2 border-b-2 px-3 py-2"
        style={{ borderBottomColor: agent.color }}
      >
        <div
          className="h-2 w-2 animate-arcade-pulse"
          style={{ backgroundColor: agent.color }}
        />
        <span className="font-pixel text-[9px] uppercase tracking-wider" style={{ color: agent.color }}>
          {agent.name}
        </span>
      </div>
      <ScrollArea className="flex-1">
        <div className="py-2">
          {allMessages.map((msg) => (
            <div
              key={msg.id}
              className={
                msg.role === "AGENT" && !isOwnMessage(msg)
                  ? "opacity-40"
                  : undefined
              }
            >
              <MessageBubble message={msg} />
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
