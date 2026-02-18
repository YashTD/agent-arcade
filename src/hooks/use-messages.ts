"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { MessageWithAgent } from "@/types";

export function useMessages(sessionId: string) {
  return useQuery<MessageWithAgent[]>({
    queryKey: ["messages", sessionId],
    queryFn: async () => {
      const res = await fetch(`/api/sessions/${sessionId}/messages`);
      if (!res.ok) throw new Error("Failed to fetch messages");
      return res.json();
    },
    enabled: !!sessionId,
    refetchInterval: false,
  });
}

export function useClearMessages(sessionId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/sessions/${sessionId}/messages`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to clear messages");
      return res.json();
    },
    onSuccess: () => {
      queryClient.setQueryData(["messages", sessionId], []);
    },
  });
}
