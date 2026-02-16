type LogLevel = "info" | "warn" | "error";

interface LogContext {
  toolName?: string;
  agentId?: string;
  agentName?: string;
  sessionId?: string;
  durationMs?: number;
  [key: string]: unknown;
}

const MAX_PAYLOAD_LENGTH = 1000;

function truncate(value: unknown): string {
  const str = typeof value === "string" ? value : JSON.stringify(value);
  if (str && str.length > MAX_PAYLOAD_LENGTH) {
    return str.slice(0, MAX_PAYLOAD_LENGTH) + `... (${str.length} chars)`;
  }
  return str ?? "";
}

function formatContext(ctx: LogContext): string {
  const parts: string[] = [];
  if (ctx.sessionId) parts.push(`session=${ctx.sessionId}`);
  if (ctx.agentName) parts.push(`agent=${ctx.agentName}`);
  else if (ctx.agentId) parts.push(`agentId=${ctx.agentId}`);
  if (ctx.toolName) parts.push(`tool=${ctx.toolName}`);
  if (ctx.durationMs !== undefined) parts.push(`duration=${ctx.durationMs}ms`);
  return parts.length > 0 ? `[${parts.join(" ")}]` : "";
}

function log(level: LogLevel, message: string, ctx: LogContext = {}) {
  const timestamp = new Date().toISOString();
  const prefix = `${timestamp} [TOOL:${level.toUpperCase()}]`;
  const context = formatContext(ctx);
  const line = [prefix, context, message].filter(Boolean).join(" ");

  switch (level) {
    case "error":
      console.error(line);
      break;
    case "warn":
      console.warn(line);
      break;
    default:
      console.log(line);
  }
}

export const toolLogger = {
  /** Log tool conversion from DB record to SDK tool */
  registered(toolName: string) {
    log("info", `Registered tool`, { toolName });
  },

  /** Log start of tool execution */
  execStart(toolName: string, args: unknown, ctx: Omit<LogContext, "toolName"> = {}) {
    log("info", `Executing — args: ${truncate(args)}`, { ...ctx, toolName });
  },

  /** Log successful tool execution */
  execSuccess(toolName: string, result: unknown, durationMs: number, ctx: Omit<LogContext, "toolName" | "durationMs"> = {}) {
    log("info", `Completed — result: ${truncate(result)}`, { ...ctx, toolName, durationMs });
  },

  /** Log failed tool execution */
  execError(toolName: string, error: unknown, durationMs: number, ctx: Omit<LogContext, "toolName" | "durationMs"> = {}) {
    const msg = error instanceof Error ? error.message : String(error);
    const stack = error instanceof Error ? error.stack : undefined;
    log("error", `Failed — ${msg}${stack ? `\n${stack}` : ""}`, { ...ctx, toolName, durationMs });
  },

  /** Log tool not found */
  notFound(toolName: string, ctx: Omit<LogContext, "toolName"> = {}) {
    log("warn", `Tool not found`, { ...ctx, toolName });
  },

  /** Log meta-tool invocation */
  metaToolRequested(toolName: string, ctx: LogContext = {}) {
    log("info", `Runtime tool creation requested: "${toolName}"`, ctx);
  },

  /** Log meta-tool approval result */
  metaToolResolved(toolName: string, approved: boolean, ctx: LogContext = {}) {
    log("info", `Runtime tool "${toolName}" ${approved ? "APPROVED" : "REJECTED"}`, ctx);
  },

  /** Log tool argument parse failure */
  argsParseFailed(toolName: string, rawArgs: string, ctx: Omit<LogContext, "toolName"> = {}) {
    log("warn", `Failed to parse arguments — raw: ${truncate(rawArgs)}`, { ...ctx, toolName });
  },

  /** Log API-level tool operation */
  api(operation: string, detail: string, ctx: LogContext = {}) {
    log("info", `API ${operation} — ${detail}`, ctx);
  },

  /** Log API-level error */
  apiError(operation: string, error: unknown, ctx: LogContext = {}) {
    const msg = error instanceof Error ? error.message : String(error);
    log("error", `API ${operation} failed — ${msg}`, ctx);
  },
};
