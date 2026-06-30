import type { ScanResult } from 'remura-engine';

function storageKey(tabId: number): string {
  return `rm_result_${tabId}`;
}

// ─── Message handler ──────────────────────────────────────────────────────────

chrome.runtime.onMessage.addListener(
  (message: { type: string; result: ScanResult }, sender) => {

    // Content script finished scanning — update badge + storage
    if (message.type === 'RM_SCAN_RESULT') {
      const tabId = sender.tab?.id;
      if (tabId == null) return;

      chrome.storage.local.set({ [storageKey(tabId)]: message.result });

      const count = message.result.summary.total;
      if (count > 0) {
        chrome.action.setBadgeText({ text: String(count), tabId });
        chrome.action.setBadgeBackgroundColor({ color: '#e63946', tabId });
        chrome.action.setBadgeTextColor({ color: '#ffffff', tabId });
      } else {
        chrome.action.setBadgeText({ text: '', tabId });
      }
      return;
    }

    // Countdown expired without acknowledgment — AI agent did not respond
    if (message.type === 'RM_ALERT') {
      const result = message.result;
      const count  = result.summary.total;
      const host   = (() => {
        try { return new URL(result.url ?? '').hostname; }
        catch { return result.url ?? 'unknown site'; }
      })();

      chrome.notifications.create({
        type:               'basic',
        iconUrl:            chrome.runtime.getURL('icons/icon128.png'),
        title:              'Remura — AI Agent Blocked',
        message:            `${count} prompt injection${count !== 1 ? 's' : ''} detected on ${host}. The agent did not acknowledge — process stopped. Human review required.`,
        priority:           2,
        requireInteraction: true,   // notification stays until user dismisses it
      });
      return;
    }
  }
);

// ─── Tab lifecycle ─────────────────────────────────────────────────────────────

// Clear stale results when a tab starts a new navigation
chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.status === 'loading') {
    chrome.storage.local.remove(storageKey(tabId));
    chrome.action.setBadgeText({ text: '', tabId });
  }
});

// Clean up storage when a tab closes
chrome.tabs.onRemoved.addListener((tabId) => {
  chrome.storage.local.remove(storageKey(tabId));
});
