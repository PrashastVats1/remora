import { describe, it, expect } from 'vitest';
import { JSDOM } from 'jsdom';
import { detectColorMatch } from '../../src/detectors/colorMatch.js';

function doc(html: string): Document {
  return new JSDOM(`<body>${html}</body>`).window.document;
}

/**
 * Creates a mock getComputedStyle that returns provided color/bg values.
 */
function mockStyle(color: string, bg: string): (el: Element) => CSSStyleDeclaration {
  return () => ({ color, backgroundColor: bg } as unknown as CSSStyleDeclaration);
}

describe('detectColorMatch', () => {
  it('flags element where text color matches background color', () => {
    const d = doc('<p>White on white text</p>');
    const el = d.querySelector('p')!;
    const getStyle = (e: Element): CSSStyleDeclaration => {
      if (e === el) return mockStyle('rgb(255, 255, 255)', 'rgb(255, 255, 255)')(e);
      return mockStyle('rgb(0, 0, 0)', 'transparent')(e);
    };
    const findings = detectColorMatch(d, getStyle);
    expect(findings.length).toBeGreaterThanOrEqual(1);
    expect(findings[0].type).toBe('color-match');
  });

  it('does NOT flag element with contrasting colors', () => {
    const d = doc('<p>Normal text</p>');
    const getStyle = mockStyle('rgb(0, 0, 0)', 'rgb(255, 255, 255)');
    const findings = detectColorMatch(d, getStyle);
    expect(findings).toHaveLength(0);
  });

  it('does NOT flag element with no text', () => {
    const d = doc('<div></div>');
    const getStyle = mockStyle('rgb(255, 255, 255)', 'rgb(255, 255, 255)');
    const findings = detectColorMatch(d, getStyle);
    expect(findings).toHaveLength(0);
  });
});
