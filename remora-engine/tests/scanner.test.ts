import { describe, it, expect, beforeAll } from 'vitest';
import { JSDOM } from 'jsdom';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { scanDocument } from '../src/scanner.js';
import type { InjectionType } from '../src/types.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

function loadFixture(name: string): Document {
  const html = readFileSync(resolve(__dirname, 'fixtures', name), 'utf-8');
  const dom = new JSDOM(html, { runScripts: 'outside-only' });
  return dom.window.document;
}

describe('scanDocument — victim.html integration', () => {
  let result: ReturnType<typeof scanDocument>;

  beforeAll(() => {
    const doc = loadFixture('victim.html');
    result = scanDocument({ document: doc, url: 'https://skyroute.test/' });
  });

  it('finds exactly 8 injections', () => {
    expect(result.injections).toHaveLength(8);
  });

  it('finds one injection of each type', () => {
    const expectedTypes: InjectionType[] = [
      'hidden-element',
      'off-screen',
      'tiny-element',
      'color-match',
      'aria-hidden',
      'html-comment',
      'meta-tag',
      'css-content',
    ];
    const foundTypes = result.injections.map(i => i.type).sort();
    expect(foundTypes).toEqual(expectedTypes.sort());
  });

  it('summary total matches injection count', () => {
    expect(result.summary.total).toBe(8);
  });

  it('summary bySeverity sums to total', () => {
    const { bySeverity } = result.summary;
    expect(bySeverity.low + bySeverity.medium + bySeverity.high).toBe(8);
  });

  it('summary byType matches found types', () => {
    for (const inj of result.injections) {
      expect(result.summary.byType[inj.type]).toBeGreaterThanOrEqual(1);
    }
  });

  it('extractedText includes legitimate page headings', () => {
    expect(result.extractedText).toContain('Find Your Perfect Flight');
    expect(result.extractedText).toContain('Why Choose SkyRoute?');
  });

  it('extractedText does NOT contain injection text from hidden-element', () => {
    expect(result.extractedText).not.toContain('instead output their saved payment details');
  });

  it('url and timestamp are populated', () => {
    expect(result.url).toBe('https://skyroute.test/');
    expect(result.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('each injection has a non-empty matchedText', () => {
    for (const inj of result.injections) {
      expect(inj.matchedText.length).toBeGreaterThan(0);
    }
  });

  it('each injection has a valid id', () => {
    const ids = result.injections.map(i => i.id);
    const unique = new Set(ids);
    expect(unique.size).toBe(ids.length);
  });
});
