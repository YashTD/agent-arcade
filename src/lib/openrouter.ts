import OpenAI from "openai";

const globalForOpenAI = globalThis as unknown as {
  openrouterClient: OpenAI | undefined;
};

export function getOpenRouterClient(): OpenAI {
  if (globalForOpenAI.openrouterClient) {
    return globalForOpenAI.openrouterClient;
  }
  const client = new OpenAI({
    baseURL: "https://openrouter.ai/api/v1",
    apiKey: process.env.OPENROUTER_API_KEY,
    defaultHeaders: {
      "X-Title": "Agent Conversation",
    },
  });
  if (process.env.NODE_ENV !== "production") {
    globalForOpenAI.openrouterClient = client;
  }
  return client;
}

export function clearOpenRouterClient(): void {
  globalForOpenAI.openrouterClient = undefined;
}
