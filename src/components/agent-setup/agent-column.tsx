"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ChevronDown, ChevronRight, Trash2, Save, BookmarkPlus, Bot } from "lucide-react";
import { cn } from "@/lib/utils";
import { useCreateAgentTemplate } from "@/hooks/use-agent-templates";
import { useToast } from "@/components/ui/use-toast";
import type { SessionAgentWithTools, Tool } from "@/types";

interface AgentColumnProps {
  agent: SessionAgentWithTools;
  allTools: Tool[];
  collapsed: boolean;
  onToggleCollapse: () => void;
  onUpdate: (data: {
    name?: string;
    model?: string;
    systemPrompt?: string;
    toolIds?: string[];
  }) => void;
  onDelete: () => void;
}

export function AgentColumn({
  agent,
  allTools,
  collapsed,
  onToggleCollapse,
  onUpdate,
  onDelete,
}: AgentColumnProps) {
  const [name, setName] = useState(agent.name);
  const [model, setModel] = useState(agent.model);
  const [systemPrompt, setSystemPrompt] = useState(agent.systemPrompt);
  const [selectedToolIds, setSelectedToolIds] = useState<string[]>(
    agent.tools.map((t) => t.tool.id)
  );
  const [dirty, setDirty] = useState(false);
  const createTemplate = useCreateAgentTemplate();
  const { toast } = useToast();

  const handleSaveAsTemplate = async () => {
    try {
      const result = await createTemplate.mutateAsync({
        name: agent.name,
        model: agent.model,
        systemPrompt: agent.systemPrompt,
        toolIds: agent.tools.map((t) => t.tool.id),
      });
      const isUpdate = new Date(result.createdAt).getTime() !== new Date(result.updatedAt).getTime();
      toast({ title: `Template "${agent.name}" ${isUpdate ? "updated" : "saved"}` });
    } catch (err) {
      toast({
        title: "Failed to save template",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      });
    }
  };

  const handleToolToggle = (toolId: string) => {
    setSelectedToolIds((prev) =>
      prev.includes(toolId)
        ? prev.filter((id) => id !== toolId)
        : [...prev, toolId]
    );
    setDirty(true);
  };

  const handleSave = () => {
    onUpdate({ name, model, systemPrompt, toolIds: selectedToolIds });
    setDirty(false);
  };

  return (
    <div
      className={cn(
        "flex flex-col border-2 overflow-hidden shrink-0 transition-all",
        collapsed ? "w-12" : "w-72"
      )}
      style={{ borderColor: agent.color }}
    >
      {/* Header */}
      <div
        className="flex items-center gap-2 p-2 cursor-pointer bg-muted/30 border-b-2"
        style={{ borderBottomColor: agent.color }}
        onClick={onToggleCollapse}
      >
        {collapsed ? (
          <ChevronRight className="h-4 w-4 text-foreground" />
        ) : (
          <ChevronDown className="h-4 w-4 text-foreground" />
        )}
        {!collapsed && (
          <>
            <Bot
              className="h-4 w-4 shrink-0"
              style={{ color: agent.color }}
            />
            <span
              className="font-pixel text-[9px] uppercase tracking-wider truncate flex-1"
              style={{ color: agent.color }}
            >
              {agent.name}
            </span>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 shrink-0 hover:text-neon-yellow hover:border-neon-yellow"
              title="Save as template"
              onClick={(e) => {
                e.stopPropagation();
                handleSaveAsTemplate();
              }}
              disabled={createTemplate.isPending}
            >
              <BookmarkPlus className="h-3 w-3" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 shrink-0 hover:text-destructive hover:border-destructive"
              onClick={(e) => {
                e.stopPropagation();
                onDelete();
              }}
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          </>
        )}
        {collapsed && (
          <span
            className="font-pixel text-[8px] uppercase"
            style={{
              writingMode: "vertical-lr",
              transform: "rotate(180deg)",
              color: agent.color,
            }}
          >
            {agent.name}
          </span>
        )}
      </div>

      {/* Body */}
      {!collapsed && (
        <div className="flex-1 overflow-y-auto p-3 space-y-3">
          <div>
            <Label className="font-pixel text-[8px] text-neon-cyan uppercase">Name</Label>
            <Input
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setDirty(true);
              }}
              className="h-8 text-sm"
            />
          </div>

          <div>
            <Label className="font-pixel text-[8px] text-neon-cyan uppercase">Model</Label>
            <Input
              value={model}
              onChange={(e) => {
                setModel(e.target.value);
                setDirty(true);
              }}
              className="h-8 text-sm font-retro"
              placeholder="anthropic/claude-haiku-4.5"
            />
          </div>

          <div>
            <Label className="font-pixel text-[8px] text-neon-cyan uppercase">Character</Label>
            <Textarea
              value={systemPrompt}
              onChange={(e) => {
                setSystemPrompt(e.target.value);
                setDirty(true);
              }}
              className="text-sm min-h-[100px] font-retro"
              rows={5}
            />
          </div>

          <div>
            <Label className="font-pixel text-[8px] text-neon-yellow uppercase">Power-Ups</Label>
            <div className="mt-1 space-y-2">
              {(() => {
                const groups = new Map<string, Tool[]>();
                const ungrouped: Tool[] = [];
                for (const tool of allTools) {
                  const g = (tool as Tool & { toolGroup?: string | null }).toolGroup;
                  if (g) {
                    if (!groups.has(g)) groups.set(g, []);
                    groups.get(g)!.push(tool);
                  } else {
                    ungrouped.push(tool);
                  }
                }
                return (
                  <>
                    {Array.from(groups.entries()).map(([groupName, tools]) => {
                      const groupIds = tools.map((t) => t.id);
                      const selectedCount = groupIds.filter((id) => selectedToolIds.includes(id)).length;
                      const allSelected = selectedCount === groupIds.length;
                      const noneSelected = selectedCount === 0;
                      const handleGroupToggle = () => {
                        setSelectedToolIds((prev) => {
                          if (allSelected) {
                            return prev.filter((id) => !groupIds.includes(id));
                          } else {
                            return [...new Set([...prev, ...groupIds])];
                          }
                        });
                        setDirty(true);
                      };
                      return (
                        <div key={groupName} className="flex flex-wrap gap-1 items-center">
                          <Badge
                            variant={allSelected ? "default" : noneSelected ? "outline" : "secondary"}
                            className={cn(
                              "cursor-pointer text-[9px] capitalize",
                              !allSelected && !noneSelected && "border-dashed"
                            )}
                            onClick={handleGroupToggle}
                          >
                            {groupName}
                          </Badge>
                          {tools.map((tool) => (
                            <Badge
                              key={tool.id}
                              variant={selectedToolIds.includes(tool.id) ? "default" : "outline"}
                              className="cursor-pointer text-[9px]"
                              onClick={() => handleToolToggle(tool.id)}
                            >
                              {tool.name}
                            </Badge>
                          ))}
                        </div>
                      );
                    })}
                    {ungrouped.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {ungrouped.map((tool) => (
                          <Badge
                            key={tool.id}
                            variant={selectedToolIds.includes(tool.id) ? "default" : "outline"}
                            className="cursor-pointer text-[9px]"
                            onClick={() => handleToolToggle(tool.id)}
                          >
                            {tool.name}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </>
                );
              })()}
            </div>
          </div>

          {dirty && (
            <Button size="sm" className="w-full" onClick={handleSave}>
              <Save className="mr-1 h-3 w-3" />
              <span className="font-pixel text-[9px]">SAVE</span>
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
