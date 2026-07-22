import type { RawFinding } from '../types.js';
import { walkElements, elementAttributes, selectorPath } from '../utils/domWalker.js';

/**
 * Parses an rgb(r,g,b) or rgba(r,g,b,a) string into [r,g,b] components.
 * Returns null if the string is not parseable.
 */
function parseRgb(color: string): [number, number, number] | null {
  const m = color.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
  if (!m) return null;
  return [parseInt(m[1]), parseInt(m[2]), parseInt(m[3])];
}

/**
 * Walks up the ancestor chain to find the first element with a non-transparent
 * background color, returning its computed background-color string.
 */
function resolveBackground(el: Element, getStyle: (e: Element) => CSSStyleDeclaration): string {
  let current: Element | null = el;
  while (current) {
    const bg = getStyle(current).backgroundColor;
    if (bg && bg !== 'transparent' && bg !== 'rgba(0, 0, 0, 0)') return bg;
    current = current.parentElement;
  }
  return 'rgb(255, 255, 255)'; // default white
}

/**
 * Detects elements where text color matches (or nearly matches) background color,
 * making text invisible to humans but readable by AI agents.
 *
 * NOTE: This detector requires a live browser environment where getComputedStyle()
 * returns meaningful values. In jsdom it will produce no findings.
 *
 * @param doc - The document to scan.
 * @param getStyle - Callable that returns computed style for an element.
 * @returns Raw findings for each color-matched element with text.
 */
export function detectColorMatch(
  doc: Document,
  getStyle: (el: Element) => CSSStyleDeclaration
): RawFinding[] {
  const findings: RawFinding[] = [];

  for (const el of walkElements(doc)) {
    const text = el.textContent?.trim() ?? '';
    // Short text (button labels, UI tags) is never an injection — require a real phrase
    if (text.length < 20) continue;

    // Only leaf-ish elements to avoid double counting
    if (el.children.length > 3) continue;

    const computed = getStyle(el);
    const fgStr = computed.color;
    const bgStr = resolveBackground(el, getStyle);

    const fg = parseRgb(fgStr);
    const bg = parseRgb(bgStr);
    if (!fg || !bg) continue;

    // Euclidean distance in RGB space — near zero means invisible
    const dist = Math.sqrt(
      Math.pow(fg[0] - bg[0], 2) +
      Math.pow(fg[1] - bg[1], 2) +
      Math.pow(fg[2] - bg[2], 2)
    );

    if (dist > 10) continue;

    findings.push({
      type: 'color-match',
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
