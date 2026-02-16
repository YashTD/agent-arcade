import type { Browser, BrowserContext, Page } from "playwright";

interface PageContent {
  title: string;
  url: string;
  text: string;
  elements: string[];
}

interface BrowserSession {
  context: BrowserContext;
  page: Page;
  /** Element locator selectors from last extraction, indexed by position */
  elementSelectors: string[];
  timeoutHandle: ReturnType<typeof setTimeout>;
}

const INACTIVITY_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Manages persistent Playwright browser sessions keyed by session ID.
 * Singleton via globalThis to survive hot-reload in development.
 */
export class BrowserSessionManager {
  private sessions = new Map<string, BrowserSession>();
  private browser: Browser | null = null;
  private browserLaunchPromise: Promise<Browser> | null = null;

  /**
   * Launch or return the shared browser instance.
   */
  private async getBrowser(): Promise<Browser> {
    if (this.browser?.isConnected()) return this.browser;

    // Avoid racing multiple launches
    if (this.browserLaunchPromise) return this.browserLaunchPromise;

    this.browserLaunchPromise = (async () => {
      const { chromium } = await import("playwright");
      const browser = await chromium.launch({ headless: false });
      this.browser = browser;
      this.browserLaunchPromise = null;
      return browser;
    })();

    return this.browserLaunchPromise;
  }

  /**
   * Get (or create) a Page for the given session.
   * Resets the inactivity timeout on each access.
   */
  async getPage(sessionId: string): Promise<Page> {
    const existing = this.sessions.get(sessionId);
    if (existing) {
      // Reset inactivity timer
      clearTimeout(existing.timeoutHandle);
      existing.timeoutHandle = setTimeout(
        () => this.closeSession(sessionId),
        INACTIVITY_TIMEOUT_MS
      );
      return existing.page;
    }

    // Create a new browser context + page
    const browser = await this.getBrowser();
    const context = await browser.newContext({
      userAgent:
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    });
    const page = await context.newPage();

    const timeoutHandle = setTimeout(
      () => this.closeSession(sessionId),
      INACTIVITY_TIMEOUT_MS
    );

    this.sessions.set(sessionId, {
      context,
      page,
      elementSelectors: [],
      timeoutHandle,
    });

    return page;
  }

  /**
   * Get the stored element selectors for a session (from last page extraction).
   */
  getElementSelectors(sessionId: string): string[] {
    return this.sessions.get(sessionId)?.elementSelectors ?? [];
  }

