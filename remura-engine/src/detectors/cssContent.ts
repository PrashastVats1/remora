import type { RawFinding } from '../types.js';

const DEFAULT_MIN_LENGTH = 20;

/**
 * Strips CSS string quotes from a content value.
 */
function stripQuotes(value: string): string {
  return value.replace(/^["']|["']$/g, '');
}

/**
 * Detects CSS ::before / ::after pseudo-element content properties that contain
 * unusually long text, which may be injecting instructions invisible in the UI.
 *
 * Short content values (decorative icons, checkmarks, bullets) are ignored
 * based on minCssContentLength.
 *
 * @param doc - The document to scan.
 * @param minCssContentLength - Minimum length to flag (default 20).
 * @returns Raw findings for each suspicious CSS content rule.
 */
export function detectCssContent(
  doc: Document,
  minCssContentLength = DEFAULT_MIN_LENGTH
): RawFinding[] {
  const findings: RawFinding[] = [];

  let sheets: StyleSheetList;
  try {
    sheets = doc.styleSheets;
  } catch {
    return findings;
  }

  for (let i = 0; i < sheets.length; i++) {
    let rules: CSSRuleList;
    try {
      rules = sheets[i].cssRules;
    } catch {
      // Cross-origin stylesheet — skip
      continue;
    }
    if (!rules) continue;

    for (let j = 0; j < rules.length; j++) {
      const rule = rules[j];
      if (!(rule instanceof CSSStyleRule)) continue;

      const selector = rule.selectorText ?? '';
      if (!selector.includes('::before') && !selector.includes('::after') &&
          !selector.includes(':before') && !selector.includes(':after')) {
        continue;
      }

      const content = rule.style.getPropertyValue('content');
      if (!content) continue;

      const text = stripQuotes(content.trim());
      if (text.length < minCssContentLength) continue;
      // Skip 'none' and 'normal'
      if (text === 'none' || text === 'normal') continue;

      findings.push({
        type: 'css-content',
        matchedText: text,
        selector,
        location: {
          tagName: 'style',
          attributes: { selector },
        },
      });
    }
  }

  return findings;
}
