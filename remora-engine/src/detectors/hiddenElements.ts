import type { RawFinding } from '../types.js';
import { walkElements, elementAttributes, selectorPath } from '../utils/domWalker.js';

/**
 * Detects elements hidden via inline CSS (display:none, visibility:hidden, opacity:0).
 * Only flags elements that contain non-trivial text content.
 *
 * @param doc - The document to scan.
 * @returns Raw findings for each hidden element with text.
 */
export function detectHiddenElements(doc: Document): RawFinding[] {
  const findings: RawFinding[] = [];

  for (const el of walkElements(doc)) {
    const style = (el as HTMLElement).style;
    if (!style) continue;

    let hideReason: string | null = null;
    if (style.display === 'none') hideReason = 'display:none';
    else if (style.visibility === 'hidden') hideReason = 'visibility:hidden';
    else {
      const opacity = parseFloat(style.opacity ?? '');
      if (!isNaN(opacity) && opacity === 0) hideReason = 'opacity:0';
    }

    if (!hideReason) continue;

    const text = el.textContent?.trim() ?? '';
    if (text.length < 20) continue;

    findings.push({
      type: 'hidden-element',
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
