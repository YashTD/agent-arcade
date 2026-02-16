"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { AgentTemplate, CreateAgentTemplateRequest } from "@/types";

export function useAgentTemplates() {
  return useQuery<AgentTemplate[]>({
    queryKey: ["agent-templates"],
    queryFn: async () => {
      const res = await fetch("/api/agent-templates");
      if (!res.ok) throw new Error("Failed to fetch agent templates");
      return res.json();
    },
  });
}

export function useCreateAgentTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: CreateAgentTemplateRequest) => {
      const res = await fetch("/api/agent-templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to create agent template");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["agent-templates"] });
    },
  });
}

export function useUpdateAgentTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      templateId,
      data,
    }: {
      templateId: string;
      data: Partial<CreateAgentTemplateRequest>;
    }) => {
      const res = await fetch(`/api/agent-templates/${templateId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to update agent template");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["agent-templates"] });
    },
  });
}

export function useDeleteAgentTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (templateId: string) => {
      const res = await fetch(`/api/agent-templates/${templateId}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to delete agent template");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["agent-templates"] });
    },
  });
}
