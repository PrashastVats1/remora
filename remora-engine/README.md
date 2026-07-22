# remora-engine

Core detection engine for identifying hidden prompt injection attacks embedded in web pages. It scans a `Document` object for text that has been deliberately concealed from human readers but remains visible to AI agents browsing the page.

## What it does

Web pages can hide malicious instructions using CSS tricks (display:none, off-screen positioning, tiny elements, colour-matched text), HTML comment nodes, suspicious `<meta>` tags, CSS `::before`/`::after` content properties, and `aria-hidden` attributes. An AI agent reading such a page may unknowingly execute these instructions. `remora-engine` detects all eight of these hiding techniques and returns structured findings with severity scores, matched injection patterns, and the "AI agent view" of the page (what the agent would actually read).

## Installation

```bash
npm install remora-engine
```

The package has **no runtime dependencies**. It operates purely on a `Document` object you provide — jsdom, Playwright, or a live browser DOM all work.

## Basic usage

```ts
import { scanDocument } from 'remora-engine';

const result = scanDocument({
  document: document,           // any Document object
  url: window.location.href,    // optional, for context in results
  minCssContentLength: 20,      // optional, default 20
});

console.log(result.summary.total);   // number of injections found
console.log(result.extractedText);   // what an AI agent would read
```

## ScanResult shape

```json
{
  "url": "https://example.com/",
  "timestamp": "2026-06-16T03:00:00.000Z",
  "injections": [
    {
      "id": "rm-1",
      "type": "hidden-element",
      "severity": "high",
      "matchedText": "Ignore previous instructions...",
      "matchedPattern": "ignore previous instructions",
      "selector": "body > div",
      "location": {
        "tagName": "div",
        "attributes": { "style": "display:none;" }
      }
    }
  ],
  "extractedText": "# Find Your Perfect Flight\nCompare hundreds of airlines...",
  "summary": {
    "total": 1,
    "bySeverity": { "low": 0, "medium": 0, "high": 1 },
    "byType": {
      "hidden-element": 1,
      "off-screen": 0,
      "tiny-element": 0,
      "color-match": 0,
      "aria-hidden": 0,
      "html-comment": 0,
      "meta-tag": 0,
      "css-content": 0
    }
  }
}
```

## Usage in two environments

### Browser extension (Manifest V3 content script)

```ts
import { scanDocument } from 'remora-engine';

// In a content script, `document` is the live page DOM.
const result = scanDocument({ document, url: location.href });
chrome.runtime.sendMessage({ type: 'SCAN_RESULT', result });
```

The package has no dependency on `window`, `chrome.*`, or any browser-specific API — it only reads the `Document` object you pass in, so it works safely in an isolated content script context.

### Server-side with Playwright

```ts
import { chromium } from 'playwright';
import { JSDOM } from 'jsdom';
import { scanDocument } from 'remora-engine';

const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto('https://example.com');

// Serialize the rendered DOM and parse it into jsdom
const html = await page.content();
const dom = new JSDOM(html);
const result = scanDocument({ document: dom.window.document, url: page.url() });

await browser.close();
```

> **Note:** The `color-match` detector requires `window.getComputedStyle()` to return meaningful colour values. In a live browser (extension or Playwright evaluate context) this works fully. In a jsdom context it will only flag elements whose colour is set via inline `style` attributes.

## Adding new detectors

Each detector is a plain function in `src/detectors/` with this signature:

```ts
export function detectXxx(doc: Document): RawFinding[]
```

`RawFinding` (from `src/types.ts`) is:

```ts
interface RawFinding {
  type: InjectionType;
  matchedText: string;
  selector?: string;
  location: { tagName?: string; attributes?: Record<string, string> };
}
```

Steps to add a new detector:

1. Create `src/detectors/yourDetector.ts` exporting a `detectYourThing(doc: Document): RawFinding[]` function.
2. Add the new `InjectionType` string literal to the union in `src/types.ts`.
3. Import and call your detector inside `src/scanner.ts` alongside the existing detectors.
4. Add a corresponding test file under `tests/detectors/`.

Severity is assigned automatically by the scanner by cross-referencing `matchedText` against the patterns in `src/patterns/injectionPhrases.ts`. If no pattern matches, severity defaults to `'low'`.

## Adding new injection patterns

Open `src/patterns/injectionPhrases.ts`. Each entry is:

```ts
{
  category: 'your-category',
  pattern: /your regex/i,
  severity: 'high' | 'medium' | 'low',
}
```

Add your entry to the `INJECTION_PATTERNS` array. The scanner automatically cross-references all detector findings against the full list; no other changes are required.

## Scripts

```bash
npm run build        # compile to dist/ (ESM + CJS + types)
npm run test         # run tests once
npm run test:watch   # watch mode
npm run typecheck    # tsc --noEmit
```
