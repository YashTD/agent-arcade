"use client";

import { useEffect, useRef } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MessageBubble } from "./message-bubble";
import { useConversationStore, type ToolEvent } from "@/stores/conversation-store";
import { useUIStore } from "@/stores/ui-store";
import type { MessageWithAgent } from "@/types";
import { cn } from "@/lib/utils";
import { Terminal, CheckCircle2, XCircle, ArrowRight } from "lucide-react";

interface SharedChatPanelProps {
  messages: MessageWithAgent[];
}

function LiveToolEvent({ event }: { event: ToolEvent }) {
  const isCall = event.type === "tool_call";
  let isError = false;
  if (!isCall && typeof event.data === "object" && event.data !== null) {
    isError = "error" in (event.data as Record<string, unknown>);
  }

  const summary =
    typeof event.data === "object" && event.data !== null
      ? JSON.stringify(event.data, null, 2)
      : String(event.data ?? "");

  return (
    <div className="mx-4 my-1">
      <div
        className={cn(
          "border-2 text-sm font-retro px-3 py-1.5",
          isCall
            ? "border-neon-blue/50 bg-neon-blue/5"
            : isError
            ? "border-neon-red/50 bg-neon-red/5"
            : "border-neon-green/50 bg-neon-green/5"
        )}
      >
        <div className="flex items-center gap-2">
          {isCall ? (
            <Terminal className="h-3 w-3 shrink-0 text-neon-blue animate-spin" />
          ) : isError ? (
            <XCircle className="h-3 w-3 shrink-0 text-neon-red" />
          ) : (
            <CheckCircle2 className="h-3 w-3 shrink-0 text-neon-green" />
          )}
          <span className="font-bold">{event.agentName || "Agent"}</span>
          <ArrowRight className="h-3 w-3 shrink-0 text-muted-foreground" />
          <span className="font-pixel text-[9px] font-bold">{event.toolName}</span>
          <span className={cn(
            "ml-auto font-pixel text-[8px] uppercase",
            isCall ? "text-neon-blue animate-arcade-pulse" : isError ? "text-neon-red" : "text-neon-green"
          )}>
            {isCall ? "EXEC..." : isError ? "FAIL" : "OK"}
          </span>
        </div>
        {summary && (
          <pre className="mt-1 max-h-20 overflow-auto font-retro text-sm text-muted-foreground whitespace-pre-wrap break-all">
            {summary.length > 500 ? summary.substring(0, 500) + "..." : summary}
          </pre>
        )}
      </div>
    </div>
  );
}

export function SharedChatPanel({ messages }: SharedChatPanelProps) {
  const { pendingMessages, streamingContent, currentSpeaker, toolEvents } =
    useConversationStore();
  const { showToolCalls } = useUIStore();
  const bottomRef = useRef<HTMLDivElement>(null);

  const allMessages = [
    ...messages,
    ...pendingMessages.filter(
      (pm) => !messages.find((m) => m.id === pm.id)
    ),
  ].filter((m) => showToolCalls || (m.role !== "TOOL_CALL" && m.role !== "TOOL_RESULT"));

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [allMessages.length, streamingContent, toolEvents.length]);

  return (
    <ScrollArea className="flex-1">
      <div className="py-4">
        {allMessages.length === 0 && toolEvents.length === 0 && (
          <div className="flex flex-col items-center justify-center p-12">
            <div className="font-pixel text-xs text-muted-foreground uppercase tracking-widest mb-2">
              Waiting for input
            </div>
            <div className="font-retro text-lg text-muted-foreground">
              Send a message or press START to begin
            </div>
            <span className="arcade-cursor mt-4" />
          </div>
        )}

        {allMessages.map((msg) => (
          <MessageBubble key={msg.id} message={msg} />
        ))}

        {/* Live tool events */}
        {showToolCalls && toolEvents.map((event) => (
          <LiveToolEvent key={event.id} event={event} />
        ))}

        {/* Streaming indicator */}
        {currentSpeaker && streamingContent[currentSpeaker] && (
          <div className="mx-4 my-2 flex justify-start">
            <div className="max-w-[80%] border-2 border-neon-cyan/50 bg-neon-cyan/5 px-4 py-2">
              <div className="mb-1 font-pixel text-[8px] text-neon-cyan uppercase">
                Transmitting...
              </div>
              <div className="whitespace-pre-wrap text-lg font-retro leading-tight">
                {streamingContent[currentSpeaker]}
                <span className="arcade-cursor" />
              </div>
            </div>
          </div>
        )}

        {currentSpeaker && !streamingContent[currentSpeaker] && toolEvents.length === 0 && (
          <div className="mx-4 my-2 flex justify-start">
            <div className="border-2 border-neon-yellow/50 bg-neon-yellow/5 px-4 py-2">
              <div className="flex items-center gap-3 font-pixel text-[8px] text-neon-yellow uppercase">
                <div className="flex gap-1">
                  <span className="h-2 w-2 animate-bounce bg-neon-yellow" style={{ animationDelay: "0ms" }} />
                  <span className="h-2 w-2 animate-bounce bg-neon-yellow" style={{ animationDelay: "150ms" }} />
                  <span className="h-2 w-2 animate-bounce bg-neon-yellow" style={{ animationDelay: "300ms" }} />
                </div>
                <span>Processing...</span>
              </div>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>
    </ScrollArea>
  );
}
