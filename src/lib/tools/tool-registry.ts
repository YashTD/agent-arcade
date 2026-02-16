import type { Tool } from "@prisma/client";
import * as fs from "fs";
import * as path from "path";
import { toolLogger } from "./tool-logger";

export interface ToolContext {
  sessionId: string;
  browserManager: import("./browser-manager").BrowserSessionManager;
}

interface SDKTool {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  execute: (params: Record<string, unknown>, context?: ToolContext) => Promise<unknown>;
}

// Pre-imported Node builtins so tools can require() them regardless of bundler.
const builtinModules: Record<string, unknown> = { fs, path };

// Obtain a native Node.js require that bypasses webpack bundling.
// __non_webpack_require__ is provided by Next.js/webpack for exactly this purpose.
// Falls back to eval("require") which also bypasses static analysis.
declare const __non_webpack_require__: NodeRequire | undefined;
const nativeRequire: NodeRequire =
  typeof __non_webpack_require__ === "function"
    ? __non_webpack_require__
    : eval("require");

function toolRequire(id: string): unknown {
  if (builtinModules[id]) return builtinModules[id];
  return nativeRequire(id);
}

/**
 * Convert a database Tool record into an executable SDK tool.
 * The implementation is stored as a JS code string that receives `params` as an argument.
 */
export function dbToolToSDKTool(tool: Tool): SDKTool {
  toolLogger.registered(tool.name);
  return {
    name: tool.name,
    description: tool.description,
    parameters: tool.parameters as Record<string, unknown>,
    execute: createToolExecutor(tool.name, tool.implementation),
  };
}

/**
 * Create a tool executor function from an implementation string.
 * The implementation code has access to `params`, `fetch`, `process`,
 * `context`, and `require` (resolves Node builtins + npm packages).
 */
function createToolExecutor(
  toolName: string,
  implementation: string
): (params: Record<string, unknown>, context?: ToolContext) => Promise<unknown> {
  return async (params: Record<string, unknown>, context?: ToolContext) => {
    toolLogger.execStart(toolName, params);
    const start = performance.now();

    try {
      // Create an async function from the implementation string
      const AsyncFunction = Object.getPrototypeOf(
        async function () {}
      ).constructor;

      const fn = new AsyncFunction(
        "params",
        "fetch",
        "process",
        "context",
        "require",
        `"use strict";\n${implementation}`
      );

      const result = await fn(params, globalThis.fetch, process, context ?? {}, toolRequire);
      const durationMs = Math.round(performance.now() - start);
      toolLogger.execSuccess(toolName, result, durationMs);
      return result;
    } catch (error) {
      const durationMs = Math.round(performance.now() - start);
      toolLogger.execError(toolName, error, durationMs);
      throw error;
    }
  };
}

/**
 * Convert multiple database tools into SDK tools.
 */
export function dbToolsToSDKTools(tools: Tool[]): SDKTool[] {
  return tools.map(dbToolToSDKTool);
}

export type { SDKTool };
