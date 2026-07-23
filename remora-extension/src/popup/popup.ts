import type { ScanResult, Injection, Severity } from 'remora-engine';

const root        = document.getElementById('root')!;
const trustedRoot = document.getElementById('trusted-root')!;

const USER_SITES_KEY = 'rm_user_sites';;

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function trunc(s: string, maxLen = 80): string {
  return s.length > maxLen ? s.slice(0, maxLen) + '…' : s;
}

// Human-readable labels and why-explanations per attack category.
const CATEGORY_META: Record<string, { label: string; intent: string; why: string }> = {
  'instruction-override': {
    label:  'Instruction override',
    intent: 'System tampering',
    why:    'Attempts to replace the agent\'s core instructions, making it ignore its original task and safety guidelines.',
  },
  'role-manipulation': {
    label:  'Role manipulation',
    intent: 'Identity hijacking',
    why:    'Tries to make the agent believe it is a different AI with different rules, bypassing its built-in behaviour.',
  },
  'data-exfiltration': {
    label:  'Data exfiltration',
    intent: 'Data theft',
    why:    'Instructs the agent to reveal confidential data — system prompts, conversation history, or user information — to an attacker.',
  },
  'action-manipulation': {
    label:  'Action manipulation',
    intent: 'Behaviour redirection',
    why:    'Redirects what the agent does or outputs, causing it to act against the user\'s intention without their knowledge.',
  },
  'conditional-trigger': {
    label:  'Conditional trigger',
    intent: 'Sleeper instruction',
    why:    'Plants a hidden instruction that activates later — for example, when a specific phrase is said — acting as a backdoor.',
  },
};

function findingCard(inj: Injection): string {
  const meta = CATEGORY_META[inj.type] ?? {
    label:  inj.type,
    intent: 'Unknown',
    why:    'This pattern matches known prompt injection techniques.',
  };

  const patternLine = inj.matchedPattern
    ? `<div class="finding-pattern">↳ matched: "${esc(inj.matchedPattern)}"</div>`
    : '';

  return `
    <div class="finding ${inj.severity}">
      <div class="finding-meta">
        <span class="finding-type">${esc(meta.label)}</span>
        <span class="finding-intent">${esc(meta.intent)}</span>
        <span class="finding-sev ${inj.severity}">${inj.severity.toUpperCase()}</span>
      </div>
      <div class="finding-text">${esc(trunc(inj.matchedText))}</div>
      ${patternLine}
      <div class="finding-why">${esc(meta.why)}</div>
    </div>
  `;
}

function renderScanning(): void {
  root.innerHTML = `
    <div class="banner scanning">
      <div class="spinner"></div>
      <span>Scanning page…</span>
    </div>
    ${links()}
  `;
}

function renderClean(result: ScanResult): void {
  root.innerHTML = `
    <div class="banner clean">
      <div class="check">✓</div>
      <span>No injections found</span>
    </div>
    ${footer(result.url)}
    ${links()}
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
    ${links()}
  `;
}

function footer(url?: string): string {
  try {
    const u = new URL(url ?? '');
    return `<div class="footer">${esc(u.hostname + u.pathname)}</div>`;
  } catch {
    return `<div class="footer">—</div>`;
  }
}

function links(): string {
  return `
    <div class="links-section">
      <a class="link-item" href="https://remora.watch/raise-a-ticket" target="_blank" rel="noopener">
        🎫 Report a false positive
      </a>
      <a class="link-item" href="https://remora.watch/faqs" target="_blank" rel="noopener">
        ❓ FAQs
      </a>
      <a class="link-item link-item--cta" href="https://remora.watch/design-partner" target="_blank" rel="noopener">
        🤝 Become a design partner
      </a>
    </div>
  `;
}

function severityRank(s: Severity): number {
  return s === 'high' ? 2 : s === 'medium' ? 1 : 0;
}

async function renderTrustedSites(): Promise<void> {
  const stored = await chrome.storage.local.get(USER_SITES_KEY);
  const sites: string[] = stored[USER_SITES_KEY] ?? [];

  const body = sites.length === 0
    ? `<div class="trusted-empty">No trusted sites yet. Click "Don't scan this site again" on any warning to add one.</div>`
    : sites.map(h => `
        <div class="trusted-item">
          <span class="trusted-hostname">${esc(h)}</span>
          <button class="trusted-remove" data-host="${esc(h)}" title="Remove">×</button>
        </div>
      `).join('');

  const countBadge = sites.length > 0
    ? `<span class="trusted-count">${sites.length}</span>`
    : '';

  trustedRoot.innerHTML = `
    <div class="trusted-section">
      <div class="trusted-header">
        <span class="trusted-title">Trusted Sites</span>
        ${countBadge}
      </div>
      <div class="trusted-list">${body}</div>
    </div>
  `;

  trustedRoot.querySelectorAll<HTMLButtonElement>('.trusted-remove').forEach(btn => {
    btn.addEventListener('click', async () => {
      const host = btn.dataset.host ?? '';
      const st = await chrome.storage.local.get(USER_SITES_KEY);
      const updated = ((st[USER_SITES_KEY] ?? []) as string[]).filter(s => s !== host);
      await chrome.storage.local.set({ [USER_SITES_KEY]: updated });
      await renderTrustedSites();
    });
  });
}

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
    await renderTrustedSites();
    return;
  }

  const key = `rm_result_${tabId}`;
  const stored = await chrome.storage.local.get(key);
  const result: ScanResult | undefined = stored[key] as ScanResult | undefined;

  if (!result) {
    renderScanning();
    await renderTrustedSites();
    return;
  }

  if (result.summary.total === 0) {
    renderClean(result);
  } else {
    renderFindings(result);
  }

  await renderTrustedSites();
}

init();
