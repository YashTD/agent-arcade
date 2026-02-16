import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { z } from "zod";
import { toolLogger } from "@/lib/tools/tool-logger";

const updateToolSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().min(1).optional(),
  parameters: z.record(z.unknown()).optional(),
  implementation: z.string().min(1).optional(),
});

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ toolId: string }> }
) {
  const { toolId } = await params;
  toolLogger.api("GET /api/tools/[id]", `Fetching tool id=${toolId}`);
  const tool = await prisma.tool.findUnique({ where: { id: toolId } });
  if (!tool) {
    toolLogger.api("GET /api/tools/[id]", `Tool not found id=${toolId}`);
    return NextResponse.json({ error: "Tool not found" }, { status: 404 });
  }
  return NextResponse.json(tool);
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ toolId: string }> }
) {
  const { toolId } = await params;
  try {
    const tool = await prisma.tool.findUnique({ where: { id: toolId } });
    if (!tool) {
      toolLogger.api("PUT /api/tools/[id]", `Tool not found id=${toolId}`);
      return NextResponse.json({ error: "Tool not found" }, { status: 404 });
    }

    if (tool.isPredefined) {
      toolLogger.api("PUT /api/tools/[id]", `Rejected — cannot modify predefined tool "${tool.name}"`, { toolName: tool.name });
      return NextResponse.json(
        { error: "Cannot modify predefined tools" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const data = updateToolSchema.parse(body);

    toolLogger.api("PUT /api/tools/[id]", `Updating tool "${tool.name}" — fields: ${Object.keys(data).join(", ")}`, { toolName: tool.name });

    // Check name uniqueness if changing name
    if (data.name && data.name !== tool.name) {
      const existing = await prisma.tool.findUnique({
        where: { name: data.name },
      });
      if (existing) {
        toolLogger.api("PUT /api/tools/[id]", `Conflict — name "${data.name}" already exists`, { toolName: tool.name });
        return NextResponse.json(
          { error: "Tool with this name already exists" },
          { status: 409 }
        );
      }
    }

    const updated = await prisma.tool.update({
      where: { id: toolId },
      data: {
        ...data,
        parameters: data.parameters ? JSON.parse(JSON.stringify(data.parameters)) : undefined,
      },
    });

    toolLogger.api("PUT /api/tools/[id]", `Updated tool "${updated.name}" (id=${updated.id})`, { toolName: updated.name });
    return NextResponse.json(updated);
  } catch (err) {
    if (err instanceof z.ZodError) {
      toolLogger.apiError("PUT /api/tools/[id]", `Validation failed: ${JSON.stringify(err.errors)}`);
      return NextResponse.json(
        { error: "Validation error", details: err.errors },
        { status: 400 }
      );
    }
    toolLogger.apiError("PUT /api/tools/[id]", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ toolId: string }> }
) {
  const { toolId } = await params;
  const tool = await prisma.tool.findUnique({ where: { id: toolId } });
  if (!tool) {
    toolLogger.api("DELETE /api/tools/[id]", `Tool not found id=${toolId}`);
    return NextResponse.json({ error: "Tool not found" }, { status: 404 });
  }

  if (tool.isPredefined) {
    toolLogger.api("DELETE /api/tools/[id]", `Rejected — cannot delete predefined tool "${tool.name}"`, { toolName: tool.name });
    return NextResponse.json(
      { error: "Cannot delete predefined tools" },
      { status: 403 }
    );
  }

  await prisma.tool.delete({ where: { id: toolId } });
  toolLogger.api("DELETE /api/tools/[id]", `Deleted tool "${tool.name}" (id=${tool.id})`, { toolName: tool.name });
  return NextResponse.json({ success: true });
}
