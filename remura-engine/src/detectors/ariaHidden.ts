import type { RawFinding } from '../types.js';
import { walkElements, elementAttributes, selectorPath } from '../utils/domWalker.js';

/**
 * Detects elements with aria-hidden="true" that contain non-trivial text content.
 * Screen readers and assistive tech skip these, but AI agents may still read the DOM.
 *
 * @param doc - The document to scan.
 * @returns Raw findings for each aria-hidden element with text.
 */
export function detectAriaHidden(doc: Document): RawFinding[] {
  const findings: RawFinding[] = [];

  for (const el of walkElements(doc)) {
    if (el.getAttribute('aria-hidden') !== 'true') continue;

    const text = el.textContent?.trim() ?? '';
    if (text.length < 20) continue;

    findings.push({
      type: 'aria-hidden',
      matchedText: text,
      selector: selectorPath(el),
      location: {
        tagName: el.tagName.toLowerCase(),
        attributes: elementAttributes(el),
      },
    });
  }

  return findings;
}
