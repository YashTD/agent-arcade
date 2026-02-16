import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { z } from "zod";
import { AGENT_COLORS } from "@/types";

const createAgentSchema = z.object({
  name: z.string().min(1).max(100),
  model: z.string().default("anthropic/claude-haiku-4.5"),
  systemPrompt: z.string().min(1),
  color: z.string().optional(),
  orderIndex: z.number().optional(),
  toolIds: z.array(z.string()).default([]),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await params;
  try {
    const session = await prisma.session.findUnique({
      where: { id: sessionId },
      include: { agents: true },
    });
    if (!session) {
      return NextResponse.json(
        { error: "Session not found" },
        { status: 404 }
      );
    }

    const body = await request.json();
    const data = createAgentSchema.parse(body);

    const orderIndex = data.orderIndex ?? session.agents.length;
    const color = data.color || AGENT_COLORS[session.agents.length % AGENT_COLORS.length];

    const agent = await prisma.sessionAgent.create({
      data: {
        sessionId,
        name: data.name,
        model: data.model,
        systemPrompt: data.systemPrompt,
        color,
        orderIndex,
        tools: {
          create: data.toolIds.map((toolId) => ({
            toolId,
          })),
        },
      },
      include: {
        tools: { include: { tool: true } },
      },
    });

    return NextResponse.json(agent, { status: 201 });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation error", details: err.errors },
        { status: 400 }
      );
    }
    console.error("Create agent error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
