import { walkElements, selectorPath } from './domWalker.js';

/** Tags whose text content is skipped during extraction (non-content). */
const SKIP_TAGS = new Set([
  'SCRIPT', 'STYLE', 'NOSCRIPT', 'HEAD', 'TEMPLATE', 'SVG', 'MATH',
]);

/** Tags treated as block-level separators. */
const BLOCK_TAGS = new Set([
  'P', 'DIV', 'SECTION', 'ARTICLE', 'ASIDE', 'MAIN', 'HEADER', 'FOOTER',
  'NAV', 'LI', 'DT', 'DD', 'BLOCKQUOTE', 'PRE', 'TR', 'TD', 'TH',
  'FIGURE', 'FIGCAPTION', 'DETAILS', 'SUMMARY',
]);

/** Heading tags mapped to their markdown prefix. */
const HEADING_TAGS: Record<string, string> = {
  H1: '# ', H2: '## ', H3: '### ', H4: '#### ', H5: '##### ', H6: '###### ',
};

/**
 * Determines if an element should be considered hidden / injection candidate
 * rather than normal readable content.
 * Returns the hide reason string or null if the element is visible.
 */
export function hiddenKind(el: Element): string | null {
  const style = (el as HTMLElement).style;
  if (!style) return null;

  if (style.display === 'none') return 'display:none';
  if (style.visibility === 'hidden') return 'visibility:hidden';

  const opacity = parseFloat(style.opacity ?? '');
  if (!isNaN(opacity) && opacity === 0) return 'opacity:0';

  return null;
}

/**
 * Extracts the "AI agent view" of a page — what a text-based AI would read —
 * as structured markdown-like text. Hidden elements are excluded because
 * the scanner flags them separately as injection candidates before this runs.
 *
 * @param doc - The document to extract text from.
 * @param injectedSelectors - Set of selectors for already-flagged injections to skip.
 * @returns Structured plain-text representation of the page.
 */
export function extractPageText(doc: Document, injectedSelectors: Set<string>): string {
  const lines: string[] = [];
  const textCaptured = new WeakSet<Element>();

  for (const el of walkElements(doc)) {
    if (SKIP_TAGS.has(el.tagName)) continue;
    if (textCaptured.has(el)) continue;

    // Skip already-flagged injection elements
    const sel = selectorPath(el);
    if (injectedSelectors.has(sel)) {
      textCaptured.add(el);
      continue;
    }

    // Skip inline-style hidden elements (they're flagged as injections)
    if (hiddenKind(el)) {
      textCaptured.add(el);
      continue;
    }

    // Skip aria-hidden elements (also flagged separately)
    if (el.getAttribute('aria-hidden') === 'true') {
      textCaptured.add(el);
      continue;
    }

    const headingPrefix = HEADING_TAGS[el.tagName];
    if (headingPrefix !== undefined) {
      // Clone, strip aria-hidden children, get clean heading text
      const clone = el.cloneNode(true) as Element;
      clone.querySelectorAll('[aria-hidden="true"]').forEach(c => c.remove());
      const text = clone.textContent?.trim() ?? '';
      if (text) lines.push(headingPrefix + text);
      textCaptured.add(el);
      continue;
    }

    if (BLOCK_TAGS.has(el.tagName)) {
      // Only emit if this block has direct text nodes (avoid double-counting children)
      const directText = Array.from(el.childNodes)
        .filter(n => n.nodeType === 3) // TEXT_NODE
        .map(n => n.textContent?.trim() ?? '')
        .join(' ')
        .trim();
      if (directText) lines.push(directText);
      continue;
    }
  }

  return lines.filter(Boolean).join('\n');
}
