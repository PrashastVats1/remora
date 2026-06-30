import type { ScanResult, Injection, Severity } from 'remura-engine';

const root = document.getElementById('root')!;

/** Escapes HTML special characters for safe innerHTML insertion. */
function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Truncates a string to maxLen, adding ellipsis if needed. */
function trunc(s: string, maxLen = 80): string {
  return s.length > maxLen ? s.slice(0, maxLen) + '…' : s;
}

function renderScanning(): void {
  root.innerHTML = `
    <div class="banner scanning">
      <div class="spinner"></div>
      <span>Scanning page…</span>
    </div>
  `;
}

function renderClean(result: ScanResult): void {
  root.innerHTML = `
    <div class="banner clean">
      <div class="check">✓</div>
      <span>No injections found</span>
    </div>
    ${footer(result.url)}
  `;
}

function renderFindings(result: ScanResult): void {
  const { injections } = result;
  const count = injections.length;

  const findingCards = injections
    .sort((a, b) => severityRank(b.severity) - severityRank(a.severity))
    .map(findingCard)
    .join('');

  root.innerHTML = `
    <div class="banner alert">
      <span class="banner-icon">⚠</span>
      <span>${count} injection${count !== 1 ? 's' : ''} found</span>
    </div>
    <div class="findings">${findingCards}</div>
    ${footer(result.url)}
  `;
}

function findingCard(inj: Injection): string {
  const patternLine = inj.matchedPattern
    ? `<div class="finding-pattern">↳ matched: "${esc(inj.matchedPattern)}"</div>`
    : '';

  return `
    <div class="finding ${inj.severity}">
      <div class="finding-meta">
        <span class="finding-type">${esc(inj.type)}</span>
        <span class="finding-sev ${inj.severity}">${inj.severity.toUpperCase()}</span>
      </div>
      <div class="finding-text">${esc(trunc(inj.matchedText))}</div>
      ${patternLine}
    </div>
  `;
}

function footer(url?: string): string {
  const display = url ? new URL(url).hostname + new URL(url).pathname : '—';
  return `<div class="footer">${esc(display)}</div>`;
}

function severityRank(s: Severity): number {
  return s === 'high' ? 2 : s === 'medium' ? 1 : 0;
}

/** Entry point — reads the active tab's stored scan result and renders. */
async function init(): Promise<void> {
  renderScanning();

  let tabId: number | undefined;
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    tabId = tab?.id;
  } catch {
    renderScanning();
    return;
  }

  if (tabId == null) {
    renderScanning();
    return;
  }

  const key = `rm_result_${tabId}`;
  const stored = await chrome.storage.local.get(key);
  const result: ScanResult | undefined = stored[key] as ScanResult | undefined;

  if (!result) {
    renderScanning();
    return;
  }

  if (result.summary.total === 0) {
    renderClean(result);
  } else {
    renderFindings(result);
  }
}

init();
