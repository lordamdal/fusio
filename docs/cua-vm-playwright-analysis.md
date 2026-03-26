# CUA / VM / Playwright — Analysis & Integration Guide

> **TL;DR**: Integrating Computer Use APIs (CUA) from Anthropic and/or OpenAI into Fusio's worker nodes would **significantly increase task completion quality**. The current architecture captures screenshots but never analyzes them — adding an LLM perception layer transforms workers from blind script executors into adaptive, vision-guided agents. Browser extensions can be loaded on-the-fly in Docker containers using Playwright's persistent context with `--load-extension` flags.

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Current Architecture Gaps](#2-current-architecture-gaps)
3. [Anthropic Computer Use API](#3-anthropic-computer-use-api-cua)
4. [OpenAI Computer Use API](#4-openai-computer-use-api-cua)
5. [Playwright in Docker/VM — Current & Enhanced](#5-playwright-in-dockervm--current--enhanced)
6. [Browser Extensions — On-the-Fly Installation](#6-browser-extensions--on-the-fly-installation)
7. [Quality Impact Assessment](#7-quality-impact-assessment)
8. [Recommended Integration Architecture](#8-recommended-integration-architecture)
9. [References](#9-references)

---

## 1. Executive Summary

**Will CUA / VM / Playwright improvements increase task quality? Yes — substantially.**

Fusio's current worker nodes execute browser tasks using a **scripted action loop**: the requester sends explicit actions (click x,y / type "text" / navigate to URL), and the worker executes them blindly. Screenshots are captured but never analyzed. This means:

- Workers cannot **adapt** when a page layout changes or an unexpected modal appears.
- Workers cannot **reason** about what they see — they follow instructions literally.
- Workers cannot **recover** from errors — a misclick or changed DOM breaks the entire job.

Computer Use APIs solve this by placing an LLM (Claude or GPT) **inside the action loop**. Instead of executing pre-scripted actions, the LLM:

1. **Sees** the current screenshot
2. **Reasons** about what to do next to achieve the goal
3. **Acts** (click, type, scroll, etc.)
4. **Observes** the result and repeats

This transforms Fusio workers from "remote keyboard/mouse" into **autonomous browser agents** with visual understanding, error recovery, and goal-driven behavior.

---

## 2. Current Architecture Gaps

### What Fusio Does Today

```
Requester → ActionPacket (click/type/scroll) → Worker → Playwright → Screenshot → ObservationPacket
```

- **9 action types**: `navigate`, `click`, `type`, `scroll`, `screenshot`, `wait`, `key`, `select`, `hover`
- **Docker isolation**: Each job runs in a 1.5GB `fusio-browser:latest` container
- **Playwright 1.42.0**: Chromium-only, connected via CDP
- **Max 200 steps**, 30-minute timeout per job
- **Cryptographic signing**: All packets signed with Ed25519

### What's Missing

| Gap | Impact |
|-----|--------|
| **No visual grounding** | Screenshots captured as base64 but never analyzed by an LLM. Workers are blind. |
| **No adaptive reasoning** | If a button moves, a popup appears, or a CAPTCHA triggers — the job fails. |
| **No error recovery** | A single misclick or selector failure cascades into job failure. |
| **No complex workflows** | Multi-step tasks (login → navigate → fill form → submit) require explicit scripting for every step. |
| **No file upload/download** | No mechanism to handle file dialogs or download triggers. |
| **No dynamic content handling** | SPAs, lazy-loaded content, and JS-rendered pages often break simple selector-based automation. |
| **No multi-tab/window support** | Limited to single page context. |

---

## 3. Anthropic Computer Use API (CUA)

### Overview

Claude's Computer Use tool enables the model to **see and interact with desktop environments** through screenshots and mouse/keyboard control. Claude achieves state-of-the-art results on [WebArena](https://webarena.dev/) for autonomous web navigation.

**Status**: Beta — requires a beta header.

### Model Compatibility

| Model | Tool Version | Beta Header |
|-------|-------------|-------------|
| Claude Opus 4.6, Sonnet 4.6, Opus 4.5 | `computer_20251124` | `computer-use-2025-11-24` |
| Sonnet 4.5, Haiku 4.5, Opus 4.1, Sonnet 4, Opus 4 | `computer_20250124` | `computer-use-2025-01-24` |

### How It Works

```
┌─────────────────────────────────────────────────────────┐
│  1. Send goal + computer tool definition to Claude API  │
│  2. Claude responds with tool_use (e.g., "click 450,320") │
│  3. Execute action on VM/container (Playwright/xdotool) │
│  4. Capture screenshot                                   │
│  5. Send screenshot back as tool_result                  │
│  6. Claude analyzes → decides next action                │
│  7. Repeat until task complete or max steps reached      │
└─────────────────────────────────────────────────────────┘
```

Claude does **not** connect to the environment directly. Your application:
1. Receives Claude's tool use requests
2. Translates them into actions in your environment (Playwright, xdotool, etc.)
3. Captures results (screenshots, command output)
4. Returns results to Claude

### Supported Actions

The `computer_20251124` tool supports:

| Action | Description |
|--------|-------------|
| `key` | Press key(s) — e.g., `"Return"`, `"ctrl+s"` |
| `hold_key` | Hold a key while performing other actions |
| `type` | Type a string of text |
| `cursor_position` | Get current cursor coordinates |
| `mouse_move` | Move cursor to (x, y) |
| `left_click` | Click at position |
| `left_click_drag` | Click and drag to target position |
| `right_click` | Right-click at position |
| `middle_click` | Middle-click at position |
| `double_click` | Double-click at position |
| `triple_click` | Triple-click (select line/paragraph) |
| `scroll` | Scroll up/down/left/right by amount |
| `wait` | Pause execution |
| `screenshot` | Capture current screen state |
| `zoom` | Zoom into a region for detailed inspection (new in 20251124) |

### Tool Definition (TypeScript)

```typescript
const tools = [
  {
    type: "computer_20251124",
    name: "computer",
    display_width_px: 1024,
    display_height_px: 768,
    display_number: 1,
  },
  {
    type: "text_editor_20250728",
    name: "str_replace_based_edit_tool",
  },
  {
    type: "bash_20250124",
    name: "bash",
  },
];
```

### Agent Loop — TypeScript Example for Fusio

```typescript
import Anthropic from "@anthropic-ai/sdk";

interface ComputerAction {
  action: string;
  coordinate?: [number, number];
  text?: string;
  key?: string;
  scroll_direction?: string;
  scroll_amount?: number;
}

async function cuaAgentLoop(
  goal: string,
  executeAction: (action: ComputerAction) => Promise<string>, // returns base64 screenshot
  maxSteps: number = 200,
): Promise<void> {
  const client = new Anthropic();
  const messages: Anthropic.Messages.MessageParam[] = [
    { role: "user", content: goal },
  ];

  for (let step = 0; step < maxSteps; step++) {
    const response = await client.beta.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 4096,
      tools: [
        {
          type: "computer_20251124",
          name: "computer",
          display_width_px: 1024,
          display_height_px: 768,
          display_number: 1,
        },
      ],
      messages,
      betas: ["computer-use-2025-11-24"],
    });

    // If Claude responds with text only, task is complete
    if (response.stop_reason === "end_turn") {
      const textBlock = response.content.find((b) => b.type === "text");
      console.log("Task complete:", textBlock?.text);
      return;
    }

    // Process tool use requests
    const toolUseBlocks = response.content.filter(
      (b) => b.type === "tool_use",
    );
    messages.push({ role: "assistant", content: response.content });

    const toolResults: Anthropic.Messages.ToolResultBlockParam[] = [];

    for (const toolUse of toolUseBlocks) {
      if (toolUse.type !== "tool_use") continue;

      const input = toolUse.input as ComputerAction;

      if (input.action === "screenshot") {
        // Just capture screenshot, no action to execute
        const screenshot = await executeAction({ action: "screenshot" });
        toolResults.push({
          type: "tool_result",
          tool_use_id: toolUse.id,
          content: [
            {
              type: "image",
              source: {
                type: "base64",
                media_type: "image/png",
                data: screenshot,
              },
            },
          ],
        });
      } else {
        // Execute action and capture resulting screenshot
        const screenshot = await executeAction(input);
        toolResults.push({
          type: "tool_result",
          tool_use_id: toolUse.id,
          content: [
            {
              type: "image",
              source: {
                type: "base64",
                media_type: "image/png",
                data: screenshot,
              },
            },
          ],
        });
      }
    }

    messages.push({ role: "user", content: toolResults });
  }
}
```

### Security Considerations

- **Always run in a VM or container** with minimal privileges
- **Limit internet access** to an allowlist of required domains
- **Never expose sensitive credentials** to the model
- **Human-in-the-loop** for high-impact actions (financial, account changes)
- Anthropic provides **automatic prompt injection classifiers** that flag suspicious content in screenshots

### Pricing

Computer Use is billed at standard Claude API token rates. Each step involves:
- **Input tokens**: System prompt + conversation history + screenshot (base64 image)
- **Output tokens**: Claude's reasoning + tool use request
- Screenshots are the dominant cost — a 1024x768 PNG is typically 1,000-2,000 tokens
- **Estimate**: ~$0.01–0.05 per step depending on model and image size

---

## 4. OpenAI Computer Use API (CUA)

### Overview

OpenAI's Computer Use operates through the **Responses API** using the `gpt-5.4` model. It follows a similar pattern to Anthropic's CUA but with different API structure.

### How It Works

```
┌──────────────────────────────────────────────────────────┐
│  1. Send task + {"type": "computer"} tool to Responses API│
│  2. Response contains computer_call with actions[] array  │
│  3. Execute each action sequentially                      │
│  4. Capture updated screenshot                            │
│  5. Send screenshot back as computer_call_output          │
│  6. Use previous_response_id for context continuity       │
│  7. Repeat until no more computer_call items              │
└──────────────────────────────────────────────────────────┘
```

### Supported Actions

| Action | Description |
|--------|-------------|
| `click` | Click at (x, y) with button specification |
| `double_click` | Double-click at coordinates |
| `scroll` | Scroll with scrollX/scrollY values |
| `type` | Text input |
| `keypress` | Keyboard shortcuts |
| `drag` | Drag operations |
| `move` | Mouse movement |
| `wait` | Pause execution |
| `screenshot` | Capture current UI state |

### Key Differences from Anthropic CUA

| Aspect | Anthropic CUA | OpenAI CUA |
|--------|---------------|------------|
| **Model** | Claude Opus 4.6 / Sonnet 4.6 | GPT-5.4 |
| **API** | Messages API (beta) | Responses API |
| **Context** | Full message history | `previous_response_id` |
| **Actions** | Single action per tool_use | Batched actions[] array |
| **Unique features** | `zoom`, `triple_click`, `hold_key` | Batched multi-action responses |
| **Resolution** | Any (configurable) | Recommended 1440x900 or 1600x900 |
| **Screenshots** | Base64 in tool_result | Base64 with `detail: "original"` |
| **Extra tools** | text_editor, bash (built-in) | Custom tools alongside computer |

### TypeScript Example

```typescript
import OpenAI from "openai";

const client = new OpenAI();

async function openaiCuaLoop(
  goal: string,
  executeAction: (action: any) => Promise<string>,
): Promise<void> {
  // Initial request
  let response = await client.responses.create({
    model: "gpt-5.4",
    tools: [{ type: "computer" }],
    input: goal,
  });

  while (true) {
    const computerCalls = response.output.filter(
      (item: any) => item.type === "computer_call",
    );

    if (computerCalls.length === 0) break;

    for (const call of computerCalls) {
      // Execute each action in the call's actions array
      let screenshot: string = "";
      for (const action of call.actions) {
        screenshot = await executeAction(action);
      }

      // Send result back with screenshot
      response = await client.responses.create({
        model: "gpt-5.4",
        tools: [{ type: "computer" }],
        previous_response_id: response.id,
        input: [
          {
            type: "computer_call_output",
            call_id: call.id,
            output: {
              type: "computer_screenshot",
              image_url: `data:image/png;base64,${screenshot}`,
            },
          },
        ],
      });
    }
  }
}
```

### Environment Recommendations (from OpenAI docs)

**Browser automation approach:**
```typescript
const browser = await chromium.launch({
  chromiumSandbox: true,
  env: {},
  args: ["--disable-extensions", "--disable-file-system"],
});
```

**VM approach (Docker):**
- Ubuntu 22.04 with Xvfb, x11vnc, xdotool, Firefox
- Actions translated to xdotool commands: `xdotool mousemove X Y click BUTTON`

---

## 5. Playwright in Docker/VM — Current & Enhanced

### Current Setup in Fusio

```
services/worker-node/src/browser/
├── playwright.ts    — CDP connection, screenshot capture
├── actions.ts       — 9 action types executed via Playwright API
└── container.ts     — Docker container lifecycle (start/stop/health)
```

The worker:
1. Starts a Docker container with `fusio-browser:latest` (1.5GB image)
2. Connects to Chromium via CDP (`chromium.connectOverCDP`)
3. Executes actions from `ActionPacket` messages
4. Returns screenshots + DOM element counts in `ObservationPacket`

### Enhancement Opportunities

| Enhancement | Benefit | Effort |
|-------------|---------|--------|
| **Headless Shell mode** | Faster, lower memory — Playwright's `chromium` channel with `--headless=new` | Low |
| **Network interception** | Monitor/modify requests, block ads/trackers, capture API responses | Medium |
| **WebDriver BiDi** | Bidirectional protocol for richer browser control | Medium |
| **Multi-page contexts** | Handle popups, new tabs, OAuth flows | Medium |
| **Request/response logging** | Capture all network traffic for debugging and auditing | Low |
| **File download handling** | Intercept download events, save to container volume | Medium |
| **Geolocation/timezone spoofing** | Simulate different locations for geo-restricted content | Low |
| **Stealth plugins** | Reduce bot detection via `playwright-extra` + `stealth` plugin | Medium |

### Upgraded Playwright Config

```typescript
import { chromium, BrowserContext } from "playwright";

async function createEnhancedContext(): Promise<BrowserContext> {
  const browser = await chromium.launch({
    headless: true,
    args: [
      "--headless=new",           // New headless mode (more compatible)
      "--disable-gpu",
      "--no-sandbox",
      "--disable-dev-shm-usage",  // Prevent /dev/shm issues in Docker
    ],
  });

  const context = await browser.newContext({
    viewport: { width: 1024, height: 768 },
    userAgent: "Mozilla/5.0 (X11; Linux x86_64) ...",
    locale: "en-US",
    timezoneId: "America/New_York",
    // Network interception
    ignoreHTTPSErrors: true,
  });

  // Intercept and log all requests
  context.on("request", (request) => {
    logger.debug({ url: request.url(), method: request.method() }, "Request");
  });

  // Handle downloads
  context.on("download", async (download) => {
    await download.saveAs(`/tmp/downloads/${download.suggestedFilename()}`);
  });

  return context;
}
```

---

## 6. Browser Extensions — On-the-Fly Installation

### How Playwright Loads Extensions

Playwright supports Chrome extensions **only in Chromium** using a **persistent context**:

```typescript
import { chromium } from "playwright";

const pathToExtension = "/path/to/unpacked/extension";

const context = await chromium.launchPersistentContext("/tmp/user-data-dir", {
  channel: "chromium",
  headless: true,
  args: [
    `--disable-extensions-except=${pathToExtension}`,
    `--load-extension=${pathToExtension}`,
  ],
});
```

### Key Constraints

| Constraint | Detail |
|-----------|--------|
| **Persistent context required** | Cannot use default `browser.newContext()` — must use `launchPersistentContext` |
| **Chromium channel only** | Must use Playwright's bundled Chromium (not system Chrome/Edge) |
| **Manifest v3 only** | Manifest v2 extensions are no longer supported |
| **Unpacked directory** | Extensions must be unpacked (not `.crx` files directly) — extract first |
| **No incognito** | Extensions don't work in incognito mode with persistent context |

### Strategy for Fusio Workers

#### Option A: Pre-bundle Extensions in Docker Image

Best for a **fixed set** of commonly-needed extensions (ad blocker, cookie handler, etc.):

```dockerfile
# In fusio-browser Dockerfile
FROM mcr.microsoft.com/playwright:v1.42.0-jammy

# Pre-install extensions
COPY extensions/ublock-origin /opt/extensions/ublock-origin
COPY extensions/cookie-consent /opt/extensions/cookie-consent

ENV EXTENSION_DIR=/opt/extensions
```

```typescript
// Worker code — load pre-bundled extensions based on job manifest
function getExtensionArgs(requiredExtensions: string[]): string[] {
  const extensionPaths = requiredExtensions
    .map((ext) => `/opt/extensions/${ext}`)
    .filter((p) => fs.existsSync(p));

  if (extensionPaths.length === 0) return [];

  return [
    `--disable-extensions-except=${extensionPaths.join(",")}`,
    `--load-extension=${extensionPaths.join(",")}`,
  ];
}
```

#### Option B: Download & Install at Job Start (On-the-Fly)

Best for **dynamic extension requirements** specified per job:

```typescript
import { chromium } from "playwright";
import { execSync } from "child_process";
import * as fs from "fs";
import * as path from "path";

interface ExtensionSpec {
  /** Chrome Web Store extension ID */
  id: string;
  /** Human-readable name */
  name: string;
  /** Optional: direct URL to CRX file */
  crxUrl?: string;
}

async function downloadAndUnpackExtension(
  spec: ExtensionSpec,
): Promise<string> {
  const extensionDir = `/tmp/extensions/${spec.id}`;

  if (fs.existsSync(extensionDir)) {
    return extensionDir; // Already downloaded
  }

  fs.mkdirSync(extensionDir, { recursive: true });

  // Download CRX from Chrome Web Store or direct URL
  const crxPath = `/tmp/extensions/${spec.id}.crx`;
  const downloadUrl =
    spec.crxUrl ||
    `https://clients2.google.com/service/update2/crx?response=redirect&prodversion=120.0&acceptformat=crx2,crx3&x=id%3D${spec.id}%26uc`;

  execSync(`curl -L -o "${crxPath}" "${downloadUrl}"`);

  // Unpack CRX (it's a ZIP with a header)
  // CRX3 format: magic(4) + version(4) + header_length(4) + header + zip_data
  execSync(`unzip -o -d "${extensionDir}" "${crxPath}" 2>/dev/null || true`);

  // Clean up CRX
  fs.unlinkSync(crxPath);

  return extensionDir;
}

async function launchWithExtensions(
  extensions: ExtensionSpec[],
): Promise<ReturnType<typeof chromium.launchPersistentContext>> {
  // Download all extensions in parallel
  const extensionPaths = await Promise.all(
    extensions.map(downloadAndUnpackExtension),
  );

  const context = await chromium.launchPersistentContext(
    "/tmp/browser-profile",
    {
      channel: "chromium",
      headless: true,
      args: [
        `--disable-extensions-except=${extensionPaths.join(",")}`,
        `--load-extension=${extensionPaths.join(",")}`,
        "--no-sandbox",
        "--disable-dev-shm-usage",
      ],
    },
  );

  // Wait for extensions to initialize
  await new Promise((resolve) => setTimeout(resolve, 2000));

  return context;
}
```

#### Option C: Mount Extensions via Docker Volume

For maximum flexibility, mount extensions from the host:

```typescript
// In container.ts — when starting the Docker container
async function startContainerWithExtensions(
  jobId: string,
  extensions: string[], // paths on host
): Promise<Docker.Container> {
  const container = await docker.createContainer({
    Image: "fusio-browser:latest",
    HostConfig: {
      Binds: extensions.map(
        (ext, i) => `${ext}:/opt/extensions/ext-${i}:ro`,
      ),
      // ... other config
    },
  });

  return container;
}
```

### Interacting with Extension UIs

Once loaded, you can access extension popups and pages:

```typescript
// Get the extension's background service worker
const workers = context.serviceWorkers();
const extensionWorker = workers.find((w) =>
  w.url().startsWith("chrome-extension://"),
);

// Or open the extension's popup page directly
const extensionId = "abc123def456"; // from extension manifest
const popupPage = await context.newPage();
await popupPage.goto(`chrome-extension://${extensionId}/popup.html`);
```

### Integration with Job Manifest

Add extension requirements to the Fusio protocol:

```typescript
// In protocol-types — extend JobManifest
interface JobManifest {
  // ... existing fields
  extensions?: {
    /** Chrome Web Store extension ID */
    id: string;
    /** Required for security — verify extension hash */
    sha256?: string;
    /** Configuration to apply after loading */
    config?: Record<string, unknown>;
  }[];
}
```

---

## 7. Quality Impact Assessment

### Current vs. CUA-Enhanced Comparison

| Capability | Current (Playwright Only) | With CUA Integration | Improvement |
|-----------|--------------------------|---------------------|-------------|
| **Visual understanding** | None — screenshots ignored | Full LLM vision analysis | Transformative |
| **Error recovery** | None — job fails on first error | Adaptive retry with visual feedback | High |
| **Dynamic content** | Fragile CSS/XPath selectors | Visual + DOM hybrid targeting | High |
| **Complex workflows** | Requires explicit step-by-step scripting | Natural language goal → autonomous execution | Transformative |
| **CAPTCHA handling** | Impossible | Can attempt visual CAPTCHAs (with limitations) | Medium |
| **Popup/modal handling** | Must be pre-scripted | Detected and dismissed automatically | High |
| **Form filling** | Field-by-field scripted | Understands form semantics, fills intelligently | High |
| **Navigation** | URL-based only | Can navigate by visual landmarks ("click the blue Login button") | High |
| **Multi-step reasoning** | None — linear action execution | Plans and adjusts strategy across steps | Transformative |
| **Success rate (estimated)** | ~40-60% on dynamic sites | ~80-90% on dynamic sites | ~2x improvement |

### Cost-Quality Tradeoff

| Approach | Cost per Step | Quality | Best For |
|----------|--------------|---------|----------|
| **Playwright only** (current) | ~$0 (compute only) | Low on dynamic sites | Simple, predictable pages |
| **CUA (Sonnet 4.6)** | ~$0.01-0.03/step | High | Most tasks — good balance |
| **CUA (Opus 4.6)** | ~$0.03-0.10/step | Highest | Complex reasoning tasks |
| **Hybrid** (Playwright + CUA fallback) | ~$0.005-0.02/step | High | Cost-optimized production |

### When CUA Adds the Most Value

1. **Unknown/changing layouts** — Sites you don't control, that redesign frequently
2. **Multi-step workflows** — Login → search → filter → extract → download
3. **Error recovery scenarios** — Rate limits, temporary failures, unexpected states
4. **Natural language tasks** — "Find the cheapest flight from NYC to LA next Tuesday"
5. **Visual verification** — Confirming a form was submitted, a payment processed, etc.

### When Playwright Alone is Sufficient

1. **Known, stable pages** — Internal tools, APIs with consistent DOM
2. **Simple data extraction** — Single-page scraping with stable selectors
3. **High-volume, low-complexity** — Thousands of identical page visits
4. **Cost-sensitive workloads** — Where $0.01/step matters at scale

---

## 8. Recommended Integration Architecture

### Hybrid Approach: Playwright for Execution, CUA for Perception

The optimal architecture uses **Playwright as the execution layer** (fast, reliable, full browser control) and **CUA as the perception/planning layer** (visual understanding, reasoning, decision-making):

```
┌──────────────────────────────────────────────────────────────────┐
│                        FUSIO WORKER NODE                         │
│                                                                  │
│  ┌─────────────┐    ┌──────────────┐    ┌───────────────────┐   │
│  │  Job Runner  │───▶│  CUA Bridge  │───▶│  Claude/GPT API   │   │
│  │  (runner.ts) │    │  (new file)  │    │  (external call)  │   │
│  └──────┬───────┘    └──────┬───────┘    └───────────────────┘   │
│         │                   │                                     │
│         ▼                   ▼                                     │
│  ┌──────────────────────────────────┐                            │
│  │       Playwright Bridge          │                            │
│  │  (browser/playwright.ts)         │                            │
│  │  - Execute click/type/scroll     │                            │
│  │  - Capture screenshots           │                            │
│  │  - DOM queries as fallback       │                            │
│  └──────────────┬───────────────────┘                            │
│                 │                                                  │
│                 ▼                                                  │
│  ┌──────────────────────────────────┐                            │
│  │    Docker Container (Chromium)    │                            │
│  │    + Extensions (if needed)       │                            │
│  └──────────────────────────────────┘                            │
└──────────────────────────────────────────────────────────────────┘
```

### Implementation: CUA Bridge Module

A new module that sits between the job runner and the Playwright execution layer:

```typescript
// services/worker-node/src/browser/cua-bridge.ts

import Anthropic from "@anthropic-ai/sdk";
import type { Page } from "playwright";
import { executeAction, captureScreenshot } from "./actions";

interface CuaBridgeConfig {
  provider: "anthropic" | "openai";
  model: string;
  maxSteps: number;
  displayWidth: number;
  displayHeight: number;
}

const DEFAULT_CONFIG: CuaBridgeConfig = {
  provider: "anthropic",
  model: "claude-sonnet-4-6",
  maxSteps: 200,
  displayWidth: 1024,
  displayHeight: 768,
};

export async function executeCuaJob(
  page: Page,
  goal: string,
  config: Partial<CuaBridgeConfig> = {},
): Promise<{ success: boolean; steps: number; finalScreenshot: string }> {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  const client = new Anthropic();

  // Take initial screenshot
  let screenshot = await captureScreenshot(page);

  const messages: Anthropic.Messages.MessageParam[] = [
    {
      role: "user",
      content: [
        { type: "text", text: goal },
        {
          type: "image",
          source: {
            type: "base64",
            media_type: "image/png",
            data: screenshot,
          },
        },
      ],
    },
  ];

  for (let step = 0; step < cfg.maxSteps; step++) {
    const response = await client.beta.messages.create({
      model: cfg.model,
      max_tokens: 4096,
      tools: [
        {
          type: "computer_20251124",
          name: "computer",
          display_width_px: cfg.displayWidth,
          display_height_px: cfg.displayHeight,
          display_number: 1,
        },
      ],
      messages,
      betas: ["computer-use-2025-11-24"],
    });

    if (response.stop_reason === "end_turn") {
      return { success: true, steps: step, finalScreenshot: screenshot };
    }

    messages.push({ role: "assistant", content: response.content });
    const toolResults: Anthropic.Messages.ToolResultBlockParam[] = [];

    for (const block of response.content) {
      if (block.type !== "tool_use") continue;

      const input = block.input as any;

      // Translate CUA action → Playwright action
      screenshot = await translateAndExecute(page, input);

      toolResults.push({
        type: "tool_result",
        tool_use_id: block.id,
        content: [
          {
            type: "image",
            source: {
              type: "base64",
              media_type: "image/png",
              data: screenshot,
            },
          },
        ],
      });
    }

    messages.push({ role: "user", content: toolResults });
  }

  return {
    success: false,
    steps: cfg.maxSteps,
    finalScreenshot: screenshot,
  };
}

/** Translate CUA actions to Playwright commands */
async function translateAndExecute(
  page: Page,
  action: any,
): Promise<string> {
  switch (action.action) {
    case "left_click":
    case "click":
      await page.mouse.click(action.coordinate[0], action.coordinate[1]);
      break;
    case "right_click":
      await page.mouse.click(action.coordinate[0], action.coordinate[1], {
        button: "right",
      });
      break;
    case "double_click":
      await page.mouse.dblclick(action.coordinate[0], action.coordinate[1]);
      break;
    case "type":
      await page.keyboard.type(action.text);
      break;
    case "key":
      await page.keyboard.press(action.key);
      break;
    case "scroll":
      await page.mouse.wheel(
        action.coordinate?.[0] ?? 0,
        action.scroll_direction === "down"
          ? action.scroll_amount * 100
          : -action.scroll_amount * 100,
      );
      break;
    case "mouse_move":
      await page.mouse.move(action.coordinate[0], action.coordinate[1]);
      break;
    case "wait":
      await page.waitForTimeout(action.duration ?? 1000);
      break;
    case "screenshot":
      // No action needed, just capture below
      break;
    case "triple_click":
      await page.mouse.click(action.coordinate[0], action.coordinate[1], {
        clickCount: 3,
      });
      break;
    default:
      console.warn(`Unknown CUA action: ${action.action}`);
  }

  // Always return a fresh screenshot after action
  const buffer = await page.screenshot({ type: "png" });
  return buffer.toString("base64");
}
```

### Modification Points in Existing Code

| File | Change |
|------|--------|
| `services/worker-node/src/runner.ts` | Add CUA mode: if job manifest specifies `executionMode: "cua"`, route to `cua-bridge.ts` instead of manual action loop |
| `services/worker-node/src/browser/container.ts` | Add extension mounting support — accept extension paths in container config |
| `services/worker-node/src/browser/playwright.ts` | Switch to `launchPersistentContext` when extensions are required |
| `packages/protocol-types/` | Extend `JobManifest` with `executionMode`, `cuaProvider`, and `extensions` fields |
| `services/worker-node/package.json` | Add `@anthropic-ai/sdk` and/or `openai` as dependencies |

### Cost Control

```typescript
// In cua-bridge.ts — add cost tracking
interface StepCost {
  inputTokens: number;
  outputTokens: number;
  estimatedUsd: number;
}

function calculateStepCost(response: Anthropic.Messages.Message): StepCost {
  const inputTokens = response.usage.input_tokens;
  const outputTokens = response.usage.output_tokens;

  // Sonnet 4.6 pricing (adjust as needed)
  const inputCostPer1M = 3.0;
  const outputCostPer1M = 15.0;

  return {
    inputTokens,
    outputTokens,
    estimatedUsd:
      (inputTokens / 1_000_000) * inputCostPer1M +
      (outputTokens / 1_000_000) * outputCostPer1M,
  };
}
```

---

## 9. References

### Anthropic Computer Use

- **Documentation**: https://platform.claude.com/docs/en/agents-and-tools/tool-use/computer-use-tool
- **Reference Implementation**: https://github.com/anthropics/anthropic-quickstarts/tree/main/computer-use-demo
- **Beta Headers**: `computer-use-2025-11-24` (Opus 4.6 / Sonnet 4.6) or `computer-use-2025-01-24` (older models)
- **SDK**: `@anthropic-ai/sdk` (npm)

### OpenAI Computer Use

- **Documentation**: https://developers.openai.com/api/docs/guides/tools-computer-use
- **Model**: `gpt-5.4`
- **SDK**: `openai` (npm)

### Playwright

- **Chrome Extensions Guide**: https://playwright.dev/docs/chrome-extensions
- **Browser Contexts**: https://playwright.dev/docs/browser-contexts
- **Docker Guide**: https://playwright.dev/docs/docker

### Fusio Protocol (Internal)

- **Worker Node**: `services/worker-node/src/`
- **Browser Actions**: `services/worker-node/src/browser/actions.ts`
- **Playwright Connection**: `services/worker-node/src/browser/playwright.ts`
- **Container Management**: `services/worker-node/src/browser/container.ts`
- **Protocol Types**: `packages/protocol-types/`
