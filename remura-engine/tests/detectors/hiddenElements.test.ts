import { describe, it, expect } from 'vitest';
import { JSDOM } from 'jsdom';
import { detectHiddenElements } from '../../src/detectors/hiddenElements.js';

function doc(html: string): Document {
  return new JSDOM(`<body>${html}</body>`).window.document;
}

describe('detectHiddenElements', () => {
  it('flags display:none elements with text', () => {
    const d = doc('<div style="display:none;">Secret injection</div>');
    const findings = detectHiddenElements(d);
    expect(findings).toHaveLength(1);
    expect(findings[0].type).toBe('hidden-element');
    expect(findings[0].matchedText).toContain('Secret injection');
  });

  it('flags visibility:hidden elements with text', () => {
    const d = doc('<p style="visibility:hidden;">Hidden text</p>');
    const findings = detectHiddenElements(d);
    expect(findings).toHaveLength(1);
  });

  it('flags opacity:0 elements with text', () => {
    const d = doc('<span style="opacity:0;">Zero opacity</span>');
    const findings = detectHiddenElements(d);
    expect(findings).toHaveLength(1);
  });

  it('does NOT flag display:none elements with no text', () => {
    const d = doc('<div style="display:none;"></div>');
    expect(detectHiddenElements(d)).toHaveLength(0);
  });

  it('does NOT flag visible elements', () => {
    const d = doc('<p>Normal visible text</p>');
    expect(detectHiddenElements(d)).toHaveLength(0);
  });
});
