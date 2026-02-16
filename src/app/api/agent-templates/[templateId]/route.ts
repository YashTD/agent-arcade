import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { z } from "zod";

const updateTemplateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  model: z.string().min(1).optional(),
  systemPrompt: z.string().min(1).optional(),
  toolIds: z.array(z.string()).optional(),
});

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ templateId: string }> }
) {
  const { templateId } = await params;
  const template = await prisma.agentTemplate.findUnique({
    where: { id: templateId },
  });
  if (!template) {
    return NextResponse.json({ error: "Template not found" }, { status: 404 });
  }
  return NextResponse.json(template);
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ templateId: string }> }
) {
  const { templateId } = await params;
  try {
    const template = await prisma.agentTemplate.findUnique({
      where: { id: templateId },
    });
    if (!template) {
      return NextResponse.json(
        { error: "Template not found" },
        { status: 404 }
      );
    }

    const body = await request.json();
    const data = updateTemplateSchema.parse(body);

    if (data.name && data.name !== template.name) {
      const existing = await prisma.agentTemplate.findUnique({
        where: { name: data.name },
      });
      if (existing) {
        return NextResponse.json(
          { error: "Template with this name already exists" },
          { status: 409 }
        );
      }
    }

    const updated = await prisma.agentTemplate.update({
      where: { id: templateId },
      data,
    });

    return NextResponse.json(updated);
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

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ templateId: string }> }
) {
  const { templateId } = await params;
  const template = await prisma.agentTemplate.findUnique({
    where: { id: templateId },
  });
  if (!template) {
    return NextResponse.json({ error: "Template not found" }, { status: 404 });
  }

  await prisma.agentTemplate.delete({ where: { id: templateId } });
  return NextResponse.json({ success: true });
}
