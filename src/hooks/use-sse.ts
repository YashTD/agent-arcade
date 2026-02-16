"use client";

import { useCallback, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useConversationStore } from "@/stores/conversation-store";
import { useUIStore } from "@/stores/ui-store";
import type { MessageWithAgent } from "@/types";

type Store = ReturnType<typeof useConversationStore.getState>;
type UIStore = ReturnType<typeof useUIStore.getState>;

function handleEvent(
  event: { type: string; data: Record<string, unknown> },
  store: Store,
  uiStore: UIStore
) {
  switch (event.type) {
    case "turn_start":
      store.setCurrentSpeaker(event.data.agentId as string);
      break;

    case "token":
      store.appendStreamToken(
        event.data.agentId as string,
        event.data.token as string
      );
      break;

    case "turn_end":
      store.clearStreamContent(event.data.agentId as string);
      store.clearToolEvents();
      if (event.data.message) {
        store.addPendingMessage(event.data.message as MessageWithAgent);
      }
      break;

    case "tool_call":
      store.addToolEvent({
        id: "",
        type: "tool_call",
        agentId: event.data.agentId as string,
        agentName: event.data.agentName as string | undefined,
        toolName: event.data.toolName as string,
        data: event.data.args,
        timestamp: Date.now(),
      });
      break;

    case "tool_result":
      store.addToolEvent({
        id: "",
        type: "tool_result",
        agentId: event.data.agentId as string,
        agentName: event.data.agentName as string | undefined,
        toolName: event.data.toolName as string,
        data: event.data.result,
        timestamp: Date.now(),
      });
      break;

    case "approval_required":
      uiStore.openApprovalDialog({
        open: true,
        approvalId: event.data.approvalId as string,
        agentId: event.data.agentId as string,
        toolName: event.data.toolName as string,
        toolCode: event.data.toolCode as string,
        toolDescription: event.data.toolDescription as string,
        toolParameters: event.data.toolParameters as Record<string, unknown>,
      });
      break;

    case "error":
      console.error("Conversation error:", event.data.message);
      break;

    case "conversation_complete":
    case "conversation_paused":
      store.setIsRunning(false);
      break;
  }
}

export function useSSE(sessionId: string) {
  const abortRef = useRef<AbortController | null>(null);
  const queryClient = useQueryClient();

  const startConversation = useCallback(
    async (options?: {
      content?: string;
      targetAgentId?: string;
      turns?: number;
      infinite?: boolean;
    }) => {
      if (abortRef.current) {
        abortRef.current.abort();
      }

      const controller = new AbortController();
      abortRef.current = controller;

      const store = useConversationStore.getState();
      const uiStore = useUIStore.getState();
      store.setIsRunning(true);

      try {
        const body: Record<string, unknown> = {};
        if (options?.content) body.content = options.content;
        if (options?.targetAgentId) body.targetAgentId = options.targetAgentId;
        if (options?.turns) body.turns = options.turns;
        if (options?.infinite) body.infinite = options.infinite;

        const res = await fetch(
          `/api/sessions/${sessionId}/conversation`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
            signal: controller.signal,
          }
        );

        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || "Conversation failed");
        }

        const reader = res.body?.getReader();
        if (!reader) throw new Error("No response body");

        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            if (line.startsWith("data: ")) {
              const data = line.slice(6);
              if (data === "[DONE]") continue;
              try {
                const event = JSON.parse(data);
                handleEvent(
                  event,
                  useConversationStore.getState(),
                  useUIStore.getState()
                );
              } catch {
                // Skip invalid JSON
              }
            }
          }
        }
      } catch (err) {
        if (err instanceof Error && err.name !== "AbortError") {
          console.error("SSE error:", err);
        }
      } finally {
        useConversationStore.getState().setIsRunning(false);
        useConversationStore.getState().setCurrentSpeaker(null);
        queryClient.invalidateQueries({ queryKey: ["messages", sessionId] });
        queryClient.invalidateQueries({ queryKey: ["sessions", sessionId] });
      }
    },
    [sessionId, queryClient]
  );

  const stopConversation = useCallback(() => {
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
    useConversationStore.getState().setIsRunning(false);
    useConversationStore.getState().setCurrentSpeaker(null);
  }, []);

  return { startConversation, stopConversation };
}
