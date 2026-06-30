import { describe, it, expect } from 'vitest';
import { JSDOM } from 'jsdom';
import { detectTinyElements } from '../../src/detectors/tinyElements.js';

function doc(html: string): Document {
  return new JSDOM(`<body>${html}</body>`).window.document;
}

describe('detectTinyElements', () => {
  it('flags 1x1 px elements with text', () => {
    const d = doc('<div style="width:1px; height:1px;">Tiny injection</div>');
    const findings = detectTinyElements(d);
    expect(findings).toHaveLength(1);
    expect(findings[0].type).toBe('tiny-element');
  });

  it('flags 0x0 px elements with text', () => {
    const d = doc('<div style="width:0px; height:0px;">Zero size</div>');
    expect(detectTinyElements(d)).toHaveLength(1);
  });

  it('does NOT flag normal-sized elements', () => {
    const d = doc('<div style="width:100px; height:50px;">Normal</div>');
    expect(detectTinyElements(d)).toHaveLength(0);
  });

  it('does NOT flag tiny elements with no text', () => {
    const d = doc('<div style="width:1px; height:1px;"></div>');
    expect(detectTinyElements(d)).toHaveLength(0);
  });

  it('does NOT flag elements without explicit dimensions', () => {
    const d = doc('<div>No dimensions set</div>');
    expect(detectTinyElements(d)).toHaveLength(0);
  });
});
