import { NextResponse } from "next/server";
import { readFile, writeFile } from "fs/promises";
import { join } from "path";
import { clearOpenRouterClient } from "@/lib/openrouter";

const ENV_PATH = join(process.cwd(), ".env");

const MANAGED_KEYS = [
  "OPENROUTER_API_KEY",
  "GMAIL_USER",
  "GMAIL_APP_PASSWORD",
  "BRAVE_SEARCH_API_KEY",
  "SCRATCHPAD_FILE_PATH",
  "ORCHESTRATOR_MODEL",
  "DATABASE_URL",
];

const SECRET_KEYS = new Set([
  "OPENROUTER_API_KEY",
  "GMAIL_APP_PASSWORD",
  "BRAVE_SEARCH_API_KEY",
]);

function maskValue(key: string, value: string): string {
  if (!SECRET_KEYS.has(key) || value.length <= 4) return value;
  return "*".repeat(Math.min(value.length - 4, 20)) + value.slice(-4);
}

function parseEnvFile(content: string): Record<string, string> {
  const result: Record<string, string> = {};
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIndex = trimmed.indexOf("=");
    if (eqIndex === -1) continue;
    const key = trimmed.slice(0, eqIndex).trim();
    let value = trimmed.slice(eqIndex + 1).trim();
    // Remove surrounding quotes
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    result[key] = value;
  }
  return result;
}

function buildEnvFile(values: Record<string, string>): string {
  const lines: string[] = [];
  const sections: { comment?: string; keys: string[] }[] = [
    { keys: ["DATABASE_URL"] },
    { comment: "# OpenRouter API", keys: ["OPENROUTER_API_KEY"] },
    { comment: "# Brave Search API", keys: ["BRAVE_SEARCH_API_KEY"] },
    {
      comment: "# Gmail SMTP (for send_email tool)",
      keys: ["GMAIL_USER", "GMAIL_APP_PASSWORD"],
    },
    {
      comment: "# Default model for orchestrator",
      keys: ["ORCHESTRATOR_MODEL"],
    },
    { keys: ["SCRATCHPAD_FILE_PATH"] },
  ];

  for (const section of sections) {
    if (section.comment) {
      lines.push(section.comment);
    }
    for (const key of section.keys) {
      if (key in values) {
        lines.push(`${key}="${values[key]}"`);
      }
    }
    lines.push("");
  }

  // Append any keys not in our sections
  const knownKeys = new Set(sections.flatMap((s) => s.keys));
  for (const [key, value] of Object.entries(values)) {
    if (!knownKeys.has(key)) {
      lines.push(`${key}="${value}"`);
    }
  }

  return lines.join("\n").replace(/\n{3,}/g, "\n\n").trimEnd() + "\n";
}

export async function GET() {
  try {
    const content = await readFile(ENV_PATH, "utf-8");
    const parsed = parseEnvFile(content);

    const masked: Record<string, string> = {};
    for (const key of MANAGED_KEYS) {
      if (key in parsed) {
        masked[key] = maskValue(key, parsed[key]);
      }
    }

    return NextResponse.json(masked);
  } catch {
    return NextResponse.json(
      { error: "Failed to read settings" },
      { status: 500 }
    );
  }
}

export async function PUT(request: Request) {
  try {
    const updates: Record<string, string> = await request.json();

    // Read current env file to preserve all values
    const content = await readFile(ENV_PATH, "utf-8");
    const current = parseEnvFile(content);

    const oldOpenRouterKey = current["OPENROUTER_API_KEY"];

    // Apply updates, skipping masked values (unchanged secrets)
    for (const [key, value] of Object.entries(updates)) {
      if (!MANAGED_KEYS.includes(key)) continue;
      if (key === "DATABASE_URL") continue; // read-only
      // Skip if value looks masked (hasn't been changed by user)
      if (SECRET_KEYS.has(key) && value.includes("*")) continue;
      current[key] = value;
    }

    // Write updated .env file
    await writeFile(ENV_PATH, buildEnvFile(current), "utf-8");

    // Update process.env in-memory
    for (const key of MANAGED_KEYS) {
      if (key in current) {
        process.env[key] = current[key];
      }
    }

    // Clear cached OpenRouter client if key changed
    if (current["OPENROUTER_API_KEY"] !== oldOpenRouterKey) {
      clearOpenRouterClient();
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { error: "Failed to update settings" },
      { status: 500 }
    );
  }
}
