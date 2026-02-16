"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import type { MessageWithAgent } from "@/types";
import { formatDisplayMessage } from "@/lib/utils/message-formatter";
import { Wrench, ChevronDown, ChevronRight, ArrowRight, CheckCircle2, XCircle, Terminal } from "lucide-react";

interface MessageBubbleProps {
  message: MessageWithAgent;
}

function tryParseJSON(str: string): { parsed: unknown; ok: boolean } {
  try {
    return { parsed: JSON.parse(str), ok: true };
  } catch {
    return { parsed: str, ok: false };
  }
}

function formatValue(value: unknown, maxDepth = 3, depth = 0): string {
  if (depth >= maxDepth) return JSON.stringify(value);
  if (value === null || value === undefined) return String(value);
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) {
    if (value.length === 0) return "[]";
    const items = value.map((v) => formatValue(v, maxDepth, depth + 1));
    return items.join(", ");
  }
  if (typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>);
    if (entries.length === 0) return "{}";
    return entries
      .map(([k, v]) => `${k}: ${formatValue(v, maxDepth, depth + 1)}`)
      .join("\n");
  }
  return String(value);
}

function ToolDisplay({ message }: { message: MessageWithAgent }) {
  const [expanded, setExpanded] = useState(true);
  const isCall = message.role === "TOOL_CALL";
  const { parsed, ok } = tryParseJSON(message.content);

  const agentName = message.agent?.name || "Agent";
  const agentColor = message.agent?.color || "#6B7280";

  let isError = false;
  if (!isCall && ok && typeof parsed === "object" && parsed !== null) {
    isError = "error" in (parsed as Record<string, unknown>);
  }

  return (
    <div className="mx-4 my-1.5">
      <div
        className={cn(
          "border-2 text-sm font-retro",
          isCall
            ? "border-neon-blue/50 bg-neon-blue/5"
            : isError
            ? "border-neon-red/50 bg-neon-red/5"
            : "border-neon-green/50 bg-neon-green/5"
        )}
      >
        {/* Header */}
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex w-full items-center gap-2 px-3 py-1.5 text-left hover:bg-white/5 transition-colors"
        >
          {expanded ? (
            <ChevronDown className="h-3 w-3 shrink-0 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-3 w-3 shrink-0 text-muted-foreground" />
          )}

          {isCall ? (
            <Terminal className="h-3 w-3 shrink-0 text-neon-blue" />
          ) : isError ? (
            <XCircle className="h-3 w-3 shrink-0 text-neon-red" />
          ) : (
            <CheckCircle2 className="h-3 w-3 shrink-0 text-neon-green" />
          )}

          <span className="font-bold text-sm" style={{ color: agentColor }}>
            {agentName}
          </span>

          <ArrowRight className="h-3 w-3 shrink-0 text-muted-foreground" />

          <span className="font-bold font-pixel text-[10px] text-foreground">
            {message.toolName}
          </span>

          <span className={cn(
            "ml-auto font-pixel text-[8px] uppercase",
            isCall ? "text-neon-blue" : isError ? "text-neon-red" : "text-neon-green"
          )}>
            {isCall ? "EXEC" : isError ? "FAIL" : "OK"}
          </span>
        </button>

        {/* Expanded content */}
        {expanded && (
          <div className="border-t-2 border-inherit px-3 py-2">
            {isCall && ok ? (
              <div>
                <div className="mb-1 font-pixel text-[8px] text-neon-blue uppercase">Args:</div>
                <pre className="whitespace-pre-wrap break-all bg-black/30 p-2 font-retro text-sm text-foreground">
                  {typeof parsed === "object"
                    ? JSON.stringify(parsed, null, 2)
                    : String(parsed)}
                </pre>
              </div>
            ) : !isCall && ok ? (
              <div>
                <div className="mb-1 font-pixel text-[8px] text-neon-green uppercase">Output:</div>
                <pre className="whitespace-pre-wrap break-all bg-black/30 p-2 font-retro text-sm max-h-64 overflow-auto text-foreground">
                  {typeof parsed === "object"
                    ? JSON.stringify(parsed, null, 2)
                    : String(parsed)}
                </pre>
              </div>
            ) : (
              <pre className="whitespace-pre-wrap break-all font-retro text-sm text-foreground">
                {message.content.length > 2000
                  ? message.content.substring(0, 2000) + "\n... (truncated)"
                  : message.content}
              </pre>
            )}
          </div>
        )}

        {/* Collapsed summary for results */}
        {!expanded && !isCall && ok && typeof parsed === "object" && parsed !== null && (
          <div className="px-3 pb-1.5 text-sm text-muted-foreground truncate font-retro">
            {formatValue(parsed).substring(0, 120)}
          </div>
        )}
      </div>
    </div>
  );
}

export function MessageBubble({ message }: MessageBubbleProps) {
  const { sender, content, color, role } = formatDisplayMessage(message);

  if (role === "tool_call" || role === "tool_result") {
    return <ToolDisplay message={message} />;
  }

  if (role === "system") {
    return (
      <div className="mx-4 my-2 text-center font-pixel text-[8px] text-muted-foreground uppercase tracking-widest">
        --- {content} ---
      </div>
    );
  }

  const isHuman = role === "human";

  return (
    <div
      className={cn(
        "mx-4 my-2 flex",
        isHuman ? "justify-end" : "justify-start"
      )}
    >
      <div
        className={cn(
          "max-w-[80%] border-2 px-4 py-2",
          isHuman
            ? "border-primary bg-primary/10 text-foreground"
            : "border-border bg-muted/30"
        )}
      >
        <div
          className="mb-1 font-pixel text-[9px] uppercase tracking-wider"
          style={{ color: isHuman ? "hsl(var(--primary))" : color }}
        >
          {isHuman ? "P1" : sender}
        </div>
        <div className="whitespace-pre-wrap text-lg font-retro leading-tight">{content}</div>
        <div className="mt-1 font-retro text-sm text-muted-foreground/50">
          {new Date(message.createdAt).toLocaleTimeString()}
        </div>
      </div>
    </div>
  );
}
