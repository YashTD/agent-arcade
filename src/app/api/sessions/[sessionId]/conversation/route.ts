import { prisma } from "@/lib/db";
import { ConversationEngine, type SSEWriter } from "@/lib/agents/conversation-engine";

export const dynamic = "force-dynamic";
export const maxDuration = 300; // 5 minutes max

export async function POST(
  request: Request,
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
    return Response.json({ error: "Session not found" }, { status: 404 });
  }

  if (session.agents.length === 0) {
    return Response.json(
      { error: "No agents configured for this session" },
      { status: 400 }
    );
  }

  let body: {
    content?: string;
    targetAgentId?: string;
    turns?: number;
    infinite?: boolean;
  } = {};

  try {
    body = await request.json();
  } catch {
    // Empty body is OK for infinite/auto modes
  }

  // Create SSE stream
  const encoder = new TextEncoder();
  const { readable, writable } = new TransformStream();
  const writer = writable.getWriter();

  const sseWriter: SSEWriter = {
    write: (event: string, data: Record<string, unknown>) => {
      const payload = JSON.stringify({ type: event, data });
      writer.write(encoder.encode(`data: ${payload}\n\n`)).catch(() => {
        // Stream closed
      });
    },
    close: () => {
      writer.write(encoder.encode("data: [DONE]\n\n")).catch(() => {});
      writer.close().catch(() => {});
    },
  };

  // Run conversation in background
  const abortController = new AbortController();

  // Listen for client disconnect
  request.signal.addEventListener("abort", () => {
    abortController.abort();
  });

  const engine = new ConversationEngine(
    session,
    session.agents,
    sseWriter,
    abortController.signal
  );

  // Start the conversation processing
  (async () => {
    try {
      // Add human message if provided
      if (body.content) {
        const humanMsg = await engine.addHumanMessage(body.content);
        sseWriter.write("turn_end", {
          agentId: null,
          messageId: humanMsg.id,
          content: humanMsg.content,
          message: humanMsg,
        });
      }

      if (body.infinite) {
        await engine.runInfinite();
      } else {
        const turns = body.turns || 1;
        await engine.runTurns(turns, body.targetAgentId);
      }
    } catch (error) {
      console.error("Conversation error:", error);
      sseWriter.write("error", {
        message:
          error instanceof Error ? error.message : "Unknown error",
      });
    } finally {
      sseWriter.close();
    }
  })();

  return new Response(readable, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
