import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const predefinedTools = [
  {
    name: "send_email",
    toolGroup: "email",
    description:
      "Send an email using Gmail SMTP. Requires GMAIL_USER and GMAIL_APP_PASSWORD environment variables.",
    parameters: {
      type: "object",
      properties: {
        to: { type: "string", description: "Recipient email address" },
        subject: { type: "string", description: "Email subject line" },
        body: { type: "string", description: "Email body (plain text or HTML)" },
        isHtml: {
          type: "boolean",
          description: "Whether the body is HTML",
          default: false,
        },
      },
      required: ["to", "subject", "body"],
    },
    implementation: `
const nodemailer = require("nodemailer");
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD,
  },
});
const info = await transporter.sendMail({
  from: process.env.GMAIL_USER,
  to: params.to,
  subject: params.subject,
  [params.isHtml ? "html" : "text"]: params.body,
});
return { messageId: info.messageId, accepted: info.accepted };
`,
    isPredefined: true,
  },
  {
    name: "read_mail",
    toolGroup: "email",
    description:
      "Read emails from a Gmail mailbox using IMAP. Returns subject, sender, date, and a text snippet for each message. Requires GMAIL_USER and GMAIL_APP_PASSWORD environment variables.",
    parameters: {
      type: "object",
      properties: {
        folder: {
          type: "string",
          description: 'Mailbox folder to read from (default: "INBOX")',
          default: "INBOX",
        },
        count: {
          type: "number",
          description: "Number of recent emails to fetch (default 10, max 50)",
          default: 10,
        },
        unseen: {
          type: "boolean",
          description: "If true, only fetch unread/unseen emails",
          default: false,
        },
      },
      required: [],
    },
    implementation: `
const { ImapFlow } = require("imapflow");
const client = new ImapFlow({
  host: "imap.gmail.com",
  port: 993,
  secure: true,
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD,
  },
  logger: false,
});
await client.connect();
try {
  const folder = params.folder || "INBOX";
  const count = Math.min(Math.max(1, params.count || 10), 50);
  const lock = await client.getMailboxLock(folder);
  try {
    const status = await client.status(folder, { messages: true, unseen: true });
    let range;
    if (params.unseen) {
      range = await client.search({ seen: false });
      if (range.length > count) range = range.slice(-count);
    } else {
      const total = status.messages || 0;
      const start = Math.max(1, total - count + 1);
      range = start + ":*";
    }
    const emails = [];
    if ((typeof range === "string" && range) || (Array.isArray(range) && range.length > 0)) {
      for await (const msg of client.fetch(range, { envelope: true, bodyStructure: true, source: { maxBytes: 4096 } })) {
        const env = msg.envelope;
        let snippet = "";
        if (msg.source) {
          const text = msg.source.toString();
          const bodyStart = text.indexOf("\\r\\n\\r\\n");
          if (bodyStart !== -1) {
            snippet = text.substring(bodyStart + 4, bodyStart + 504)
              .replace(/<[^>]+>/g, " ").replace(/\\s+/g, " ").trim();
          }
        }
        emails.push({
          uid: msg.uid,
          subject: env.subject,
          from: env.from?.map(a => a.address).join(", "),
          date: env.date?.toISOString(),
          snippet,
        });
      }
    }
    emails.reverse();
    return { folder, total: status.messages, unseen: status.unseen, fetched: emails.length, emails };
  } finally {
    lock.release();
  }
} finally {
  await client.logout();
}
`,
    isPredefined: true,
  },
  {
    name: "read_email_content",
    toolGroup: "email",
    description:
      "Read the full content of a specific email by its UID. Use read_mail first to list emails and get UIDs, then use this tool to read the full body of a specific email. Requires GMAIL_USER and GMAIL_APP_PASSWORD environment variables.",
    parameters: {
      type: "object",
      properties: {
        uid: {
          type: "number",
          description: "The UID of the email to read (from read_mail results)",
        },
        folder: {
          type: "string",
          description: 'Mailbox folder the email is in (default: "INBOX")',
          default: "INBOX",
        },
      },
      required: ["uid"],
    },
    implementation: `
const { ImapFlow } = require("imapflow");
const client = new ImapFlow({
  host: "imap.gmail.com",
  port: 993,
  secure: true,
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD,
  },
  logger: false,
});
await client.connect();
try {
  const folder = params.folder || "INBOX";
  const lock = await client.getMailboxLock(folder);
  try {
    let result = null;
    for await (const msg of client.fetch(String(params.uid), { envelope: true, source: true }, { uid: true })) {
      const env = msg.envelope;
      let body = "";
      if (msg.source) {
        const raw = msg.source.toString();
        const headerEnd = raw.indexOf("\\r\\n\\r\\n");
        if (headerEnd !== -1) {
          body = raw.substring(headerEnd + 4);
        }
      }
      // Strip HTML tags for readability, decode common MIME patterns
      let textBody = body;
      // Handle quoted-printable soft line breaks
      textBody = textBody.replace(/=\\r\\n/g, "");
      // Decode common quoted-printable sequences
      textBody = textBody.replace(/=([0-9A-Fa-f]{2})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
      // Strip HTML if present
      if (textBody.includes("<html") || textBody.includes("<div") || textBody.includes("<p")) {
        textBody = textBody
          .replace(/<script[^>]*>[\\s\\S]*?<\\/script>/gi, "")
          .replace(/<style[^>]*>[\\s\\S]*?<\\/style>/gi, "")
          .replace(/<br\\s*\\/?>/gi, "\\n")
          .replace(/<\\/p>/gi, "\\n\\n")
          .replace(/<[^>]+>/g, "")
          .replace(/&nbsp;/g, " ")
          .replace(/&amp;/g, "&")
          .replace(/&lt;/g, "<")
          .replace(/&gt;/g, ">")
          .replace(/&quot;/g, '"')
          .replace(/&#39;/g, "'")
          .replace(/\\n{3,}/g, "\\n\\n")
          .trim();
      }
      // Truncate very long emails
      if (textBody.length > 20000) {
        textBody = textBody.substring(0, 20000) + "\\n... (truncated)";
      }
      result = {
        uid: msg.uid,
        subject: env.subject,
        from: env.from?.map(a => ({ name: a.name, address: a.address })),
        to: env.to?.map(a => ({ name: a.name, address: a.address })),
        cc: env.cc?.map(a => ({ name: a.name, address: a.address })) || [],
        date: env.date?.toISOString(),
        body: textBody,
      };
    }
    if (!result) throw new Error("Email with UID " + params.uid + " not found in " + folder);
    // Mark as read
    await client.messageFlagsAdd(String(params.uid), ["\\\\Seen"], { uid: true });
    return result;
  } finally {
    lock.release();
  }
} finally {
  await client.logout();
}
`,
    isPredefined: true,
  },
  {
    name: "internet_search",
    toolGroup: "internet",
    description:
      "Search the internet using Brave Search API. Returns web search results.",
    parameters: {
      type: "object",
      properties: {
        query: { type: "string", description: "Search query" },
        count: {
          type: "number",
          description: "Number of results to return (max 20)",
          default: 5,
        },
      },
      required: ["query"],
    },
    implementation: `
const apiKey = process.env.BRAVE_SEARCH_API_KEY;
if (!apiKey) throw new Error("BRAVE_SEARCH_API_KEY is not set");
const count = params.count || 5;
const url = new URL("https://api.search.brave.com/res/v1/web/search");
url.searchParams.set("q", params.query);
url.searchParams.set("count", String(count));
const res = await fetch(url.toString(), {
  headers: {
    "Accept": "application/json",
    "Accept-Encoding": "gzip",
    "X-Subscription-Token": apiKey,
  },
});
if (!res.ok) {
  const body = await res.text();
  throw new Error("Brave Search API error (HTTP " + res.status + "): " + body);
}
const data = await res.json();
const results = (data.web?.results || []).map((r) => ({
  title: r.title,
  url: r.url,
  description: r.description,
}));
return { results, query: params.query };
`,
    isPredefined: true,
  },
  {
    name: "get_current_datetime",
    toolGroup: null,
    description:
      "Get the current date and time, optionally in a specific timezone.",
    parameters: {
      type: "object",
      properties: {
        timezone: {
          type: "string",
          description:
            'IANA timezone name (e.g., "America/New_York", "UTC"). Defaults to UTC.',
          default: "UTC",
        },
      },
      required: [],
    },
    implementation: `
const tz = params.timezone || "UTC";
const now = new Date();
const formatted = now.toLocaleString("en-US", { timeZone: tz, dateStyle: "full", timeStyle: "long" });
return { datetime: formatted, timezone: tz, iso: now.toISOString(), timestamp: now.getTime() };
`,
    isPredefined: true,
  },
  {
    name: "http_request",
    toolGroup: "internet",
    description:
      "Make an HTTP request to any URL. Supports GET, POST, PUT, PATCH, DELETE.",
    parameters: {
      type: "object",
      properties: {
        url: { type: "string", description: "The URL to request" },
        method: {
          type: "string",
          description: "HTTP method",
          enum: ["GET", "POST", "PUT", "PATCH", "DELETE"],
          default: "GET",
        },
        headers: {
          type: "object",
          description: "Request headers as key-value pairs",
          additionalProperties: { type: "string" },
        },
        body: {
          type: "string",
          description: "Request body (for POST/PUT/PATCH)",
        },
      },
      required: ["url"],
    },
    implementation: `
const options = {
  method: params.method || "GET",
  headers: params.headers || {},
};
if (params.body && ["POST", "PUT", "PATCH"].includes(options.method)) {
  options.body = params.body;
  if (!options.headers["Content-Type"]) {
    options.headers["Content-Type"] = "application/json";
  }
}
const res = await fetch(params.url, options);
const contentType = res.headers.get("content-type") || "";
let data;
if (contentType.includes("application/json")) {
  data = await res.json();
} else {
  data = await res.text();
  if (data.length > 5000) data = data.substring(0, 5000) + "... (truncated)";
}
return { status: res.status, statusText: res.statusText, data };
`,
    isPredefined: true,
  },
  {
    name: "fetch_webpage",
    toolGroup: "internet",
    description:
      "Fetch a web page and extract its readable text content. Use after internet_search to read the full content of a search result URL.",
    parameters: {
      type: "object",
      properties: {
        url: { type: "string", description: "The URL of the web page to fetch" },
        maxLength: {
          type: "number",
          description: "Maximum characters of text to return (default 10000)",
          default: 10000,
        },
      },
      required: ["url"],
    },
    implementation: `
const maxLen = params.maxLength || 10000;
const res = await fetch(params.url, {
  headers: {
    "User-Agent": "Mozilla/5.0 (compatible; AgentBot/1.0)",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  },
  redirect: "follow",
});
if (!res.ok) {
  throw new Error("Failed to fetch page (HTTP " + res.status + "): " + (await res.text()).substring(0, 200));
}
const contentType = res.headers.get("content-type") || "";
if (contentType.includes("application/json")) {
  const json = await res.json();
  const text = JSON.stringify(json, null, 2);
  return { url: params.url, contentType, content: text.substring(0, maxLen), length: text.length, truncated: text.length > maxLen };
}
const html = await res.text();
// Strip HTML tags, scripts, styles to get readable text
let text = html
  .replace(/<script[^>]*>[\\s\\S]*?<\\/script>/gi, "")
  .replace(/<style[^>]*>[\\s\\S]*?<\\/style>/gi, "")
  .replace(/<nav[^>]*>[\\s\\S]*?<\\/nav>/gi, "")
  .replace(/<footer[^>]*>[\\s\\S]*?<\\/footer>/gi, "")
  .replace(/<header[^>]*>[\\s\\S]*?<\\/header>/gi, "")
  .replace(/<[^>]+>/g, " ")
  .replace(/&nbsp;/g, " ")
  .replace(/&amp;/g, "&")
  .replace(/&lt;/g, "<")
  .replace(/&gt;/g, ">")
  .replace(/&quot;/g, '"')
  .replace(/&#39;/g, "'")
  .replace(/\\s+/g, " ")
  .trim();
const truncated = text.length > maxLen;
if (truncated) text = text.substring(0, maxLen) + "...";
return { url: params.url, contentType, content: text, length: text.length, truncated };
`,
    isPredefined: true,
  },
  {
    name: "calculator",
    toolGroup: null,
    description:
      "Evaluate mathematical expressions. Supports basic arithmetic, Math functions, and simple JS expressions.",
    parameters: {
      type: "object",
      properties: {
        expression: {
          type: "string",
          description:
            'Mathematical expression to evaluate (e.g., "2 + 2", "Math.sqrt(16)", "Math.PI * 2")',
        },
      },
      required: ["expression"],
    },
    implementation: `
const expr = params.expression;
// Only allow safe math operations
const allowed = /^[0-9+\\-*/().,%\\s]|Math\\.[a-zA-Z]+|PI|E|sqrt|pow|abs|ceil|floor|round|log|sin|cos|tan|min|max|random/;
const tokens = expr.split(/\\s+/);
for (const token of tokens) {
  if (token && !allowed.test(token) && isNaN(Number(token))) {
    throw new Error("Unsafe expression: " + token);
  }
}
const fn = new Function("return (" + expr + ")");
const result = fn();
return { expression: expr, result: result };
`,
    isPredefined: true,
  },
  {
    name: "read_scratchpad",
    toolGroup: null,
    description:
      "Read the current contents of the scratchpad.",
    parameters: {
      type: "object",
      properties: {},
      required: [],
    },
    implementation: `
const fs = require("fs");
const filePath = process.env.SCRATCHPAD_FILE_PATH;
if (!filePath) throw new Error("Scratchpad is not configured");
let content = "";
try { content = fs.readFileSync(filePath, "utf-8"); } catch (e) {
  if (e.code === "ENOENT") return { content: "" };
  throw e;
}
return { content };
`,
    isPredefined: true,
  },
  {
    name: "write_scratchpad",
    toolGroup: null,
    description:
      "Write to the scratchpad. Overwrites the entire scratchpad content.",
    parameters: {
      type: "object",
      properties: {
        content: {
          type: "string",
          description: "The content to write to the scratchpad (replaces all existing content)",
        },
      },
      required: ["content"],
    },
    implementation: `
const fs = require("fs");
const path = require("path");
const filePath = process.env.SCRATCHPAD_FILE_PATH;
if (!filePath) throw new Error("Scratchpad is not configured");
fs.mkdirSync(path.dirname(filePath), { recursive: true });
fs.writeFileSync(filePath, params.content, "utf-8");
return { written: params.content.length };
`,
    isPredefined: true,
  },
  {
    name: "sleep",
    toolGroup: null,
    description:
      "Pause execution for a specified number of seconds. Useful for rate-limit cooldowns or pacing between actions. Maximum 300 seconds (5 minutes).",
    parameters: {
      type: "object",
      properties: {
        seconds: {
          type: "number",
          description: "Number of seconds to sleep (max 300)",
        },
      },
      required: ["seconds"],
    },
    implementation: `
const seconds = Math.min(Math.max(0, params.seconds), 300);
await new Promise(resolve => setTimeout(resolve, seconds * 1000));
return { slept: seconds };
`,
    isPredefined: true,
  },
  // ─── Moltbook Social Network Tools ───
  {
    name: "moltbook_register",
    toolGroup: "moltbook",
    description:
      "Register a new agent on Moltbook, the social network for AI agents. Returns an API key and a claim URL for a human to verify ownership. No authentication required. IMPORTANT: Save the returned api_key and pass it to all other moltbook tools.",
    parameters: {
      type: "object",
      properties: {
        name: {
          type: "string",
          description:
            "Unique agent name (letters, numbers, underscores only)",
        },
        description: {
          type: "string",
          description: "Short bio or description of the agent",
        },
      },
      required: ["name", "description"],
    },
    implementation: `
const BASE = "https://www.moltbook.com/api/v1";
const res = await fetch(BASE + "/agents/register", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ name: params.name, description: params.description }),
});
if (!res.ok) {
  const body = await res.text();
  throw new Error("Moltbook API error (HTTP " + res.status + "): " + body);
}
const data = await res.json();
return { ...data, note: "Save the api_key and pass it to all other moltbook tools. Give the claim_url to a human to verify ownership." };
`,
    isPredefined: true,
  },
  {
    name: "moltbook_profile",
    toolGroup: "moltbook",
    description:
      "View or update agent profiles on Moltbook. Actions: 'me' (view own profile), 'get' (view another agent's profile), 'update' (update own description/metadata), 'status' (check account status).",
    parameters: {
      type: "object",
      properties: {
        api_key: {
          type: "string",
          description: "Moltbook API key (from moltbook_register)",
        },
        action: {
          type: "string",
          enum: ["me", "get", "update", "status"],
          description: "Which profile action to perform",
        },
        name: {
          type: "string",
          description: "Agent name to look up (required for 'get' action)",
        },
        description: {
          type: "string",
          description: "New description (for 'update' action)",
        },
        metadata: {
          type: "object",
          description: "Metadata key-value pairs (for 'update' action)",
          additionalProperties: { type: "string" },
        },
      },
      required: ["api_key", "action"],
    },
    implementation: `
if (!params.api_key) throw new Error("api_key is required. Register first using moltbook_register tool.");
const BASE = "https://www.moltbook.com/api/v1";
const headers = { "Authorization": "Bearer " + params.api_key, "Content-Type": "application/json" };
let res;
if (params.action === "me") {
  res = await fetch(BASE + "/agents/me", { headers });
} else if (params.action === "get") {
  if (!params.name) throw new Error("name is required for 'get' action");
  res = await fetch(BASE + "/agents/profile?name=" + encodeURIComponent(params.name), { headers });
} else if (params.action === "update") {
  const body = {};
  if (params.description) body.description = params.description;
  if (params.metadata) body.metadata = params.metadata;
  res = await fetch(BASE + "/agents/me", { method: "PATCH", headers, body: JSON.stringify(body) });
} else if (params.action === "status") {
  res = await fetch(BASE + "/agents/status", { headers });
} else {
  throw new Error("Unknown action: " + params.action);
}
if (!res.ok) {
  const body = await res.text();
  throw new Error("Moltbook API error (HTTP " + res.status + "): " + body);
}
return await res.json();
`,
    isPredefined: true,
  },
  {
    name: "moltbook_post",
    toolGroup: "moltbook",
    description:
      "Create, get, or delete posts on Moltbook. Actions: 'create' (new post in a submolt), 'get' (fetch a single post by ID), 'delete' (remove own post). Rate limit: 1 post per 30 minutes.",
    parameters: {
      type: "object",
      properties: {
        api_key: {
          type: "string",
          description: "Moltbook API key (from moltbook_register)",
        },
        action: {
          type: "string",
          enum: ["create", "get", "delete"],
          description: "Which post action to perform",
        },
        post_id: {
          type: "string",
          description: "Post ID (required for 'get' and 'delete' actions)",
        },
        submolt: {
          type: "string",
          description: "Submolt name to post in (required for 'create')",
        },
        title: {
          type: "string",
          description: "Post title (required for 'create')",
        },
        content: {
          type: "string",
          description: "Post text content (for 'create'; use content OR url, not both)",
        },
        url: {
          type: "string",
          description: "Link URL (for 'create'; use content OR url, not both)",
        },
      },
      required: ["api_key", "action"],
    },
    implementation: `
if (!params.api_key) throw new Error("api_key is required. Register first using moltbook_register tool.");
const BASE = "https://www.moltbook.com/api/v1";
const headers = { "Authorization": "Bearer " + params.api_key, "Content-Type": "application/json" };
let res;
if (params.action === "create") {
  if (!params.submolt || !params.title) throw new Error("submolt and title are required for 'create'");
  const body = { submolt: params.submolt, title: params.title };
  if (params.content) body.content = params.content;
  if (params.url) body.url = params.url;
  res = await fetch(BASE + "/posts", { method: "POST", headers, body: JSON.stringify(body) });
} else if (params.action === "get") {
  if (!params.post_id) throw new Error("post_id is required for 'get'");
  res = await fetch(BASE + "/posts/" + encodeURIComponent(params.post_id), { headers });
} else if (params.action === "delete") {
  if (!params.post_id) throw new Error("post_id is required for 'delete'");
  res = await fetch(BASE + "/posts/" + encodeURIComponent(params.post_id), { method: "DELETE", headers });
} else {
  throw new Error("Unknown action: " + params.action);
}
if (!res.ok) {
  const body = await res.text();
  throw new Error("Moltbook API error (HTTP " + res.status + "): " + body);
}
return await res.json();
`,
    isPredefined: true,
  },
  {
    name: "moltbook_browse_posts",
    toolGroup: "moltbook",
    description:
      "Browse posts on Moltbook. Actions: 'global' (all posts), 'feed' (personalized feed from subscribed submolts), 'submolt' (posts in a specific submolt). Sort options: hot, new, top, rising.",
    parameters: {
      type: "object",
      properties: {
        api_key: {
          type: "string",
          description: "Moltbook API key (from moltbook_register)",
        },
        action: {
          type: "string",
          enum: ["global", "feed", "submolt"],
          description: "Which feed to browse",
        },
        submolt: {
          type: "string",
          description: "Submolt name (required for 'submolt' action)",
        },
        sort: {
          type: "string",
          enum: ["hot", "new", "top", "rising"],
          description: "Sort order (default: hot)",
        },
        limit: {
          type: "number",
          description: "Number of posts to return",
        },
      },
      required: ["api_key", "action"],
    },
    implementation: `
if (!params.api_key) throw new Error("api_key is required. Register first using moltbook_register tool.");
const BASE = "https://www.moltbook.com/api/v1";
const headers = { "Authorization": "Bearer " + params.api_key, "Content-Type": "application/json" };
let url;
if (params.action === "global") {
  url = new URL(BASE + "/posts");
} else if (params.action === "feed") {
  url = new URL(BASE + "/feed");
} else if (params.action === "submolt") {
  if (!params.submolt) throw new Error("submolt is required for 'submolt' action");
  url = new URL(BASE + "/submolts/" + encodeURIComponent(params.submolt) + "/feed");
} else {
  throw new Error("Unknown action: " + params.action);
}
if (params.sort) url.searchParams.set("sort", params.sort);
if (params.limit) url.searchParams.set("limit", String(params.limit));
const res = await fetch(url.toString(), { headers });
if (!res.ok) {
  const body = await res.text();
  throw new Error("Moltbook API error (HTTP " + res.status + "): " + body);
}
return await res.json();
`,
    isPredefined: true,
  },
  {
    name: "moltbook_comment",
    toolGroup: "moltbook",
    description:
      "Create comments or list comments on a Moltbook post. Actions: 'create' (add a comment, optionally as a reply), 'list' (get all comments on a post). Rate limits: 1 comment per 20 seconds, 50 comments per day.",
    parameters: {
      type: "object",
      properties: {
        api_key: {
          type: "string",
          description: "Moltbook API key (from moltbook_register)",
        },
        action: {
          type: "string",
          enum: ["create", "list"],
          description: "Which comment action to perform",
        },
        post_id: {
          type: "string",
          description: "Post ID to comment on or list comments for (required)",
        },
        content: {
          type: "string",
          description: "Comment text (required for 'create')",
        },
        parent_id: {
          type: "string",
          description: "Parent comment ID to reply to (optional, for 'create')",
        },
        sort: {
          type: "string",
          enum: ["top", "new", "controversial"],
          description: "Sort order for listing (default: top)",
        },
      },
      required: ["api_key", "action", "post_id"],
    },
    implementation: `
if (!params.api_key) throw new Error("api_key is required. Register first using moltbook_register tool.");
const BASE = "https://www.moltbook.com/api/v1";
const headers = { "Authorization": "Bearer " + params.api_key, "Content-Type": "application/json" };
let res;
if (params.action === "create") {
  if (!params.content) throw new Error("content is required for 'create'");
  const body = { content: params.content };
  if (params.parent_id) body.parent_id = params.parent_id;
  res = await fetch(BASE + "/posts/" + encodeURIComponent(params.post_id) + "/comments", { method: "POST", headers, body: JSON.stringify(body) });
} else if (params.action === "list") {
  let url = BASE + "/posts/" + encodeURIComponent(params.post_id) + "/comments";
  if (params.sort) url += "?sort=" + encodeURIComponent(params.sort);
  res = await fetch(url, { headers });
} else {
  throw new Error("Unknown action: " + params.action);
}
if (!res.ok) {
  const body = await res.text();
  throw new Error("Moltbook API error (HTTP " + res.status + "): " + body);
}
return await res.json();
`,
    isPredefined: true,
  },
  {
    name: "moltbook_vote",
    toolGroup: "moltbook",
    description:
      "Upvote or downvote posts and comments on Moltbook. Specify the target type ('post' or 'comment') and direction ('up' or 'down').",
    parameters: {
      type: "object",
      properties: {
        api_key: {
          type: "string",
          description: "Moltbook API key (from moltbook_register)",
        },
        target_type: {
          type: "string",
          enum: ["post", "comment"],
          description: "Whether to vote on a post or comment",
        },
        target_id: {
          type: "string",
          description: "The ID of the post or comment to vote on",
        },
        direction: {
          type: "string",
          enum: ["up", "down"],
          description: "Vote direction",
        },
      },
      required: ["api_key", "target_type", "target_id", "direction"],
    },
    implementation: `
if (!params.api_key) throw new Error("api_key is required. Register first using moltbook_register tool.");
const BASE = "https://www.moltbook.com/api/v1";
const headers = { "Authorization": "Bearer " + params.api_key, "Content-Type": "application/json" };
let url;
if (params.target_type === "post") {
  url = BASE + "/posts/" + encodeURIComponent(params.target_id) + "/" + params.direction + "vote";
} else if (params.target_type === "comment") {
  url = BASE + "/comments/" + encodeURIComponent(params.target_id) + "/" + params.direction + "vote";
} else {
  throw new Error("Unknown target_type: " + params.target_type);
}
const res = await fetch(url, { method: "POST", headers });
if (!res.ok) {
  const body = await res.text();
  throw new Error("Moltbook API error (HTTP " + res.status + "): " + body);
}
return await res.json();
`,
    isPredefined: true,
  },
  {
    name: "moltbook_submolt",
    toolGroup: "moltbook",
    description:
      "Manage submolts (communities) on Moltbook. Actions: 'create' (new submolt), 'list' (all submolts), 'get' (submolt info), 'subscribe', 'unsubscribe'.",
    parameters: {
      type: "object",
      properties: {
        api_key: {
          type: "string",
          description: "Moltbook API key (from moltbook_register)",
        },
        action: {
          type: "string",
          enum: ["create", "list", "get", "subscribe", "unsubscribe"],
          description: "Which submolt action to perform",
        },
        name: {
          type: "string",
          description: "Submolt name (required for create/get/subscribe/unsubscribe)",
        },
        display_name: {
          type: "string",
          description: "Display name (required for 'create')",
        },
        description: {
          type: "string",
          description: "Submolt description (for 'create')",
        },
      },
      required: ["api_key", "action"],
    },
    implementation: `
if (!params.api_key) throw new Error("api_key is required. Register first using moltbook_register tool.");
const BASE = "https://www.moltbook.com/api/v1";
const headers = { "Authorization": "Bearer " + params.api_key, "Content-Type": "application/json" };
let res;
if (params.action === "create") {
  if (!params.name || !params.display_name) throw new Error("name and display_name are required for 'create'");
  const body = { name: params.name, display_name: params.display_name };
  if (params.description) body.description = params.description;
  res = await fetch(BASE + "/submolts", { method: "POST", headers, body: JSON.stringify(body) });
} else if (params.action === "list") {
  res = await fetch(BASE + "/submolts", { headers });
} else if (params.action === "get") {
  if (!params.name) throw new Error("name is required for 'get'");
  res = await fetch(BASE + "/submolts/" + encodeURIComponent(params.name), { headers });
} else if (params.action === "subscribe") {
  if (!params.name) throw new Error("name is required for 'subscribe'");
  res = await fetch(BASE + "/submolts/" + encodeURIComponent(params.name) + "/subscribe", { method: "POST", headers });
} else if (params.action === "unsubscribe") {
  if (!params.name) throw new Error("name is required for 'unsubscribe'");
  res = await fetch(BASE + "/submolts/" + encodeURIComponent(params.name) + "/subscribe", { method: "DELETE", headers });
} else {
  throw new Error("Unknown action: " + params.action);
}
if (!res.ok) {
  const body = await res.text();
  throw new Error("Moltbook API error (HTTP " + res.status + "): " + body);
}
return await res.json();
`,
    isPredefined: true,
  },
  {
    name: "moltbook_follow",
    toolGroup: "moltbook",
    description:
      "Follow or unfollow another agent on Moltbook. Following an agent means their posts will appear in your personalized feed.",
    parameters: {
      type: "object",
      properties: {
        api_key: {
          type: "string",
          description: "Moltbook API key (from moltbook_register)",
        },
        action: {
          type: "string",
          enum: ["follow", "unfollow"],
          description: "Whether to follow or unfollow",
        },
        name: {
          type: "string",
          description: "The agent name to follow/unfollow",
        },
      },
      required: ["api_key", "action", "name"],
    },
    implementation: `
if (!params.api_key) throw new Error("api_key is required. Register first using moltbook_register tool.");
const BASE = "https://www.moltbook.com/api/v1";
const headers = { "Authorization": "Bearer " + params.api_key, "Content-Type": "application/json" };
const method = params.action === "follow" ? "POST" : "DELETE";
const res = await fetch(BASE + "/agents/" + encodeURIComponent(params.name) + "/follow", { method, headers });
if (!res.ok) {
  const body = await res.text();
  throw new Error("Moltbook API error (HTTP " + res.status + "): " + body);
}
return await res.json();
`,
    isPredefined: true,
  },
  {
    name: "moltbook_search",
    toolGroup: "moltbook",
    description:
      "Semantic search across Moltbook posts and comments. Returns results ranked by similarity score (0-1). Use this to find relevant discussions, topics, or content.",
    parameters: {
      type: "object",
      properties: {
        api_key: {
          type: "string",
          description: "Moltbook API key (from moltbook_register)",
        },
        query: {
          type: "string",
          description: "Search query (semantic search)",
        },
        type: {
          type: "string",
          enum: ["posts", "comments", "all"],
          description: "What to search (default: all)",
        },
        limit: {
          type: "number",
          description: "Maximum number of results to return",
        },
      },
      required: ["api_key", "query"],
    },
    implementation: `
if (!params.api_key) throw new Error("api_key is required. Register first using moltbook_register tool.");
const BASE = "https://www.moltbook.com/api/v1";
const headers = { "Authorization": "Bearer " + params.api_key, "Content-Type": "application/json" };
const url = new URL(BASE + "/search");
url.searchParams.set("q", params.query);
if (params.type) url.searchParams.set("type", params.type);
if (params.limit) url.searchParams.set("limit", String(params.limit));
const res = await fetch(url.toString(), { headers });
if (!res.ok) {
  const body = await res.text();
  throw new Error("Moltbook API error (HTTP " + res.status + "): " + body);
}
return await res.json();
`,
    isPredefined: true,
  },
  // ─── Wikipedia Tool ───
  {
    name: "wikipedia_search",
    toolGroup: "internet",
    description:
      "Search Wikipedia or fetch article content. Actions: 'search' (find articles matching a query, returns titles/snippets/page IDs), 'get_article' (fetch the introductory text of a specific article by title).",
    parameters: {
      type: "object",
      properties: {
        action: {
          type: "string",
          enum: ["search", "get_article"],
          description: "Which action to perform",
        },
        query: {
          type: "string",
          description: "Search query (required for 'search' action)",
        },
        title: {
          type: "string",
          description: "Exact article title (required for 'get_article' action)",
        },
        limit: {
          type: "number",
          description: "Number of search results to return (default 5, max 20; for 'search' action only)",
        },
      },
      required: ["action"],
    },
    implementation: `
const BASE = "https://en.wikipedia.org/w/api.php";
if (params.action === "search") {
  if (!params.query) throw new Error("query is required for 'search' action");
  const limit = Math.min(params.limit || 5, 20);
  const url = new URL(BASE);
  url.searchParams.set("action", "query");
  url.searchParams.set("list", "search");
  url.searchParams.set("srsearch", params.query);
  url.searchParams.set("srlimit", String(limit));
  url.searchParams.set("format", "json");
  url.searchParams.set("origin", "*");
  const res = await fetch(url.toString());
  if (!res.ok) throw new Error("Wikipedia API error (HTTP " + res.status + ")");
  const data = await res.json();
  const results = (data.query?.search || []).map((r) => ({
    title: r.title,
    pageId: r.pageid,
    snippet: r.snippet.replace(/<[^>]+>/g, ""),
    wordCount: r.wordcount,
  }));
  return { query: params.query, results };
} else if (params.action === "get_article") {
  if (!params.title) throw new Error("title is required for 'get_article' action");
  const url = new URL(BASE);
  url.searchParams.set("action", "query");
  url.searchParams.set("titles", params.title);
  url.searchParams.set("prop", "extracts");
  url.searchParams.set("exintro", "1");
  url.searchParams.set("explaintext", "1");
  url.searchParams.set("format", "json");
  url.searchParams.set("origin", "*");
  const res = await fetch(url.toString());
  if (!res.ok) throw new Error("Wikipedia API error (HTTP " + res.status + ")");
  const data = await res.json();
  const pages = data.query?.pages || {};
  const page = Object.values(pages)[0];
  if (!page || page.missing !== undefined) {
    return { title: params.title, found: false, extract: null };
  }
  return { title: page.title, pageId: page.pageid, found: true, extract: page.extract };
} else {
  throw new Error("Unknown action: " + params.action);
}
`,
    isPredefined: true,
  },
  // ─── Browser Tools (Persistent Playwright Sessions) ───
  {
    name: "browser_navigate",
    toolGroup: "browser",
    description:
      "Navigate to a URL in a persistent browser session. Returns the page title, readable text content, and a numbered list of interactive elements (links, buttons, inputs) you can reference by index in subsequent browser_click or browser_type calls. The browser session persists across tool calls within the same conversation session.",
    parameters: {
      type: "object",
      properties: {
        url: {
          type: "string",
          description: "The URL to navigate to",
        },
      },
      required: ["url"],
    },
    implementation: `
const { sessionId, browserManager } = context;
if (!browserManager) throw new Error("Browser manager not available");
const page = await browserManager.getPage(sessionId);
await page.goto(params.url, { waitUntil: "domcontentloaded", timeout: 30000 });
// Wait a bit for dynamic content
await page.waitForTimeout(1000);
const content = await browserManager.extractPageContent(page);
browserManager.setElementSelectors(sessionId, content.elements.map((_, i) => {
  // Re-extract selectors from the extraction - stored internally
  return "";
}));
// extractPageContent stores selectors internally; re-run to get them
const extraction = await page.evaluate(() => {
  const results = [];
  const interactiveSelectors = 'a[href], button, input, textarea, select, [role="button"], [role="link"], [onclick]';
  const elements = document.querySelectorAll(interactiveSelectors);
  elements.forEach((el) => {
    const style = window.getComputedStyle(el);
    if (style.display === "none" || style.visibility === "hidden" || style.opacity === "0") return;
    const tag = el.tagName.toLowerCase();
    const text = (el.textContent || el.placeholder || el.value || el.getAttribute("aria-label") || "").trim().substring(0, 80);
    if (!text && tag !== "input" && tag !== "textarea" && tag !== "select") return;
    let selector = tag;
    const id = el.getAttribute("id");
    if (id) { selector = "#" + id; }
    else {
      const name = el.getAttribute("name");
      if (name) selector = tag + '[name="' + name + '"]';
    }
    results.push(selector);
  });
  return results;
});
browserManager.setElementSelectors(sessionId, extraction);
return { title: content.title, url: content.url, text: content.text, elements: content.elements };
`,
    isPredefined: true,
  },
  {
    name: "browser_click",
    toolGroup: "browser",
    description:
      "Click an interactive element on the current page by its index number (from the elements list returned by browser_navigate or browser_read_page). Returns the updated page state after clicking.",
    parameters: {
      type: "object",
      properties: {
        index: {
          type: "number",
          description:
            "The index number of the element to click (from the elements list)",
        },
      },
      required: ["index"],
    },
    implementation: `
const { sessionId, browserManager } = context;
if (!browserManager) throw new Error("Browser manager not available");
const page = await browserManager.getPage(sessionId);
const selectors = browserManager.getElementSelectors(sessionId);
if (params.index < 0 || params.index >= selectors.length) {
  throw new Error("Element index " + params.index + " is out of range. Valid range: 0-" + (selectors.length - 1));
}
const selector = selectors[params.index];
try {
  await page.click(selector, { timeout: 5000 });
} catch (e) {
  // Fallback: try nth interactive element
  const interactiveSelectors = 'a[href], button, input, textarea, select, [role="button"], [role="link"], [onclick]';
  const elements = await page.$$(interactiveSelectors);
  const visible = [];
  for (const el of elements) {
    if (await el.isVisible()) visible.push(el);
  }
  if (params.index < visible.length) {
    await visible[params.index].click();
  } else {
    throw new Error("Could not click element at index " + params.index + ": " + e.message);
  }
}
await page.waitForTimeout(1500);
const content = await browserManager.extractPageContent(page);
// Update selectors
const extraction = await page.evaluate(() => {
  const results = [];
  const interactiveSelectors = 'a[href], button, input, textarea, select, [role="button"], [role="link"], [onclick]';
  const elements = document.querySelectorAll(interactiveSelectors);
  elements.forEach((el) => {
    const style = window.getComputedStyle(el);
    if (style.display === "none" || style.visibility === "hidden" || style.opacity === "0") return;
    const tag = el.tagName.toLowerCase();
    const text = (el.textContent || el.placeholder || el.value || el.getAttribute("aria-label") || "").trim().substring(0, 80);
    if (!text && tag !== "input" && tag !== "textarea" && tag !== "select") return;
    let selector = tag;
    const id = el.getAttribute("id");
    if (id) { selector = "#" + id; }
    else {
      const name = el.getAttribute("name");
      if (name) selector = tag + '[name="' + name + '"]';
    }
    results.push(selector);
  });
  return results;
});
browserManager.setElementSelectors(sessionId, extraction);
return { title: content.title, url: content.url, text: content.text, elements: content.elements };
`,
    isPredefined: true,
  },
  {
    name: "browser_type",
    toolGroup: "browser",
    description:
      "Type text into an input element on the current page by its index number (from the elements list). Optionally press Enter after typing. Returns the updated page state.",
    parameters: {
      type: "object",
      properties: {
        index: {
          type: "number",
          description:
            "The index number of the input element to type into (from the elements list)",
        },
        text: {
          type: "string",
          description: "The text to type into the element",
        },
        pressEnter: {
          type: "boolean",
          description: "Whether to press Enter after typing (default: false)",
          default: false,
        },
        clear: {
          type: "boolean",
          description:
            "Whether to clear the field before typing (default: true)",
          default: true,
        },
      },
      required: ["index", "text"],
    },
    implementation: `
const { sessionId, browserManager } = context;
if (!browserManager) throw new Error("Browser manager not available");
const page = await browserManager.getPage(sessionId);
const selectors = browserManager.getElementSelectors(sessionId);
if (params.index < 0 || params.index >= selectors.length) {
  throw new Error("Element index " + params.index + " is out of range. Valid range: 0-" + (selectors.length - 1));
}
const selector = selectors[params.index];
const shouldClear = params.clear !== false;
try {
  if (shouldClear) {
    await page.fill(selector, params.text, { timeout: 5000 });
  } else {
    await page.click(selector, { timeout: 5000 });
    await page.keyboard.type(params.text);
  }
} catch (e) {
  // Fallback: try nth interactive element
  const interactiveSelectors = 'a[href], button, input, textarea, select, [role="button"], [role="link"], [onclick]';
  const elements = await page.$$(interactiveSelectors);
  const visible = [];
  for (const el of elements) {
    if (await el.isVisible()) visible.push(el);
  }
  if (params.index < visible.length) {
    if (shouldClear) {
      await visible[params.index].fill(params.text);
    } else {
      await visible[params.index].click();
      await page.keyboard.type(params.text);
    }
  } else {
    throw new Error("Could not type into element at index " + params.index + ": " + e.message);
  }
}
if (params.pressEnter) {
  await page.keyboard.press("Enter");
  await page.waitForTimeout(2000);
} else {
  await page.waitForTimeout(500);
}
const content = await browserManager.extractPageContent(page);
const extraction = await page.evaluate(() => {
  const results = [];
  const interactiveSelectors = 'a[href], button, input, textarea, select, [role="button"], [role="link"], [onclick]';
  const elements = document.querySelectorAll(interactiveSelectors);
  elements.forEach((el) => {
    const style = window.getComputedStyle(el);
    if (style.display === "none" || style.visibility === "hidden" || style.opacity === "0") return;
    const tag = el.tagName.toLowerCase();
    const text = (el.textContent || el.placeholder || el.value || el.getAttribute("aria-label") || "").trim().substring(0, 80);
    if (!text && tag !== "input" && tag !== "textarea" && tag !== "select") return;
    let selector = tag;
    const id = el.getAttribute("id");
    if (id) { selector = "#" + id; }
    else {
      const name = el.getAttribute("name");
      if (name) selector = tag + '[name="' + name + '"]';
    }
    results.push(selector);
  });
  return results;
});
browserManager.setElementSelectors(sessionId, extraction);
return { title: content.title, url: content.url, text: content.text, elements: content.elements };
`,
    isPredefined: true,
  },
  {
    name: "browser_read_page",
    toolGroup: "browser",
    description:
      "Re-read the current page in the browser session. Use this after dynamic updates, AJAX loads, or when you need to refresh the element index list. Returns the page title, readable text, and numbered interactive elements.",
    parameters: {
      type: "object",
      properties: {
        waitMs: {
          type: "number",
          description:
            "Milliseconds to wait before reading (for dynamic content, default: 500)",
          default: 500,
        },
      },
      required: [],
    },
    implementation: `
const { sessionId, browserManager } = context;
if (!browserManager) throw new Error("Browser manager not available");
const page = await browserManager.getPage(sessionId);
const waitMs = params.waitMs || 500;
await page.waitForTimeout(waitMs);
const content = await browserManager.extractPageContent(page);
const extraction = await page.evaluate(() => {
  const results = [];
  const interactiveSelectors = 'a[href], button, input, textarea, select, [role="button"], [role="link"], [onclick]';
  const elements = document.querySelectorAll(interactiveSelectors);
  elements.forEach((el) => {
    const style = window.getComputedStyle(el);
    if (style.display === "none" || style.visibility === "hidden" || style.opacity === "0") return;
    const tag = el.tagName.toLowerCase();
    const text = (el.textContent || el.placeholder || el.value || el.getAttribute("aria-label") || "").trim().substring(0, 80);
    if (!text && tag !== "input" && tag !== "textarea" && tag !== "select") return;
    let selector = tag;
    const id = el.getAttribute("id");
    if (id) { selector = "#" + id; }
    else {
      const name = el.getAttribute("name");
      if (name) selector = tag + '[name="' + name + '"]';
    }
    results.push(selector);
  });
  return results;
});
browserManager.setElementSelectors(sessionId, extraction);
return { title: content.title, url: content.url, text: content.text, elements: content.elements };
`,
    isPredefined: true,
  },
  {
    name: "browser_close",
    toolGroup: "browser",
    description:
      "Explicitly close the browser session, freeing resources. The session will also auto-close after 5 minutes of inactivity. Use this when you are done browsing.",
    parameters: {
      type: "object",
      properties: {},
      required: [],
    },
    implementation: `
const { sessionId, browserManager } = context;
if (!browserManager) throw new Error("Browser manager not available");
await browserManager.closeSession(sessionId);
return { status: "closed", message: "Browser session closed successfully." };
`,
    isPredefined: true,
  },
];

async function main() {
  console.log("Seeding predefined tools...");
  for (const tool of predefinedTools) {
    await prisma.tool.upsert({
      where: { name: tool.name },
      update: {
        description: tool.description,
        parameters: tool.parameters,
        implementation: tool.implementation,
        isPredefined: tool.isPredefined,
        toolGroup: tool.toolGroup,
      },
      create: tool,
    });
    console.log(`  Seeded: ${tool.name}`);
  }
  console.log("Seeding complete.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
