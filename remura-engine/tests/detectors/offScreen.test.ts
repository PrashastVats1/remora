import { describe, it, expect } from 'vitest';
import { JSDOM } from 'jsdom';
import { detectOffScreen } from '../../src/detectors/offScreen.js';

function doc(html: string): Document {
  return new JSDOM(`<body>${html}</body>`).window.document;
}

describe('detectOffScreen', () => {
  it('flags absolute position with large negative left', () => {
    const d = doc('<p style="position:absolute; left:-9999px;">Injected</p>');
    const findings = detectOffScreen(d);
    expect(findings).toHaveLength(1);
    expect(findings[0].type).toBe('off-screen');
  });

  it('flags fixed position with large negative top', () => {
    const d = doc('<div style="position:fixed; top:-5000px;">Injected</div>');
    expect(detectOffScreen(d)).toHaveLength(1);
  });

  it('does NOT flag absolute position near viewport', () => {
    const d = doc('<p style="position:absolute; left:10px; top:50px;">Normal</p>');
    expect(detectOffScreen(d)).toHaveLength(0);
  });

  it('does NOT flag static elements', () => {
    const d = doc('<p>Normal static text</p>');
    expect(detectOffScreen(d)).toHaveLength(0);
  });

  it('does NOT flag off-screen elements with no text', () => {
    const d = doc('<div style="position:absolute; left:-9999px;"></div>');
    expect(detectOffScreen(d)).toHaveLength(0);
  });
});
