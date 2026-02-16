"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { Tool, CreateToolRequest } from "@/types";

export function useTools() {
  return useQuery<Tool[]>({
    queryKey: ["tools"],
    queryFn: async () => {
      const res = await fetch("/api/tools");
      if (!res.ok) throw new Error("Failed to fetch tools");
      return res.json();
    },
  });
}

export function useTool(toolId: string) {
  return useQuery<Tool>({
    queryKey: ["tools", toolId],
    queryFn: async () => {
      const res = await fetch(`/api/tools/${toolId}`);
      if (!res.ok) throw new Error("Failed to fetch tool");
      return res.json();
    },
    enabled: !!toolId,
  });
}

export function useCreateTool() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: CreateToolRequest) => {
      const res = await fetch("/api/tools", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to create tool");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tools"] });
    },
  });
}

export function useUpdateTool() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      toolId,
      data,
    }: {
      toolId: string;
      data: Partial<CreateToolRequest>;
    }) => {
      const res = await fetch(`/api/tools/${toolId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to update tool");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tools"] });
    },
  });
}

export function useDeleteTool() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (toolId: string) => {
      const res = await fetch(`/api/tools/${toolId}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to delete tool");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tools"] });
    },
  });
}
