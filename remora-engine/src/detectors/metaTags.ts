import type { RawFinding } from '../types.js';
import { elementAttributes, selectorPath } from '../utils/domWalker.js';

/** Standard meta tag names that should never be flagged. */
const ALLOWLISTED_META_NAMES = new Set([
  // Core HTML meta names
  'viewport', 'charset', 'description', 'robots', 'googlebot', 'referrer',
  'theme-color', 'color-scheme', 'application-name', 'generator', 'author',
  'keywords', 'rating', 'revisit-after', 'format-detection',
  // Microsoft
  'msapplication-tilecolor', 'msapplication-config', 'msapplication-tileimage',
  'msapplication-tooltip', 'msapplication-starturl', 'msapplication-tap-highlight',
  // Apple
  'apple-mobile-web-app-capable', 'apple-mobile-web-app-status-bar-style',
  'apple-mobile-web-app-title', 'apple-itunes-app',
  // Google / site ownership
  'google-site-verification', 'google', 'google-adsense-account',
  'google-analytics',
  // Common site metadata
  'csrf-token', 'csrf-param', 'mobile-web-app-capable',
  'handheld-friendly', 'mobileoptimized', 'x-ua-compatible',
  'copyright', 'language', 'category', 'classification', 'coverage',
  'distribution', 'publisher', 'resource-type', 'reply-to',
  'news_keywords', 'pagename', 'web_author',
]);

/** Standard meta name prefixes that should never be flagged. */
const ALLOWLISTED_PREFIXES = [
  'og:', 'twitter:', 'fb:', 'article:', 'book:', 'profile:', 'al:', 'dc:',
  'msapplication-', 'apple-',
];

function isAllowlisted(name: string): boolean {
  const lower = name.toLowerCase();
  if (ALLOWLISTED_META_NAMES.has(lower)) return true;
  return ALLOWLISTED_PREFIXES.some(p => lower.startsWith(p));
}

/**
 * Detects suspicious <meta> tags — those with non-standard names or content
 * that could be used to inject instructions into an AI agent's context.
 *
 * Standard meta tags (viewport, og:*, twitter:*, etc.) are allowlisted and
 * will never be flagged.
 *
 * @param doc - The document to scan.
 * @returns Raw findings for each suspicious meta tag.
 */
export function detectMetaTags(doc: Document): RawFinding[] {
  const findings: RawFinding[] = [];
  const metas = doc.querySelectorAll('meta[name][content]');

  for (const meta of metas) {
    const name = meta.getAttribute('name') ?? '';
    const content = meta.getAttribute('content') ?? '';

    if (!name || !content) continue;
    if (isAllowlisted(name)) continue;

    findings.push({
      type: 'meta-tag',
      matchedText: `${name}: ${content}`,
      selector: selectorPath(meta),
      location: {
        tagName: 'meta',
        attributes: elementAttributes(meta),
      },
    });
  }

  return findings;
}
