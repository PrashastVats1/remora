# Remora — Privacy Policy

**Last updated: July 2026**

## Summary

Remora does not collect, transmit, or store any personal data. All processing happens locally in your browser. Nothing ever leaves your device.

## What Remora does

When you visit a web page, Remora scans the page's DOM (the underlying HTML structure) to detect hidden prompt injection attacks. This scan is performed entirely within your browser using locally bundled code.

## Data we do NOT collect

- We do not collect or transmit page content, URLs, or browsing history
- We do not collect personally identifiable information of any kind
- We do not use analytics, tracking pixels, or telemetry
- We do not communicate with any external server

## Local storage

Scan results (injection counts and types found on a page) are stored temporarily in Chrome's local storage (`chrome.storage.local`) so the extension popup can display them. This data:

- Never leaves your device
- Is automatically deleted when the tab closes or navigates away
- Contains no personally identifiable information — only structural metadata about the page (e.g. "2 hidden-element injections found")

## Permissions

| Permission | Why it's needed |
|---|---|
| `<all_urls>` | The extension must scan every page visited to detect injections. No page content is transmitted. |
| `storage` | Stores scan results per tab locally so the popup can display them. |
| `tabs` | Associates scan results with the correct tab and clears them on navigation or close. |
| `notifications` | Fires a desktop alert when an AI agent fails to acknowledge a detected injection within 30 seconds. |

## Contact

If you have questions about this privacy policy, open an issue at [github.com/PrashastVats1/remora/issues](https://github.com/PrashastVats1/remora/issues).
