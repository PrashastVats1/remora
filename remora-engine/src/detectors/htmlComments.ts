import type { RawFinding } from '../types.js';

/**
 * Detects HTML comment nodes that contain non-trivial text.
 * AI agents that read raw HTML or walk the DOM may process comment nodes.
 *
 * @param doc - The document to scan.
 * @returns Raw findings for each comment node with meaningful text.
 */
const SHOW_COMMENT = 0x80; // NodeFilter.SHOW_COMMENT — avoids browser-global dependency

export function detectHtmlComments(doc: Document): RawFinding[] {
  const findings: RawFinding[] = [];
  const iterator = doc.createNodeIterator(
    doc.documentElement ?? doc,
    SHOW_COMMENT
  );

  let node: Node | null;
  while ((node = iterator.nextNode()) !== null) {
    const text = node.textContent?.trim() ?? '';
    if (!text) continue;

    findings.push({
      type: 'html-comment',
      matchedText: text,
      selector: undefined,
      location: {
        tagName: '#comment',
        attributes: {},
      },
    });
  }

  return findings;
}
