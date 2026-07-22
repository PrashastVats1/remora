import type { ScanResult } from 'remora-engine';
import { checkDomain } from './domainCheck.js';
import { isAllowlisted } from './allowlist.js';

function storageKey(tabId: number): string {
  return `rm_result_${tabId}`;
}

// Maps notification IDs → tabId so clicking a notification can focus the right tab.
const notifTabMap = new Map<string, number>();

// ─── Message handler ──────────────────────────────────────────────────────────

chrome.runtime.onMessage.addListener(
  (message: { type: string; result?: ScanResult; url?: string }, sender, sendResponse) => {

    // Content script requests a domain check before scanning.
    if (message.type === 'RM_CHECK_DOMAIN' && message.url) {
      const url = message.url;
      let hostname = '';
      try { hostname = new URL(url).hostname; } catch { /* ignore */ }

      if (isAllowlisted(hostname)) {
        sendResponse({ safe: true, allowlisted: true });
        return true;
      }

      // Async domain check — return true to keep the message channel open.
      checkDomain(url).then((result) => {
        sendResponse({ safe: !result.flagged, reason: result.reason });
      }).catch(() => {
        sendResponse({ safe: true }); // Fail open on error.
      });
      return true; // Keep channel open for async sendResponse
    }

    // Content script finished scanning — update badge + storage.
    if (message.type === 'RM_SCAN_RESULT' && message.result) {
      const tabId = sender.tab?.id;
      if (tabId == null) return;

      chrome.storage.local.set({ [storageKey(tabId)]: message.result });

      const count = message.result.summary.total;
      if (count > 0) {
        chrome.action.setBadgeText({ text: String(count), tabId });
        chrome.action.setBadgeBackgroundColor({ color: '#e63946', tabId });
        chrome.action.setBadgeTextColor({ color: '#ffffff', tabId });

        // Immediate detection notification — fires as soon as injections are found.
        const notifId = `rm-detection-${tabId}-${Date.now()}`;
        notifTabMap.set(notifId, tabId);
        const host = (() => {
          try { return new URL(message.result!.url ?? '').hostname; }
          catch { return message.result!.url ?? 'unknown site'; }
        })();
        chrome.notifications.create(notifId, {
          type:    'basic',
          iconUrl: chrome.runtime.getURL('icons/icon128.png'),
          title:   'Remora — Prompt Injection Detected',
          message: `${count} hidden instruction${count !== 1 ? 's' : ''} found on ${host}. Overlay shown — awaiting acknowledgment.`,
          priority: 2,
        });
      } else {
        chrome.action.setBadgeText({ text: '', tabId });
      }
      return;
    }

    // Countdown expired without acknowledgment — AI agent did not respond.
    if (message.type === 'RM_ALERT' && message.result) {
      const result = message.result;
      const tabId  = sender.tab?.id;
      const count  = result.summary.total;
      const host   = (() => {
        try { return new URL(result.url ?? '').hostname; }
        catch { return result.url ?? 'unknown site'; }
      })();

      const notifId = `rm-alert-${tabId}-${Date.now()}`;
      if (tabId != null) notifTabMap.set(notifId, tabId);

      chrome.notifications.create(notifId, {
        type:               'basic',
        iconUrl:            chrome.runtime.getURL('icons/icon128.png'),
        title:              'Remora — AI Agent Blocked',
        message:            `${count} prompt injection${count !== 1 ? 's' : ''} on ${host}. The agent did not acknowledge — process stopped. Human review required.`,
        priority:           2,
        requireInteraction: true,
      });
      return;
    }
  }
);

// ─── Notification click — focus the affected tab ──────────────────────────────

chrome.notifications.onClicked.addListener((notifId) => {
  const tabId = notifTabMap.get(notifId);
  if (tabId != null) {
    chrome.tabs.get(tabId, (tab) => {
      if (!chrome.runtime.lastError && tab.windowId != null) {
        chrome.windows.update(tab.windowId, { focused: true });
        chrome.tabs.update(tabId, { active: true });
      }
    });
    notifTabMap.delete(notifId);
  }
  chrome.notifications.clear(notifId);
});

// ─── Tab lifecycle ─────────────────────────────────────────────────────────────

chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.status === 'loading') {
    chrome.storage.local.remove(storageKey(tabId));
    chrome.action.setBadgeText({ text: '', tabId });
  }
});

chrome.tabs.onRemoved.addListener((tabId) => {
  chrome.storage.local.remove(storageKey(tabId));
});
