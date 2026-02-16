import type { SDKTool } from "./tool-registry";
import { toolLogger } from "./tool-logger";

/**
 * The "add_tool" meta-tool that allows agents to create new tools at runtime.
 * When called, it emits an approval_required SSE event and waits for user approval.
 */
export function createMetaTool(
  onApprovalRequired: (data: {
    toolName: string;
    toolCode: string;
    toolDescription: string;
    toolParameters: Record<string, unknown>;
  }) => Promise<boolean>
): SDKTool {
  return {
    name: "add_tool",
    description:
      "Create a new tool at runtime. The tool code will be reviewed and approved by the user before being added. Write the implementation as JavaScript code that receives a `params` object and returns a result. You have access to `fetch` and `process.env`.",
    parameters: {
      type: "object",
      properties: {
        name: {
          type: "string",
          description: "Unique name for the tool (snake_case)",
        },
        description: {
          type: "string",
          description: "Clear description of what the tool does",
        },
        parameters: {
          type: "object",
          description: "JSON Schema for the tool's parameters",
        },
        implementation: {
          type: "string",
          description:
            "JavaScript code implementing the tool. Has access to `params`, `fetch`, and `process.env`. Must return a result.",
        },
      },
      required: ["name", "description", "parameters", "implementation"],
    },
    execute: async (params: Record<string, unknown>) => {
      const { name, description, parameters, implementation } = params as {
        name: string;
        description: string;
        parameters: Record<string, unknown>;
        implementation: string;
      };

      toolLogger.metaToolRequested(name, { toolName: "add_tool" });

      const approved = await onApprovalRequired({
        toolName: name,
        toolCode: implementation,
        toolDescription: description,
        toolParameters: parameters,
      });

      toolLogger.metaToolResolved(name, approved, { toolName: "add_tool" });

      if (approved) {
        return {
          success: true,
          message: `Tool "${name}" has been created and is now available.`,
        };
      } else {
        return {
          success: false,
          message: `Tool "${name}" was rejected by the user.`,
        };
      }
    },
  };
}
