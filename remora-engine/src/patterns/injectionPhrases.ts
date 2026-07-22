import type { Severity } from '../types.js';

/** A single categorized injection phrase pattern. */
export interface InjectionPattern {
  category: string;
  pattern: RegExp;
  severity: Severity;
}

/**
 * Categorized list of regex patterns indicating prompt injection attempts.
 * Organized by attack category for easy extension.
 */
export const INJECTION_PATTERNS: InjectionPattern[] = [
  // --- Instruction overrides ---
  {
    category: 'instruction-override',
    pattern: /ignore\s+(all\s+)?previous\s+instructions?/i,
    severity: 'high',
  },
  {
    category: 'instruction-override',
    pattern: /disregard\s+(your\s+)?instructions?/i,
    severity: 'high',
  },
  {
    category: 'instruction-override',
    pattern: /forget\s+(your\s+)?instructions?/i,
    severity: 'high',
  },
  {
    category: 'instruction-override',
    pattern: /new\s+instructions?/i,
    severity: 'high',
  },
  {
    category: 'instruction-override',
    pattern: /system\s+prompt\s+update/i,
    severity: 'high',
  },
  {
    category: 'instruction-override',
    pattern: /override\s+(your\s+)?(instructions?|system\s+prompt|previous\s+instructions?)/i,
    severity: 'medium',
  },
  {
    category: 'instruction-override',
    pattern: /instruction\s+override/i,
    severity: 'medium',
  },

  // --- Role manipulation ---
  {
    category: 'role-manipulation',
    pattern: /you\s+are\s+now\b/i,
    severity: 'high',
  },
  {
    category: 'role-manipulation',
    pattern: /\bact\s+as\s+(an?\s+)?(ai\b|gpt|llm|chatgpt|language\s+model|assistant\b|bot\b|dan\b)/i,
    severity: 'medium',
  },
  {
    category: 'role-manipulation',
    pattern: /you\s+are\s+no\s+longer\b/i,
    severity: 'high',
  },
  {
    category: 'role-manipulation',
    pattern: /\badmin\s+mode\b/i,
    severity: 'high',
  },
  {
    category: 'role-manipulation',
    pattern: /\bevaluation\s+mode\b/i,
    severity: 'medium',
  },
  {
    category: 'role-manipulation',
    pattern: /\bdeveloper\s+mode\b/i,
    severity: 'medium',
  },

  // --- Data exfiltration ---
  {
    category: 'data-exfiltration',
    pattern: /\bforward\s+(all\s+)?(this|messages?|conversation|emails?)\s+to\b/i,
    severity: 'high',
  },
  {
    category: 'data-exfiltration',
    pattern: /\bsend\s+(all\s+)?(this|messages?|conversation|data|contents?)\s+to\b/i,
    severity: 'high',
  },
  {
    category: 'data-exfiltration',
    pattern: /reveal\s+(your\s+)?(system\s+prompt|instructions?|confidential|context|training)/i,
    severity: 'high',
  },
  {
    category: 'data-exfiltration',
    pattern: /\bexfiltrate\b/i,
    severity: 'high',
  },

  // --- Action manipulation ---
  {
    category: 'action-manipulation',
    pattern: /\bdo\s+not\s+complete\b/i,
    severity: 'high',
  },
  {
    category: 'action-manipulation',
    pattern: /\binstead\s+output\b/i,
    severity: 'high',
  },
  {
    category: 'action-manipulation',
    pattern: /\binstead\s+tell\s+the\s+user\b/i,
    severity: 'high',
  },
  {
    category: 'action-manipulation',
    pattern: /\brepeat\s+back\b/i,
    severity: 'medium',
  },

  // --- Conditional triggers ---
  {
    category: 'conditional-trigger',
    pattern: /\bif\s+asked\b/i,
    severity: 'medium',
  },
  {
    category: 'conditional-trigger',
    pattern: /\bwhen\s+the\s+user\s+says\b/i,
    severity: 'high',
  },
  {
    category: 'conditional-trigger',
    pattern: /\bcodeword\b/i,
    severity: 'medium',
  },
];

/**
 * Matches text against all injection patterns and returns the best (highest
 * severity) match found, or null if no patterns match.
 */
export function matchInjectionPattern(
  text: string
): { pattern: InjectionPattern; matchedPattern: string } | null {
  const severityRank: Record<Severity, number> = { low: 0, medium: 1, high: 2 };
  let best: { pattern: InjectionPattern; matchedPattern: string } | null = null;

  for (const p of INJECTION_PATTERNS) {
    const m = text.match(p.pattern);
    if (m) {
      const candidate = { pattern: p, matchedPattern: m[0] };
      if (!best || severityRank[p.severity] > severityRank[best.pattern.severity]) {
        best = candidate;
      }
    }
  }

  return best;
}
