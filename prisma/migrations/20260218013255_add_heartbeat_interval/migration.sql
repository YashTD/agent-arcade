-- CreateTable
CREATE TABLE "Tool" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "parameters" JSONB NOT NULL,
    "implementation" TEXT NOT NULL,
    "isPredefined" BOOLEAN NOT NULL DEFAULT false,
    "toolGroup" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'SETUP',
    "turnOrder" TEXT NOT NULL DEFAULT 'ROUND_ROBIN',
    "memoryStrategy" TEXT NOT NULL DEFAULT 'SLIDING_WINDOW',
    "memoryWindowSize" INTEGER NOT NULL DEFAULT 50,
    "currentTurnIndex" INTEGER NOT NULL DEFAULT 0,
    "isInfinite" BOOLEAN NOT NULL DEFAULT false,
    "isSlow" BOOLEAN NOT NULL DEFAULT false,
    "orchestratorModel" TEXT NOT NULL DEFAULT 'anthropic/claude-haiku-4.5',
    "heartbeatInterval" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "SessionAgent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "model" TEXT NOT NULL DEFAULT 'anthropic/claude-haiku-4.5',
    "systemPrompt" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT '#3B82F6',
    "orderIndex" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "sessionId" TEXT NOT NULL,
    CONSTRAINT "SessionAgent_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SessionAgentTool" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "agentId" TEXT NOT NULL,
    "toolId" TEXT NOT NULL,
    CONSTRAINT "SessionAgentTool_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "SessionAgent" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SessionAgentTool_toolId_fkey" FOREIGN KEY ("toolId") REFERENCES "Tool" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Message" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sessionId" TEXT NOT NULL,
    "agentId" TEXT,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "toolName" TEXT,
    "toolArgs" JSONB,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Message_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Message_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "SessionAgent" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ConversationSummary" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sessionId" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "messagesFrom" DATETIME NOT NULL,
    "messagesTo" DATETIME NOT NULL,
    "messageCount" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ConversationSummary_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AgentTemplate" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "model" TEXT NOT NULL DEFAULT 'anthropic/claude-haiku-4.5',
    "systemPrompt" TEXT NOT NULL,
    "toolIds" JSONB NOT NULL DEFAULT [],
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "Tool_name_key" ON "Tool"("name");

-- CreateIndex
CREATE INDEX "SessionAgent_sessionId_idx" ON "SessionAgent"("sessionId");

-- CreateIndex
CREATE UNIQUE INDEX "SessionAgentTool_agentId_toolId_key" ON "SessionAgentTool"("agentId", "toolId");

-- CreateIndex
CREATE INDEX "Message_sessionId_createdAt_idx" ON "Message"("sessionId", "createdAt");

-- CreateIndex
CREATE INDEX "ConversationSummary_sessionId_idx" ON "ConversationSummary"("sessionId");

-- CreateIndex
CREATE UNIQUE INDEX "AgentTemplate_name_key" ON "AgentTemplate"("name");
