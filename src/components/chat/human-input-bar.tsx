"use client";

import { useState, type KeyboardEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Send, Play, Square, Crosshair } from "lucide-react";
import type { SessionAgentWithTools } from "@/types";

interface HumanInputBarProps {
  agents: SessionAgentWithTools[];
  turnOrder: string;
  isRunning: boolean;
  onSendMessage: (content: string, targetAgentId?: string) => void;
  onProgressConversation: (targetAgentId?: string) => void;
  onStop: () => void;
}

export function HumanInputBar({
  agents,
  turnOrder,
  isRunning,
  onSendMessage,
  onProgressConversation,
  onStop,
}: HumanInputBarProps) {
  const [input, setInput] = useState("");
  const [selectedAgent, setSelectedAgent] = useState<string>("");

  const handleSend = () => {
    if (!input.trim()) return;
    onSendMessage(
      input.trim(),
      turnOrder === "MANUAL" ? selectedAgent : undefined
    );
    setInput("");
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleProgress = () => {
    onProgressConversation(
      turnOrder === "MANUAL" ? selectedAgent : undefined
    );
  };

  return (
    <div className="border-t-2 border-primary bg-background p-3">
      {/* Top accent line */}
      <div className="h-[1px] bg-gradient-to-r from-transparent via-primary/50 to-transparent mb-3" />
      <div className="flex items-center gap-2">
        {turnOrder === "MANUAL" && (
          <Select value={selectedAgent} onValueChange={setSelectedAgent}>
            <SelectTrigger className="w-40 h-8">
              <Crosshair className="h-3 w-3 mr-1 text-neon-yellow" />
              <SelectValue placeholder="Target" />
            </SelectTrigger>
            <SelectContent>
              {agents.map((agent) => (
                <SelectItem key={agent.id} value={agent.id}>
                  <span className="flex items-center gap-2">
                    <span
                      className="h-2 w-2"
                      style={{ backgroundColor: agent.color }}
                    />
                    {agent.name}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={isRunning ? "Waiting..." : "Enter command..."}
          className="flex-1 border-primary/30 focus-visible:border-primary"
          disabled={isRunning}
        />

        <Button
          onClick={handleSend}
          disabled={isRunning || !input.trim()}
          size="icon"
          className="shrink-0"
        >
          <Send className="h-4 w-4" />
        </Button>

        {!isRunning && (
          <Button
            onClick={handleProgress}
            variant="secondary"
            disabled={agents.length === 0}
            className="shrink-0"
          >
            <Play className="mr-1 h-4 w-4" />
            <span className="font-pixel text-[9px]">START</span>
          </Button>
        )}

        {isRunning && (
          <Button onClick={onStop} variant="destructive" className="shrink-0">
            <Square className="mr-1 h-4 w-4" />
            <span className="font-pixel text-[9px]">STOP</span>
          </Button>
        )}
      </div>
    </div>
  );
}
