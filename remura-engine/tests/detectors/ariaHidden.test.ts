import { describe, it, expect } from 'vitest';
import { JSDOM } from 'jsdom';
import { detectAriaHidden } from '../../src/detectors/ariaHidden.js';

function doc(html: string): Document {
  return new JSDOM(`<body>${html}</body>`).window.document;
}

describe('detectAriaHidden', () => {
  it('flags aria-hidden="true" elements with text', () => {
    const d = doc('<span aria-hidden="true">Hidden injection text</span>');
    const findings = detectAriaHidden(d);
    expect(findings).toHaveLength(1);
    expect(findings[0].type).toBe('aria-hidden');
    expect(findings[0].matchedText).toBe('Hidden injection text');
  });

  it('does NOT flag aria-hidden="false" elements', () => {
    const d = doc('<span aria-hidden="false">Visible text</span>');
    expect(detectAriaHidden(d)).toHaveLength(0);
  });

  it('does NOT flag elements without aria-hidden', () => {
    const d = doc('<span>Normal text</span>');
    expect(detectAriaHidden(d)).toHaveLength(0);
  });

  it('does NOT flag aria-hidden element with no text', () => {
    const d = doc('<span aria-hidden="true"></span>');
    expect(detectAriaHidden(d)).toHaveLength(0);
  });
});
