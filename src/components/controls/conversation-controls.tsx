"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useState } from "react";
import { Cpu, Brain, Repeat, Gauge, Heart } from "lucide-react";

interface ConversationControlsProps {
  turnOrder: string;
  memoryStrategy: string;
  isInfinite: boolean;
  isSlow: boolean;
  orchestratorModel: string;
  heartbeatInterval: number | null;
  onTurnOrderChange: (value: string) => void;
  onMemoryStrategyChange: (value: string) => void;
  onInfiniteChange: (value: boolean) => void;
  onSlowChange: (value: boolean) => void;
  onOrchestratorModelChange: (value: string) => void;
  onHeartbeatIntervalChange: (value: number | null) => void;
  disabled?: boolean;
}

export function ConversationControls({
  turnOrder,
  memoryStrategy,
  isInfinite,
  isSlow,
  orchestratorModel,
  heartbeatInterval,
  onTurnOrderChange,
  onMemoryStrategyChange,
  onInfiniteChange,
  onSlowChange,
  onOrchestratorModelChange,
  onHeartbeatIntervalChange,
  disabled,
}: ConversationControlsProps) {
  const [localModel, setLocalModel] = useState(orchestratorModel);
  const [localHeartbeat, setLocalHeartbeat] = useState(heartbeatInterval?.toString() || "");

  const commitModel = () => {
    const trimmed = localModel.trim();
    if (trimmed && trimmed !== orchestratorModel) {
      onOrchestratorModelChange(trimmed);
    }
  };

  const commitHeartbeat = () => {
    const val = parseInt(localHeartbeat, 10);
    if (!localHeartbeat || isNaN(val) || val <= 0) {
      onHeartbeatIntervalChange(null);
      setLocalHeartbeat("");
    } else {
      onHeartbeatIntervalChange(Math.min(val, 3600));
    }
  };

  return (
    <div className="flex items-center gap-6 border-b-2 border-border px-4 py-2 bg-muted/20">
      <div className="flex items-center gap-2">
        <Repeat className="h-3 w-3 text-neon-cyan" />
        <Label className="font-pixel text-[8px] whitespace-nowrap text-neon-cyan uppercase">Mode</Label>
        <Select value={turnOrder} onValueChange={onTurnOrderChange} disabled={disabled}>
          <SelectTrigger className="h-7 w-36 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ROUND_ROBIN">Round Robin</SelectItem>
            <SelectItem value="MANUAL">Manual</SelectItem>
            <SelectItem value="ORCHESTRATED">Orchestrated</SelectItem>
          </SelectContent>
        </Select>
      </div>
      {turnOrder === "ORCHESTRATED" && (
        <div className="flex items-center gap-2">
          <Cpu className="h-3 w-3 text-neon-orange" />
          <Label className="font-pixel text-[8px] whitespace-nowrap text-neon-orange uppercase">CPU</Label>
          <Input
            value={localModel}
            onChange={(e) => setLocalModel(e.target.value)}
            onBlur={commitModel}
            onKeyDown={(e) => { if (e.key === "Enter") commitModel(); }}
            className="h-7 w-52 text-sm font-retro"
            placeholder="anthropic/claude-haiku-4.5"
            disabled={disabled}
          />
        </div>
      )}
      <div className="flex items-center gap-2">
        <Brain className="h-3 w-3 text-neon-purple" />
        <Label className="font-pixel text-[8px] whitespace-nowrap text-neon-purple uppercase">RAM</Label>
        <Select value={memoryStrategy} onValueChange={onMemoryStrategyChange} disabled={disabled}>
          <SelectTrigger className="h-7 w-36 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="SLIDING_WINDOW">Sliding Window</SelectItem>
            <SelectItem value="SUMMARIZATION">Summarization</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="flex items-center gap-2">
        <Label className="font-pixel text-[8px] text-neon-green uppercase">Loop</Label>
        <Switch checked={isInfinite} onCheckedChange={onInfiniteChange} disabled={disabled} />
      </div>
      <div className="flex items-center gap-2">
        <Gauge className="h-3 w-3 text-neon-yellow" />
        <Label className="font-pixel text-[8px] text-neon-yellow uppercase">Slow</Label>
        <Switch checked={isSlow} onCheckedChange={onSlowChange} disabled={disabled} />
      </div>
      <div className="flex items-center gap-2">
        <Heart className="h-3 w-3 text-neon-pink" />
        <Label className="font-pixel text-[8px] text-neon-pink uppercase">Beat</Label>
        <Input
          value={localHeartbeat}
          onChange={(e) => setLocalHeartbeat(e.target.value.replace(/[^0-9]/g, ""))}
          onBlur={commitHeartbeat}
          onKeyDown={(e) => { if (e.key === "Enter") commitHeartbeat(); }}
          className="h-7 w-16 text-sm font-retro text-center"
          placeholder="off"
          disabled={disabled}
        />
        <span className="font-pixel text-[7px] text-muted-foreground uppercase">sec</span>
      </div>
    </div>
  );
}
