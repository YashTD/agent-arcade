"use client";

import { useQuery } from "@tanstack/react-query";
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
