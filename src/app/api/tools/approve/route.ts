import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { z } from "zod";
import { toolLogger } from "@/lib/tools/tool-logger";

const approveToolSchema = z.object({
  approvalId: z.string(),
  approved: z.boolean(),
  name: z.string().min(1),
  description: z.string().min(1),
  parameters: z.record(z.unknown()),
  implementation: z.string().min(1),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const data = approveToolSchema.parse(body);

    toolLogger.api("POST /api/tools/approve", `Tool "${data.name}" — approved=${data.approved}`, { toolName: data.name });

    if (!data.approved) {
      toolLogger.api("POST /api/tools/approve", `Tool "${data.name}" rejected by user`, { toolName: data.name });
      return NextResponse.json({ approved: false });
    }

    // Check if tool name already exists
    const existing = await prisma.tool.findUnique({
      where: { name: data.name },
    });
    if (existing) {
      toolLogger.api("POST /api/tools/approve", `Conflict — tool "${data.name}" already exists`, { toolName: data.name });
      return NextResponse.json(
        { error: "Tool with this name already exists" },
        { status: 409 }
      );
    }

    // Create the tool
    const tool = await prisma.tool.create({
      data: {
        name: data.name,
        description: data.description,
        parameters: JSON.parse(JSON.stringify(data.parameters)),
        implementation: data.implementation,
        isPredefined: false,
      },
    });

    toolLogger.api("POST /api/tools/approve", `Approved and created tool "${tool.name}" (id=${tool.id})`, { toolName: tool.name });
    return NextResponse.json({ approved: true, tool });
  } catch (err) {
    if (err instanceof z.ZodError) {
      toolLogger.apiError("POST /api/tools/approve", `Validation failed: ${JSON.stringify(err.errors)}`);
      return NextResponse.json(
        { error: "Validation error", details: err.errors },
        { status: 400 }
      );
    }
    toolLogger.apiError("POST /api/tools/approve", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
