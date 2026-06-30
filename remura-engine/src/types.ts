/** All supported injection detection categories. */
export type InjectionType =
  | 'hidden-element'
  | 'off-screen'
  | 'tiny-element'
  | 'color-match'
  | 'aria-hidden'
  | 'html-comment'
  | 'meta-tag'
  | 'css-content';

/** Severity levels for injection findings. */
export type Severity = 'low' | 'medium' | 'high';

/** A single detected injection finding. */
export interface Injection {
  /** Unique id for this finding. */
  id: string;
  /** The detection category that produced this finding. */
  type: InjectionType;
  /** Assessed severity, informed by matched phrase patterns. */
  severity: Severity;
  /** The suspicious text extracted from the element or node. */
  matchedText: string;
  /** The injection phrase pattern that matched, if any. */
  matchedPattern?: string;
  /** CSS selector path to the element (for highlighting in UI). */
  selector?: string;
  /** Structural location information. */
  location: {
    tagName?: string;
    attributes?: Record<string, string>;
  };
}

/** The full result returned by scanDocument(). */
export interface ScanResult {
  /** The URL of the scanned page, if provided. */
  url?: string;
  /** ISO timestamp of when the scan ran. */
  timestamp: string;
  /** All detected injections. */
  injections: Injection[];
  /** The full "AI agent view" of the page, as structured markdown-like text. */
  extractedText: string;
  /** Aggregate counts. */
  summary: {
    total: number;
    bySeverity: Record<Severity, number>;
    byType: Record<InjectionType, number>;
  };
}

/** Options for scanDocument(). */
export interface ScanOptions {
  /** Works with a real browser DOM, jsdom, or Playwright DOM. */
  document: Document;
  /** Optional URL for context in results. */
  url?: string;
  /**
   * Minimum character length for CSS ::before/::after content to be flagged.
   * Defaults to 20. Keeps decorative icons/checkmarks from being false positives.
   */
  minCssContentLength?: number;
}

/** Internal raw finding produced by each detector before normalization. */
export interface RawFinding {
  type: InjectionType;
  matchedText: string;
  selector?: string;
  location: {
    tagName?: string;
    attributes?: Record<string, string>;
  };
}
