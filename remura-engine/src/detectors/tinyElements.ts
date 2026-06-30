import type { RawFinding } from '../types.js';
import { walkElements, elementAttributes, selectorPath } from '../utils/domWalker.js';

/**
 * Detects elements with inline width/height of 1px or less (used to hide text from humans).
 *
 * @param doc - The document to scan.
 * @returns Raw findings for each tiny element with text.
 */
export function detectTinyElements(doc: Document): RawFinding[] {
  const findings: RawFinding[] = [];

  for (const el of walkElements(doc)) {
    const style = (el as HTMLElement).style;
    if (!style) continue;

    const width = parseFloat(style.width);
    const height = parseFloat(style.height);

    // Only flag if both dimensions are explicitly set and tiny (<=1px)
    const widthSet = style.width !== '' && !isNaN(width);
    const heightSet = style.height !== '' && !isNaN(height);

    if (!widthSet || !heightSet) continue;
    if (width > 1 || height > 1) continue;

    const text = el.textContent?.trim() ?? '';
    if (!text) continue;

    findings.push({
      type: 'tiny-element',
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
