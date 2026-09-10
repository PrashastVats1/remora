# remora-engine

DOM-based prompt injection detection engine for AI agent security. It scans a `Document` object for text that has been deliberately hidden from human readers but remains visible to AI agents reading the page. This is the same engine powering the [Remora Chrome extension](https://remora.watch) — published separately so developers can integrate it directly into agent pipelines, MCP servers, and headless browser workflows.

The package has **no runtime dependencies**. You provide the `Document`; the engine does the rest.

---

## Installation

```bash
npm install remora-engine
```

---

## Quick Start

The most common server-side usage — scan HTML with jsdom:

```typescript
import { JSDOM } from 'jsdom'
import { scanDocument } from 'remora-engine'

const dom = new JSDOM(htmlString, { url: 'https://example.com' })
const result = scanDocument({
  document: dom.window.document,
  url: 'https://example.com',
})

if (result.injections.length > 0) {
  console.log(`Found ${result.injections.length} injection attempts`)
  console.log(result.injections)
}
```

jsdom is a peer dependency — install it separately:

```bash
npm install jsdom
npm install --save-dev @types/jsdom  # if using TypeScript
```

---

## With Playwright

Use Playwright to fetch a fully-rendered page, then pass the HTML to jsdom for scanning:

```typescript
import { chromium } from 'playwright'
import { JSDOM } from 'jsdom'
import { scanDocument } from 'remora-engine'

const browser = await chromium.launch()
const page = await browser.newPage()
await page.goto('https://example.com')

const html = await page.content()
const dom = new JSDOM(html, { url: 'https://example.com' })
const result = scanDocument({
  document: dom.window.document,
  url: 'https://example.com',
})

await browser.close()

if (result.injections.some(i => i.severity === 'high')) {
  console.warn('High-severity prompt injection detected — aborting.')
}
```

> **Note:** The `color-match` detector requires `window.getComputedStyle()` to return real computed colour values. In a live browser (extension or Playwright `evaluate` context) it works fully. In a jsdom context, only elements using inline `style` attributes will be checked — CSS class-based colour hiding will not be caught.

---

## With MCP Servers

Call `scanDocument` inside your MCP tool handler before processing any web content. If a high-severity injection is found, throw or return an error rather than forwarding the content to the model.

```typescript
import { scanDocument } from 'remora-engine'
import { JSDOM } from 'jsdom'

async function safeFetch(url: string): Promise<string> {
  const response = await fetch(url)
  const html = await response.text()
  const dom = new JSDOM(html, { url })
  const result = scanDocument({ document: dom.window.document, url })

  if (result.injections.some(i => i.severity === 'high')) {
    throw new Error(`Prompt injection detected on ${url}`)
  }

  // result.extractedText is the clean, structured page content —
  // what the AI agent would actually read.
  return result.extractedText
}
```

---

## In a Chrome Extension

The Remora Chrome extension uses this engine directly on the live page DOM inside a content script — no jsdom needed:

```typescript
import { scanDocument } from 'remora-engine'

// In a Manifest V3 content script, `document` is the live page DOM.
const result = scanDocument({ document, url: location.href })
chrome.runtime.sendMessage({ type: 'SCAN_RESULT', result })
```

The package has no dependency on `window`, `chrome.*`, or any browser-specific API — it only reads the `Document` object you pass in, so it is safe to bundle into an isolated content script.

---

## ScanResult shape

```typescript
interface ScanResult {
  /** The URL passed to scanDocument(), if provided. */
  url?: string

  /** ISO 8601 timestamp of when the scan ran. */
  timestamp: string

  /** All detected injections, each with type, severity, and location. */
  injections: Injection[]

  /**
   * Structured "AI agent view" of the page — what a text-based model
   * would actually read. Flagged injection elements are excluded.
   */
  extractedText: string

  summary: {
    /** Total number of injections found. */
    total: number
    /** Breakdown by severity. */
    bySeverity: Record<'low' | 'medium' | 'high', number>
    /** Breakdown by detector type. */
    byType: Record<InjectionType, number>
  }
}

interface Injection {
  /** Unique id within this scan result. */
  id: string
  /** Which detector found this. */
  type: InjectionType
  /** Severity assigned by cross-referencing injection phrase patterns. */
  severity: 'low' | 'medium' | 'high'
  /** The suspicious text extracted from the element or node. */
  matchedText: string
  /** The injection phrase regex that matched, if any. */
  matchedPattern?: string
  /** CSS selector path to the element (useful for highlighting). */
  selector?: string
  location: {
    tagName?: string
    attributes?: Record<string, string>
  }
}

type InjectionType =
  | 'hidden-element'
  | 'off-screen'
  | 'tiny-element'
  | 'color-match'
  | 'aria-hidden'
  | 'html-comment'
  | 'meta-tag'
  | 'css-content'
```

---

## What it detects

| Detector | Technique caught |
|---|---|
| `hidden-element` | Inline `display:none`, `visibility:hidden`, or `opacity:0` |
| `off-screen` | `position:absolute/fixed` with large negative `left`/`top` values (< −999 px) |
| `tiny-element` | `font-size: 0` or near-zero (text invisible to human eye) |
| `color-match` | Text colour matching (or nearly matching) background colour — invisible text |
| `aria-hidden` | `aria-hidden="true"` elements with suspicious text content |
| `html-comment` | `<!-- HTML comments -->` containing injection phrases |
| `meta-tag` | `<meta>` tag content containing injection phrases |
| `css-content` | CSS `::before`/`::after` `content:` rules ≥ 20 characters |

---

## What it does NOT detect

- **Semantic / paraphrased injections** — detection is regex-based; a rephrased instruction that avoids known patterns will not be caught. An LLM-based reasoning layer is on the roadmap.
- **Injections inside images or PDFs** — there is no OCR; only text nodes and attributes in the DOM are scanned.
- **Injections in API JSON responses** — the engine operates on a `Document` object. Raw JSON or API payloads are not supported.
- **Runtime injections added after page load** — `scanDocument` scans the DOM at call time. Content injected by JavaScript after that point is not captured; call it after the page has settled if timing matters.
- **CSS class-based colour hiding in jsdom** — the `color-match` detector needs `getComputedStyle()` to resolve CSS class rules; jsdom does not implement this fully. Inline style attributes are checked.

---

## False positive design

Every finding goes through two gates. First, a structural detector must flag the element (hidden, off-screen, tiny, etc.). Second, the element's text must also match at least one known injection phrase pattern (regex). If neither gate triggers, the element is silently skipped.

This two-gate design exists because real websites use every one of these hiding techniques for legitimate purposes: Google hides dropdown menus with `display:none`, icon fonts use zero-width characters, screen-reader-only text uses `aria-hidden`, and CSS `::before` is used everywhere for decorative content. Flagging structure alone would produce constant false positives on normal sites. The phrase match is what makes the detection precise.

---

## Contributing / Reporting false positives

Open an issue at [github.com/PrashastVats1/remora/issues](https://github.com/PrashastVats1/remora/issues).

When reporting a false positive, include the URL and the matched text shown in the finding. When reporting a missed injection, include the HTML snippet and the phrase used.

---

## License

MIT — see [LICENSE](./LICENSE).
