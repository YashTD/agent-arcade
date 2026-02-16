import { create } from "zustand";
import type { MessageWithAgent } from "@/types";

export interface ToolEvent {
  id: string;
  type: "tool_call" | "tool_result";
  agentId: string;
  agentName?: string;
  toolName: string;
  data: unknown;
  timestamp: number;
}

interface ConversationState {
  sessionId: string | null;
  isRunning: boolean;
  currentSpeaker: string | null;
  streamingContent: Record<string, string>;
  pendingMessages: MessageWithAgent[];
  toolEvents: ToolEvent[];

  setSessionId: (id: string | null) => void;
  setIsRunning: (running: boolean) => void;
  setCurrentSpeaker: (agentId: string | null) => void;
  appendStreamToken: (agentId: string, token: string) => void;
  clearStreamContent: (agentId: string) => void;
  addPendingMessage: (message: MessageWithAgent) => void;
  clearPendingMessages: () => void;
  addToolEvent: (event: ToolEvent) => void;
  clearToolEvents: () => void;
  reset: () => void;
}

let toolEventCounter = 0;

export const useConversationStore = create<ConversationState>((set) => ({
  sessionId: null,
  isRunning: false,
  currentSpeaker: null,
  streamingContent: {},
  pendingMessages: [],
  toolEvents: [],

  setSessionId: (id) => set({ sessionId: id }),
  setIsRunning: (running) => set({ isRunning: running }),
  setCurrentSpeaker: (agentId) => set({ currentSpeaker: agentId }),

  appendStreamToken: (agentId, token) =>
    set((state) => ({
      streamingContent: {
        ...state.streamingContent,
        [agentId]: (state.streamingContent[agentId] || "") + token,
      },
    })),

  clearStreamContent: (agentId) =>
    set((state) => {
      const next = { ...state.streamingContent };
      delete next[agentId];
      return { streamingContent: next };
    }),

  addPendingMessage: (message) =>
    set((state) => ({
      pendingMessages: [...state.pendingMessages, message],
    })),

  clearPendingMessages: () => set({ pendingMessages: [] }),

  addToolEvent: (event) =>
    set((state) => ({
      toolEvents: [...state.toolEvents, { ...event, id: `te-${++toolEventCounter}` }],
    })),

  clearToolEvents: () => set({ toolEvents: [] }),

  reset: () =>
    set({
      sessionId: null,
      isRunning: false,
      currentSpeaker: null,
      streamingContent: {},
      pendingMessages: [],
      toolEvents: [],
    }),
}));
