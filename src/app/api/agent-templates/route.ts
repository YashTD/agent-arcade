import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { z } from "zod";

const createTemplateSchema = z.object({
  name: z.string().min(1).max(100),
  model: z.string().min(1).default("anthropic/claude-haiku-4.5"),
  systemPrompt: z.string().min(1),
  toolIds: z.array(z.string()).default([]),
});

export async function GET() {
  const templates = await prisma.agentTemplate.findMany({
    orderBy: { name: "asc" },
  });
  return NextResponse.json(templates);
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const data = createTemplateSchema.parse(body);

    const template = await prisma.agentTemplate.upsert({
      where: { name: data.name },
      update: {
        model: data.model,
        systemPrompt: data.systemPrompt,
        toolIds: data.toolIds,
      },
      create: {
        name: data.name,
        model: data.model,
        systemPrompt: data.systemPrompt,
        toolIds: data.toolIds,
      },
    });

    return NextResponse.json(template, { status: 200 });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation error", details: err.errors },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