  /**
   * Update stored element selectors for a session.
   */
  setElementSelectors(sessionId: string, selectors: string[]): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.elementSelectors = selectors;
    }
  }

  /**
   * Close and clean up a browser session.
   */
  async closeSession(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    clearTimeout(session.timeoutHandle);
    this.sessions.delete(sessionId);

    try {
      await session.context.close();
    } catch {
      // Context may already be closed
    }

    // If no more sessions, close the browser entirely
    if (this.sessions.size === 0 && this.browser) {
      try {
        await this.browser.close();
      } catch {
        // Ignore
      }
      this.browser = null;
    }
  }

  /**
   * Extract readable content and interactive elements from the current page.
   */
  async extractPageContent(page: Page): Promise<PageContent> {
    const title = await page.title();
    const url = page.url();

    // Extract readable text (innerText of body, truncated)
    const text = await page.evaluate(() => {
      const body = document.body;
      if (!body) return "";
      // Remove script/style content
      const clone = body.cloneNode(true) as HTMLElement;
      clone
        .querySelectorAll("script, style, noscript, svg")
        .forEach((el) => el.remove());
      const raw = clone.innerText || "";
      // Collapse whitespace
      return raw.replace(/\n{3,}/g, "\n\n").trim();
    });

    // Truncate text to 15000 chars
    const maxTextLen = 15000;
    const truncatedText =
      text.length > maxTextLen
        ? text.substring(0, maxTextLen) + "\n... (truncated)"
        : text;

    // Extract interactive elements with indexed references
    const extraction = await page.evaluate(() => {
      const results: {
        tag: string;
        type?: string;
        text: string;
        selector: string;
        href?: string;
        name?: string;
        options?: string[];
      }[] = [];

      const interactiveSelectors =
        'a[href], button, input, textarea, select, [role="button"], [role="link"], [onclick]';
      const elements = document.querySelectorAll(interactiveSelectors);

      elements.forEach((el) => {
        // Skip hidden elements
        const style = window.getComputedStyle(el);
        if (
          style.display === "none" ||
          style.visibility === "hidden" ||
          style.opacity === "0"
        )
          return;

        const tag = el.tagName.toLowerCase();
        const text = (
          el.textContent ||
          (el as HTMLInputElement).placeholder ||
          (el as HTMLInputElement).value ||
          el.getAttribute("aria-label") ||
          ""
        )
          .trim()
          .substring(0, 80);

        if (!text && tag !== "input" && tag !== "textarea" && tag !== "select")
          return;

        // Build a unique-ish selector
        let selector = tag;
        const id = el.getAttribute("id");
        if (id) {
          selector = `#${id}`;
        } else {
          const name = el.getAttribute("name");
          if (name) selector = `${tag}[name="${name}"]`;
          else if (text) {
            if (tag === "a") selector = `a:has-text("${text.substring(0, 40)}")`;
            else if (tag === "button" || el.getAttribute("role") === "button")
              selector = `button:has-text("${text.substring(0, 40)}")`;
            else {
              const cls = el.className
                ? `.${el.className.split(/\s+/).slice(0, 2).join(".")}`
                : "";
              selector = `${tag}${cls}`;
            }
          }
        }

        const entry: (typeof results)[0] = { tag, text, selector };

        if (tag === "input") {
          entry.type =
            (el as HTMLInputElement).type || "text";
        }
        if (tag === "a") {
          entry.href = (el as HTMLAnchorElement).href;
        }
        if (el.getAttribute("name")) {
          entry.name = el.getAttribute("name")!;
        }
        if (tag === "select") {
          const opts = Array.from(
            (el as HTMLSelectElement).options
          ).map((o) => o.text.trim());
          entry.options = opts.slice(0, 10);
        }

        results.push(entry);
      });

      return results;
    });

    // Format elements as indexed list and collect selectors
    const elements: string[] = [];
    const selectors: string[] = [];

    extraction.forEach((el, i) => {
      let desc = "";
      if (el.tag === "a") {
        desc = `link "${el.text}"`;
        if (el.href) desc += ` (href="${el.href}")`;
      } else if (
        el.tag === "button" ||
        el.selector.includes("button")
      ) {
        desc = `button "${el.text}"`;
      } else if (el.tag === "input") {
        desc = `input[${el.type || "text"}] "${el.text}"`;
        if (el.name) desc += ` (name="${el.name}")`;
      } else if (el.tag === "textarea") {
        desc = `textarea "${el.text}"`;
        if (el.name) desc += ` (name="${el.name}")`;
      } else if (el.tag === "select") {
        desc = `select "${el.text}"`;
        if (el.options) desc += ` (options: ${el.options.join(", ")})`;
      } else {
        desc = `${el.tag} "${el.text}"`;
      }

      elements.push(`[${i}] ${desc}`);
      selectors.push(el.selector);
    });

    return { title, url, text: truncatedText, elements };
  }
}

// Singleton — survives Next.js hot reload via globalThis
const globalKey = "__browserManager" as const;

declare global {
  // eslint-disable-next-line no-var
  var __browserManager: BrowserSessionManager | undefined;
}

export function getBrowserManager(): BrowserSessionManager {
  if (!globalThis[globalKey]) {
    globalThis[globalKey] = new BrowserSessionManager();
  }
  return globalThis[globalKey];
}
