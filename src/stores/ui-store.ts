import { create } from "zustand";

interface UIState {
  // Agent columns
  collapsedAgents: Set<string>;
  showAgentColumns: boolean;
  showToolCalls: boolean;

  // Approval dialog
  approvalDialog: {
    open: boolean;
    approvalId: string;
    agentId: string;
    toolName: string;
    toolCode: string;
    toolDescription: string;
    toolParameters: Record<string, unknown>;
  } | null;

  // Actions
  toggleAgentCollapsed: (agentId: string) => void;
  setShowAgentColumns: (show: boolean) => void;
  setShowToolCalls: (show: boolean) => void;
  openApprovalDialog: (data: NonNullable<UIState["approvalDialog"]>) => void;
  closeApprovalDialog: () => void;
}

export const useUIStore = create<UIState>((set) => ({
  collapsedAgents: new Set(),
  showAgentColumns: false,
  showToolCalls: true,
  approvalDialog: null,

  toggleAgentCollapsed: (agentId) =>
    set((state) => {
      const next = new Set(state.collapsedAgents);
      if (next.has(agentId)) {
        next.delete(agentId);
      } else {
        next.add(agentId);
      }
      return { collapsedAgents: next };
    }),

  setShowAgentColumns: (show) => set({ showAgentColumns: show }),

  setShowToolCalls: (show) => set({ showToolCalls: show }),

  openApprovalDialog: (data) => set({ approvalDialog: data }),

  closeApprovalDialog: () => set({ approvalDialog: null }),
}));
