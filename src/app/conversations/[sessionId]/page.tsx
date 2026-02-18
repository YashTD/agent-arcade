"use client";

import { useState, use, useEffect, useRef } from "react";
import { useSession, useCreateAgent, useUpdateAgent, useDeleteAgent, useUpdateSession } from "@/hooks/use-sessions";
import { useMessages } from "@/hooks/use-messages";
import { useTools } from "@/hooks/use-tools";
import { useSSE } from "@/hooks/use-sse";
import { useConversationStore } from "@/stores/conversation-store";
import { useUIStore } from "@/stores/ui-store";
import { AgentColumn } from "@/components/agent-setup/agent-column";
import { SharedChatPanel } from "@/components/chat/shared-chat-panel";
import { AgentChatColumn } from "@/components/chat/agent-chat-column";
import { HumanInputBar } from "@/components/chat/human-input-bar";
import { ConversationControls } from "@/components/controls/conversation-controls";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { useToast } from "@/components/ui/use-toast";
import { useAgentTemplates } from "@/hooks/use-agent-templates";
import { Plus, PanelRight, MessageSquare, Terminal, Bot } from "lucide-react";
import { AGENT_COLORS } from "@/types";

export default function SessionPage({ params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = use(params);
  const { data: session, isLoading: sessionLoading } = useSession(sessionId);
  const { data: messages = [], isLoading: messagesLoading } = useMessages(sessionId);
  const { data: allTools = [] } = useTools();
  const createAgent = useCreateAgent(sessionId);
  const updateAgent = useUpdateAgent(sessionId);
  const deleteAgent = useDeleteAgent(sessionId);
  const updateSession = useUpdateSession();
  const { startConversation, stopConversation } = useSSE(sessionId);
  const { isRunning } = useConversationStore();
  const { collapsedAgents, toggleAgentCollapsed, showAgentColumns, setShowAgentColumns, showToolCalls, setShowToolCalls } = useUIStore();
  const { toast } = useToast();
  const { data: templates = [] } = useAgentTemplates();

  // Heartbeat auto-resume: track isRunning via ref to avoid stale closures
  const isRunningRef = useRef(isRunning);
  useEffect(() => {
    isRunningRef.current = isRunning;
  }, [isRunning]);

  useEffect(() => {
    const interval = session?.heartbeatInterval;
    if (!interval || interval <= 0) return;

    const timer = setInterval(() => {
      if (!isRunningRef.current) {
        if (session.isInfinite) {
          startConversation({ infinite: true });
        } else {
          startConversation({ turns: 1 });
        }
      }
    }, interval * 1000);

    return () => clearInterval(timer);
  }, [session?.heartbeatInterval, session?.isInfinite, startConversation]);

  const [addAgentOpen, setAddAgentOpen] = useState(false);
  const [newAgent, setNewAgent] = useState({ name: "", model: "anthropic/claude-haiku-4.5", systemPrompt: "" });
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");

  if (sessionLoading || !session) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="font-pixel text-sm text-primary glow-pink animate-arcade-pulse">
          LOADING ARENA...
        </div>
      </div>
    );
  }

  const agents = session.agents || [];

  const handleAddAgent = async () => {
    if (!newAgent.name.trim() || !newAgent.systemPrompt.trim()) {
      toast({ title: "Name and Character required", variant: "destructive" });
      return;
    }
    try {
      const selectedTemplate = templates.find((t) => t.id === selectedTemplateId);
      const rawToolIds = selectedTemplate
        ? (typeof selectedTemplate.toolIds === "string"
            ? JSON.parse(selectedTemplate.toolIds)
            : selectedTemplate.toolIds) as string[]
        : undefined;
      const toolIds = rawToolIds?.filter((id: string) =>
        allTools.some((t) => t.id === id)
      );

      await createAgent.mutateAsync({
        name: newAgent.name,
        model: newAgent.model,
        systemPrompt: newAgent.systemPrompt,
        color: AGENT_COLORS[agents.length % AGENT_COLORS.length],
        ...(toolIds && toolIds.length > 0 ? { toolIds } : {}),
      });
      setAddAgentOpen(false);
      setNewAgent({ name: "", model: "anthropic/claude-haiku-4.5", systemPrompt: "" });
      setSelectedTemplateId("");
    } catch (err) {
      toast({ title: "Error", description: err instanceof Error ? err.message : "Failed", variant: "destructive" });
    }
  };

  const handleSendMessage = (content: string, targetAgentId?: string) => {
    if (session.isInfinite) {
      startConversation({ content, targetAgentId, infinite: true });
    } else {
      startConversation({ content, targetAgentId, turns: agents.length });
    }
  };

  const handleProgress = (targetAgentId?: string) => {
    if (session.isInfinite) {
      startConversation({ targetAgentId, infinite: true });
    } else {
      startConversation({ targetAgentId, turns: 1 });
    }
  };

  const handleSessionUpdate = (data: Record<string, unknown>) => {
    updateSession.mutate({ sessionId, data: data as any });
  };

  return (
    <div className="flex h-[calc(100vh-4.5rem)] flex-col">
      {/* Agent setup row */}
      <div className="flex items-stretch gap-2 overflow-x-auto border-b-2 border-border p-2 bg-muted/10">
        {agents.map((agent) => (
          <AgentColumn
            key={agent.id}
            agent={agent}
            allTools={allTools}
            collapsed={collapsedAgents.has(agent.id)}
            onToggleCollapse={() => toggleAgentCollapsed(agent.id)}
            onUpdate={(data) => updateAgent.mutate({ agentId: agent.id, data })}
            onDelete={() => {
              if (confirm(`Delete agent "${agent.name}"?`)) {
                deleteAgent.mutate(agent.id);
              }
            }}
          />
        ))}
        <Button variant="outline" className="shrink-0 self-start border-primary/50 hover:border-primary" onClick={() => setAddAgentOpen(true)}>
          <Plus className="mr-1 h-4 w-4" />
          <span className="font-pixel text-[9px]">ADD PLAYER</span>
        </Button>
      </div>

      {/* Controls */}
      <ConversationControls
        turnOrder={session.turnOrder}
        memoryStrategy={session.memoryStrategy}
        isInfinite={session.isInfinite}
        isSlow={session.isSlow}
        orchestratorModel={session.orchestratorModel}
        heartbeatInterval={session.heartbeatInterval ?? null}
        onTurnOrderChange={(v) => handleSessionUpdate({ turnOrder: v })}
        onMemoryStrategyChange={(v) => handleSessionUpdate({ memoryStrategy: v })}
        onInfiniteChange={(v) => handleSessionUpdate({ isInfinite: v })}
        onSlowChange={(v) => handleSessionUpdate({ isSlow: v })}
        onOrchestratorModelChange={(v) => handleSessionUpdate({ orchestratorModel: v })}
        onHeartbeatIntervalChange={(v) => handleSessionUpdate({ heartbeatInterval: v })}
        disabled={isRunning}
      />

      {/* Chat area */}
      <div className="relative flex flex-1 overflow-hidden">
        {/* View toggles */}
        <div className="absolute right-2 top-2 z-10 flex gap-1">
          <Button
            variant="ghost"
            size="icon"
            className={showToolCalls ? "border-neon-blue text-neon-blue" : "opacity-40"}
            onClick={() => setShowToolCalls(!showToolCalls)}
            title={showToolCalls ? "Hide tool calls" : "Show tool calls"}
          >
            <Terminal className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className={showAgentColumns ? "border-neon-cyan text-neon-cyan" : "opacity-60"}
            onClick={() => setShowAgentColumns(!showAgentColumns)}
            title={showAgentColumns ? "Combined view" : "Multi-view"}
          >
            {showAgentColumns ? <MessageSquare className="h-4 w-4" /> : <PanelRight className="h-4 w-4" />}
          </Button>
        </div>

        {showAgentColumns ? (
          agents.map((agent) => (
            <AgentChatColumn key={agent.id} agent={agent} messages={messages} />
          ))
        ) : (
          <SharedChatPanel messages={messages} />
        )}
      </div>

      {/* Input bar */}
      <HumanInputBar
        agents={agents}
        turnOrder={session.turnOrder}
        isRunning={isRunning}
        onSendMessage={handleSendMessage}
        onProgressConversation={handleProgress}
        onStop={stopConversation}
      />

      {/* Add Agent Dialog */}
      <Dialog open={addAgentOpen} onOpenChange={(open) => {
        setAddAgentOpen(open);
        if (!open) {
          setSelectedTemplateId("");
          setNewAgent({ name: "", model: "anthropic/claude-haiku-4.5", systemPrompt: "" });
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>ADD PLAYER</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {templates.length > 0 && (
              <div>
                <Label className="font-pixel text-[8px] text-neon-yellow uppercase">Load Template</Label>
                <Select
                  value={selectedTemplateId}
                  onValueChange={(value) => {
                    setSelectedTemplateId(value);
                    const tmpl = templates.find((t) => t.id === value);
                    if (tmpl) {
                      setNewAgent({
                        name: tmpl.name,
                        model: tmpl.model,
                        systemPrompt: tmpl.systemPrompt,
                      });
                    }
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a template..." />
                  </SelectTrigger>
                  <SelectContent>
                    {templates.map((tmpl) => (
                      <SelectItem key={tmpl.id} value={tmpl.id}>
                        {tmpl.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div>
              <Label className="font-pixel text-[8px] text-neon-cyan uppercase">Name</Label>
              <Input value={newAgent.name} onChange={(e) => setNewAgent((a) => ({ ...a, name: e.target.value }))} placeholder="Player name" />
            </div>
            <div>
              <Label className="font-pixel text-[8px] text-neon-cyan uppercase">Model</Label>
              <Input value={newAgent.model} onChange={(e) => setNewAgent((a) => ({ ...a, model: e.target.value }))} placeholder="anthropic/claude-haiku-4.5" className="font-retro text-sm" />
            </div>
            <div>
              <Label className="font-pixel text-[8px] text-neon-cyan uppercase">Character</Label>
              <Textarea value={newAgent.systemPrompt} onChange={(e) => setNewAgent((a) => ({ ...a, systemPrompt: e.target.value }))} rows={5} placeholder="You are..." className="font-retro" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddAgentOpen(false)}>CANCEL</Button>
            <Button onClick={handleAddAgent} disabled={createAgent.isPending}>JOIN GAME</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
