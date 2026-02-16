import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { z } from "zod";

const createSessionSchema = z.object({
  name: z.string().min(1).max(200),
  turnOrder: z.enum(["ROUND_ROBIN", "MANUAL", "ORCHESTRATED"]).default("ROUND_ROBIN"),
  memoryStrategy: z.enum(["SLIDING_WINDOW", "SUMMARIZATION"]).default("SLIDING_WINDOW"),
  memoryWindowSize: z.number().min(10).max(200).default(50),
});

export async function GET() {
  const sessions = await prisma.session.findMany({
    orderBy: { updatedAt: "desc" },
    include: {
      agents: {
        orderBy: { orderIndex: "asc" },
      },
      _count: {
        select: { messages: true },
      },
    },
  });
  return NextResponse.json(sessions);
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const data = createSessionSchema.parse(body);

    const session = await prisma.session.create({
      data: {
        name: data.name,
        turnOrder: data.turnOrder,
        memoryStrategy: data.memoryStrategy,
        memoryWindowSize: data.memoryWindowSize,
      },
      include: {
        agents: {
          include: {
            tools: { include: { tool: true } },
          },
        },
      },
    });

    return NextResponse.json(session, { status: 201 });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation error", details: err.errors },
        { status: 400 }
      );
    }
    console.error("Create session error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
