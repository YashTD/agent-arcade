import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { z } from "zod";
import { toolLogger } from "@/lib/tools/tool-logger";

const createToolSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().min(1),
  parameters: z.record(z.unknown()),
  implementation: z.string().min(1),
});

export async function GET() {
  toolLogger.api("GET /api/tools", "Fetching all tools");
  const tools = await prisma.tool.findMany({
    orderBy: [{ isPredefined: "desc" }, { name: "asc" }],
  });
  toolLogger.api("GET /api/tools", `Returned ${tools.length} tool(s)`);
  return NextResponse.json(tools);
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const data = createToolSchema.parse(body);

    toolLogger.api("POST /api/tools", `Creating tool "${data.name}"`, { toolName: data.name });

    const existing = await prisma.tool.findUnique({
      where: { name: data.name },
    });
    if (existing) {
      toolLogger.api("POST /api/tools", `Conflict — tool "${data.name}" already exists`, { toolName: data.name });
      return NextResponse.json(
        { error: "Tool with this name already exists" },
        { status: 409 }
      );
    }

    const tool = await prisma.tool.create({
      data: {
        name: data.name,
        description: data.description,
        parameters: JSON.parse(JSON.stringify(data.parameters)),
        implementation: data.implementation,
        isPredefined: false,
      },
    });

    toolLogger.api("POST /api/tools", `Created tool "${tool.name}" (id=${tool.id})`, { toolName: tool.name });
    return NextResponse.json(tool, { status: 201 });
  } catch (err) {
    if (err instanceof z.ZodError) {
      toolLogger.apiError("POST /api/tools", `Validation failed: ${JSON.stringify(err.errors)}`);
      return NextResponse.json(
        { error: "Validation error", details: err.errors },
        { status: 400 }
      );
    }
    toolLogger.apiError("POST /api/tools", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
