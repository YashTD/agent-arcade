"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type {
  Session,
  SessionWithAgents,
  CreateSessionRequest,
  CreateAgentRequest,
} from "@/types";

export function useSessions() {
  return useQuery<Session[]>({
    queryKey: ["sessions"],
    queryFn: async () => {
      const res = await fetch("/api/sessions");
      if (!res.ok) throw new Error("Failed to fetch sessions");
      return res.json();
    },
  });
}

export function useSession(sessionId: string) {
  return useQuery<SessionWithAgents>({
    queryKey: ["sessions", sessionId],
    queryFn: async () => {
      const res = await fetch(`/api/sessions/${sessionId}`);
      if (!res.ok) throw new Error("Failed to fetch session");
      return res.json();
    },
    enabled: !!sessionId,
  });
}

export function useCreateSession() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: CreateSessionRequest) => {
      const res = await fetch("/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to create session");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sessions"] });
    },
  });
}

export function useDeleteSession() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (sessionId: string) => {
      const res = await fetch(`/api/sessions/${sessionId}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to delete session");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sessions"] });
    },
  });
}

export function useUpdateSession() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      sessionId,
      data,
    }: {
      sessionId: string;
      data: Partial<CreateSessionRequest> & { status?: string; isInfinite?: boolean; isSlow?: boolean };
    }) => {
      const res = await fetch(`/api/sessions/${sessionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to update session");
      return res.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["sessions"] });
      queryClient.invalidateQueries({
        queryKey: ["sessions", variables.sessionId],
      });
    },
  });
}

// Agent mutations
export function useCreateAgent(sessionId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: CreateAgentRequest) => {
      const res = await fetch(`/api/sessions/${sessionId}/agents`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to create agent");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sessions", sessionId] });
    },
  });
}

export function useUpdateAgent(sessionId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      agentId,
      data,
    }: {
      agentId: string;
      data: Partial<CreateAgentRequest>;
    }) => {
      const res = await fetch(
        `/api/sessions/${sessionId}/agents/${agentId}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        }
      );
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to update agent");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sessions", sessionId] });
    },
  });
}

export function useDeleteAgent(sessionId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (agentId: string) => {
      const res = await fetch(
        `/api/sessions/${sessionId}/agents/${agentId}`,
        { method: "DELETE" }
      );
      if (!res.ok) throw new Error("Failed to delete agent");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sessions", sessionId] });
    },
  });
}
