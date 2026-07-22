import type { RawFinding } from '../types.js';

/**
 * Detects HTML comment nodes that contain non-trivial text.
 * AI agents that read raw HTML or walk the DOM may process comment nodes.
 *
 * @param doc - The document to scan.
 * @returns Raw findings for each comment node with meaningful text.
 */
export function detectHtmlComments(doc: Document): RawFinding[] {
  const findings: RawFinding[] = [];
  const iterator = doc.createNodeIterator(
    doc.documentElement ?? doc,
    NodeFilter.SHOW_COMMENT
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
