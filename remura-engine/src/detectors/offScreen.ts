import type { RawFinding } from '../types.js';
import { walkElements, elementAttributes, selectorPath } from '../utils/domWalker.js';

const OFF_SCREEN_THRESHOLD = -999;

/**
 * Parses a CSS length value string and returns the numeric pixel value,
 * or null if it cannot be parsed.
 */
function parsePx(value: string): number | null {
  const n = parseFloat(value);
  return isNaN(n) ? null : n;
}

/**
 * Detects elements positioned far off-screen via position:absolute/fixed combined
 * with large negative left/top/right/bottom values (< -999px).
 *
 * @param doc - The document to scan.
 * @returns Raw findings for each off-screen element with text.
 */
export function detectOffScreen(doc: Document): RawFinding[] {
  const findings: RawFinding[] = [];

  for (const el of walkElements(doc)) {
    const style = (el as HTMLElement).style;
    if (!style) continue;

    const position = style.position;
    if (position !== 'absolute' && position !== 'fixed') continue;

    const left = parsePx(style.left);
    const top = parsePx(style.top);
    const right = parsePx(style.right);
    const bottom = parsePx(style.bottom);

    const isOffScreen =
      (left !== null && left < OFF_SCREEN_THRESHOLD) ||
      (top !== null && top < OFF_SCREEN_THRESHOLD) ||
      (right !== null && right < OFF_SCREEN_THRESHOLD) ||
      (bottom !== null && bottom < OFF_SCREEN_THRESHOLD);

    if (!isOffScreen) continue;

    const text = el.textContent?.trim() ?? '';
    if (!text) continue;

    findings.push({
      type: 'off-screen',
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
