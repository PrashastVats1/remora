import type { ScanOptions, ScanResult, Injection, InjectionType, Severity, RawFinding } from './types.js';
import { detectHiddenElements } from './detectors/hiddenElements.js';
import { detectOffScreen } from './detectors/offScreen.js';
import { detectTinyElements } from './detectors/tinyElements.js';
import { detectColorMatch } from './detectors/colorMatch.js';
import { detectAriaHidden } from './detectors/ariaHidden.js';
import { detectHtmlComments } from './detectors/htmlComments.js';
import { detectMetaTags } from './detectors/metaTags.js';
import { detectCssContent } from './detectors/cssContent.js';
import { matchInjectionPattern } from './patterns/injectionPhrases.js';
import { extractPageText } from './utils/textExtraction.js';

let _idCounter = 0;
function nextId(): string {
  return `rm-${++_idCounter}`;
}

/**
 * Normalizes a RawFinding into an Injection by cross-referencing
 * injection phrase patterns to assign severity and matchedPattern.
 */
function normalize(raw: RawFinding): Injection {
  const match = matchInjectionPattern(raw.matchedText);
  const severity: Severity = match?.pattern.severity ?? 'low';
  const injection: Injection = {
    id: nextId(),
    type: raw.type,
    severity,
    matchedText: raw.matchedText,
    location: raw.location,
  };
  if (raw.selector) injection.selector = raw.selector;
  if (match) injection.matchedPattern = match.matchedPattern;
  return injection;
}

/**
 * Deduplicates findings that target the same selector / text pair.
 * When the same element is caught by multiple detectors, the highest-severity
 * finding wins and the others are dropped.
 */
function deduplicate(injections: Injection[]): Injection[] {
  const severityRank: Record<Severity, number> = { low: 0, medium: 1, high: 2 };
  const byKey = new Map<string, Injection>();

  for (const inj of injections) {
    const key = `${inj.selector ?? ''}::${inj.matchedText.slice(0, 80)}`;
    const existing = byKey.get(key);
    if (!existing || severityRank[inj.severity] > severityRank[existing.severity]) {
      byKey.set(key, inj);
    }
  }

  return Array.from(byKey.values());
}

/**
 * Scans a Document for hidden prompt injection attacks and returns a structured
 * ScanResult containing all findings, extracted page text, and summary counts.
 *
 * Works with any Document implementation: live browser DOM, jsdom, or Playwright DOM.
 *
 * @param options - Scan configuration including the target document.
 * @returns Full scan result with injections, extracted text, and summary.
 */
export function scanDocument(options: ScanOptions): ScanResult {
  const { document: doc, url, minCssContentLength = 20 } = options;

  // Provide a no-op getComputedStyle fallback for environments that lack it
  const getStyle = (el: Element): CSSStyleDeclaration => {
    if (typeof window !== 'undefined' && typeof window.getComputedStyle === 'function') {
      return window.getComputedStyle(el);
    }
    // jsdom / server: return an empty-ish object; color-match will produce no findings
    return {} as CSSStyleDeclaration;
  };

  // Run all detectors
  const rawFindings: RawFinding[] = [
    ...detectHiddenElements(doc),
    ...detectOffScreen(doc),
    ...detectTinyElements(doc),
    ...detectColorMatch(doc, getStyle),
    ...detectAriaHidden(doc),
    ...detectHtmlComments(doc),
    ...detectMetaTags(doc),
    ...detectCssContent(doc, minCssContentLength),
  ];

  // Normalize → require phrase match → deduplicate
  // A structural signal (hidden element, aria-hidden, etc.) is only flagged
  // when the text also matches a known injection phrase. This eliminates false
  // positives from legitimate sites that use these techniques for UI purposes
  // (Google, etc. hide dropdown menus, spinner icons, accessibility labels).
  const normalized = rawFindings.map(normalize).filter(i => i.matchedPattern !== undefined);
  const injections = deduplicate(normalized);

  // Build set of injected selectors for text extraction to skip
  const injectedSelectors = new Set(
    injections.filter(i => i.selector).map(i => i.selector!)
  );

  // Extract the AI-agent view of the page (hidden content already excluded)
  const extractedText = extractPageText(doc, injectedSelectors);

  // Build summary
  const allTypes: InjectionType[] = [
    'hidden-element', 'off-screen', 'tiny-element', 'color-match',
    'aria-hidden', 'html-comment', 'meta-tag', 'css-content',
  ];
  const bySeverity: Record<Severity, number> = { low: 0, medium: 0, high: 0 };
  const byType: Record<InjectionType, number> = Object.fromEntries(
    allTypes.map(t => [t, 0])
  ) as Record<InjectionType, number>;

  for (const inj of injections) {
    bySeverity[inj.severity]++;
    byType[inj.type]++;
  }

  return {
    url,
    timestamp: new Date().toISOString(),
    injections,
    extractedText,
    summary: {
      total: injections.length,
      bySeverity,
      byType,
    },
  };
}
