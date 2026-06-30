import { scanDocument } from 'remura-engine';
import type { ScanResult } from 'remura-engine';

const COUNTDOWN_SEC = 30;

// ─── Overlay HTML + CSS (injected into a closed Shadow DOM) ──────────────────

function overlayMarkup(result: ScanResult): string {
  const count = result.summary.total;
  const uniqueTypes = [...new Set(result.injections.map(i => i.type))];
  const badges = uniqueTypes.map(t => `<span class="badge">${t}</span>`).join('');
  const noun = count === 1 ? 'instruction' : 'instructions';

  const severityColor: Record<string, string> = {
    high: '#e63946',
    medium: '#f4a261',
    low: '#aaa',
  };

  const detailRows = result.injections.map(inj => {
    const phrase = (inj.matchedPattern ?? inj.matchedText).slice(0, 90);
    const truncated = phrase.length === 90 ? phrase + '…' : phrase;
    const col = severityColor[inj.severity] ?? '#aaa';
    return `<tr>
      <td><span class="badge">${inj.type}</span></td>
      <td style="color:${col};font-weight:700;font-size:10px;text-transform:uppercase;padding:0 10px">${inj.severity}</td>
      <td class="phrase">"${truncated}"</td>
    </tr>`;
  }).join('');

  return `
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  .backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0,0,0,0.78);
    backdrop-filter: blur(4px);
    -webkit-backdrop-filter: blur(4px);
    display: flex;
    align-items: center;
    justify-content: center;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  }

  .panel {
    background: #0e0e0e;
    border: 1px solid #e63946;
    border-radius: 12px;
    width: 520px;
    max-width: calc(100vw - 40px);
    max-height: calc(100vh - 40px);
    box-shadow: 0 0 0 1px rgba(230,57,70,0.12), 0 32px 80px rgba(0,0,0,0.9);
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }

  .panel-header {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 14px 20px;
    background: #161616;
    border-bottom: 1px solid #2a2a2a;
    flex-shrink: 0;
  }

  .shield {
    width: 20px; height: 20px;
    color: #e63946;
    flex-shrink: 0;
  }

  .brand {
    font-size: 14px;
    font-weight: 700;
    color: #f0f0f0;
    letter-spacing: -0.02em;
  }

  .panel-body {
    padding: 24px 20px 22px;
    overflow-y: auto;
  }

  .warn-title {
    font-size: 17px;
    font-weight: 800;
    color: #e63946;
    letter-spacing: -0.02em;
    margin-bottom: 12px;
  }

  .warn-count {
    font-size: 14px;
    color: #f0f0f0;
    margin-bottom: 5px;
    line-height: 1.5;
  }

  .warn-desc {
    font-size: 13px;
    color: #888;
    line-height: 1.6;
    margin-bottom: 18px;
  }

  .badges {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-bottom: 16px;
  }

  .badge {
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.04em;
    color: #666;
    background: #161616;
    border: 1px solid #2a2a2a;
    padding: 3px 8px;
    border-radius: 4px;
    font-family: "SFMono-Regular", Consolas, monospace;
  }

  /* ── Details toggle ── */
  .details-toggle {
    display: flex;
    align-items: center;
    gap: 6px;
    background: none;
    border: none;
    color: #555;
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
    padding: 0;
    margin-bottom: 18px;
    font-family: inherit;
    letter-spacing: 0.02em;
    transition: color 0.15s;
  }
  .details-toggle:hover { color: #e63946; }
  .details-toggle .arrow { font-size: 10px; transition: transform 0.2s; }
  .details-toggle.open .arrow { transform: rotate(180deg); }

  /* ── Details table ── */
  .details-panel {
    display: none;
    margin-bottom: 18px;
    border: 1px solid #1e1e1e;
    border-radius: 6px;
    overflow: hidden;
  }
  .details-panel.open { display: block; }

  .details-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 11px;
  }
  .details-table tr {
    border-bottom: 1px solid #1a1a1a;
  }
  .details-table tr:last-child { border-bottom: none; }
  .details-table td {
    padding: 7px 10px;
    vertical-align: top;
    color: #888;
  }
  .details-table td:first-child { white-space: nowrap; padding-left: 12px; }
  .details-table td.phrase {
    font-family: "SFMono-Regular", Consolas, monospace;
    color: #555;
    word-break: break-all;
  }

  /* ── Timer ── */
  .timer-track {
    height: 3px;
    background: #1e1e1e;
    border-radius: 2px;
    overflow: hidden;
    margin-bottom: 8px;
  }

  .timer-fill {
    height: 100%;
    width: 100%;
    background: #e63946;
    border-radius: 2px;
    transition: width 0.95s linear;
  }

  .timer-label {
    font-size: 11px;
    color: #666;
    margin-bottom: 16px;
    letter-spacing: 0.02em;
  }

  .timer-label strong {
    color: #e63946;
    font-variant-numeric: tabular-nums;
  }

  .timer-label.paused strong::after {
    content: " (paused)";
    color: #555;
    font-weight: 400;
  }

  /* ── Acknowledge button ── */
  .ack-btn {
    width: 100%;
    padding: 11px 20px;
    background: transparent;
    border: 1.5px solid #2a2a2a;
    border-radius: 8px;
    color: #666;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    font-family: inherit;
    letter-spacing: 0.01em;
    transition: border-color 0.2s, color 0.2s, background 0.2s;
  }

  .ack-btn:hover {
    border-color: #e63946;
    color: #f0f0f0;
    background: rgba(230,57,70,0.07);
  }

  .ack-btn:active { opacity: 0.8; }
</style>

<div class="backdrop">
  <div class="panel" id="rm-panel">
    <div class="panel-header">
      <svg class="shield" viewBox="0 0 32 32" fill="none">
        <path d="M16 3L4 8v8c0 7 5.3 13.5 12 15 6.7-1.5 12-8 12-15V8L16 3z"
              stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>
        <path d="M10 16l4 4 8-8"
              stroke="currentColor" stroke-width="2"
              stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
      <span class="brand">Remura</span>
    </div>

    <div class="panel-body">
      <div class="warn-title">⚠ PROMPT INJECTION DETECTED</div>
      <p class="warn-count">
        <strong>${count} hidden ${noun}</strong> found on this page.
      </p>
      <p class="warn-desc">
        This page may be attempting to hijack your AI agent.
      </p>
      <div class="badges">${badges}</div>

      <button class="details-toggle" id="rm-details-toggle">
        <span class="arrow">▾</span><span id="rm-details-label"> Show details (${count})</span>
      </button>
      <div class="details-panel" id="rm-details-panel">
        <table class="details-table">
          ${detailRows}
        </table>
      </div>

      <div class="timer-track">
        <div class="timer-fill" id="rm-fill"></div>
      </div>
      <div class="timer-label" id="rm-timer-label">
        <strong id="rm-countdown">${COUNTDOWN_SEC}</strong>s remaining
        — alert fires if not acknowledged
      </div>

      <button class="ack-btn" id="rm-ack">
        I acknowledge this risk — continue
      </button>
    </div>
  </div>
</div>`;
}

