import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { z } from "zod";

const updateSessionSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  turnOrder: z.enum(["ROUND_ROBIN", "MANUAL", "ORCHESTRATED"]).optional(),
  memoryStrategy: z.enum(["SLIDING_WINDOW", "SUMMARIZATION"]).optional(),
  memoryWindowSize: z.number().min(10).max(200).optional(),
  status: z.enum(["SETUP", "ACTIVE", "PAUSED", "COMPLETED"]).optional(),
  isInfinite: z.boolean().optional(),
  isSlow: z.boolean().optional(),
  orchestratorModel: z.string().min(1).optional(),
});

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await params;
  const session = await prisma.session.findUnique({
    where: { id: sessionId },
    include: {
      agents: {
        orderBy: { orderIndex: "asc" },
        include: {
          tools: { include: { tool: true } },
        },
      },
    },
  });

  if (!session) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  return NextResponse.json(session);
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await params;
  try {
    const session = await prisma.session.findUnique({
      where: { id: sessionId },
    });
    if (!session) {
      return NextResponse.json(
        { error: "Session not found" },
        { status: 404 }
      );
    }

    const body = await request.json();
    const data = updateSessionSchema.parse(body);

    const updated = await prisma.session.update({
      where: { id: sessionId },
      data,
      include: {
        agents: {
          orderBy: { orderIndex: "asc" },
          include: {
            tools: { include: { tool: true } },
          },
        },
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
    console.error("Update session error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await params;
  const session = await prisma.session.findUnique({
    where: { id: sessionId },
  });
  if (!session) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  await prisma.session.delete({ where: { id: sessionId } });
  return NextResponse.json({ success: true });
}
