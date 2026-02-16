import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { z } from "zod";

const updateAgentSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  model: z.string().optional(),
  systemPrompt: z.string().min(1).optional(),
  color: z.string().optional(),
  orderIndex: z.number().optional(),
  toolIds: z.array(z.string()).optional(),
});

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ sessionId: string; agentId: string }> }
) {
  const { agentId } = await params;
  const agent = await prisma.sessionAgent.findUnique({
    where: { id: agentId },
    include: {
      tools: { include: { tool: true } },
    },
  });
  if (!agent) {
    return NextResponse.json({ error: "Agent not found" }, { status: 404 });
  }
  return NextResponse.json(agent);
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ sessionId: string; agentId: string }> }
) {
  const { agentId } = await params;
  try {
    const agent = await prisma.sessionAgent.findUnique({
      where: { id: agentId },
    });
    if (!agent) {
      return NextResponse.json(
        { error: "Agent not found" },
        { status: 404 }
      );
    }

    const body = await request.json();
    const data = updateAgentSchema.parse(body);

    // If toolIds provided, replace all tool associations
    if (data.toolIds !== undefined) {
      await prisma.sessionAgentTool.deleteMany({
        where: { agentId },
      });

      if (data.toolIds.length > 0) {
        await prisma.sessionAgentTool.createMany({
          data: data.toolIds.map((toolId) => ({
            agentId,
            toolId,
          })),
        });
      }
    }

    const { toolIds: _, ...updateData } = data;
    const updated = await prisma.sessionAgent.update({
      where: { id: agentId },
      data: updateData,
      include: {
        tools: { include: { tool: true } },
      },
    });

    return NextResponse.json(updated);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation error", details: err.errors },
        { status: 400 }
      );
    }
    console.error("Update agent error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ sessionId: string; agentId: string }> }
) {
  const { agentId } = await params;
  const agent = await prisma.sessionAgent.findUnique({
    where: { id: agentId },
  });
  if (!agent) {
    return NextResponse.json({ error: "Agent not found" }, { status: 404 });
  }
  await prisma.sessionAgent.delete({ where: { id: agentId } });
  return NextResponse.json({ success: true });
}