// ─── Overlay lifecycle ────────────────────────────────────────────────────────

function injectOverlay(result: ScanResult): void {
  if (document.getElementById('rm-overlay-host')) return;

  const host = document.createElement('div');
  host.id = 'rm-overlay-host';
  // Cover the entire viewport; pointer-events:all blocks all interaction below
  host.style.cssText =
    'position:fixed;inset:0;z-index:2147483647;pointer-events:all;contain:strict;';

  // Closed shadow root — external JS cannot reach our DOM
  const shadow = host.attachShadow({ mode: 'closed' });
  shadow.innerHTML = overlayMarkup(result);

  // Prevent scroll on the host page while overlay is visible
  const prevOverflow = document.documentElement.style.overflow;
  document.documentElement.style.overflow = 'hidden';

  document.body.appendChild(host);

  const fill          = shadow.getElementById('rm-fill')!;
  const countdownEl   = shadow.getElementById('rm-countdown')!;
  const timerLabel    = shadow.getElementById('rm-timer-label')!;
  const ackBtn        = shadow.getElementById('rm-ack')!;
  const detailsToggle = shadow.getElementById('rm-details-toggle')!;
  const detailsLabel  = shadow.getElementById('rm-details-label')!;
  const detailsPanel  = shadow.getElementById('rm-details-panel')!;

  let remaining = COUNTDOWN_SEC;
  let paused = false;

  const tick = setInterval(() => {
    if (paused) return;
    remaining -= 1;
    countdownEl.textContent = String(remaining);
    fill.style.width = `${(remaining / COUNTDOWN_SEC) * 100}%`;

    if (remaining <= 0) {
      clearInterval(tick);
      chrome.runtime.sendMessage({ type: 'RM_ALERT', result }).catch(() => {});
    }
  }, 1000);

  // Details expand/collapse — clicking "Show details" pauses the timer.
  // A human reading the evidence gets all the time they need.
  // An AI agent would have to explicitly click this button to bypass the timer,
  // which is adversarial behaviour well outside normal browsing.
  detailsToggle.addEventListener('click', () => {
    if (!paused) {
      paused = true;
      timerLabel.classList.add('paused');
    }
    const isOpen = detailsPanel.classList.toggle('open');
    detailsToggle.classList.toggle('open', isOpen);
    detailsToggle.querySelector('span.arrow')!.textContent = isOpen ? '▴' : '▾';
    detailsLabel.textContent = isOpen
      ? ` Hide details (${result.injections.length})`
      : ` Show details (${result.injections.length})`;
  });

  ackBtn.addEventListener('click', () => {
    clearInterval(tick);
    document.documentElement.style.overflow = prevOverflow;
    host.remove();
  });
}

// ─── Entry point ─────────────────────────────────────────────────────────────

function main(): void {
  let result: ScanResult;
  try {
    result = scanDocument({ document, url: location.href });
  } catch (err) {
    console.warn('[Remura] scan error:', err);
    return;
  }

  // Always update badge + storage via background
  chrome.runtime.sendMessage({ type: 'RM_SCAN_RESULT', result }).catch(() => {});

  // Blocking overlay only when injections are found
  if (result.summary.total > 0) {
    injectOverlay(result);
  }
}

main();
