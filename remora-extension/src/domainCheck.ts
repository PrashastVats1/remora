// Two-tiered suspicious domain check.
// Tier 1: local regex patterns — instant, zero cost, catches brand impersonation.
// Tier 2: Google Safe Browsing API v4 — catches known phishing/malware sites.
// Results are cached per hostname for 24 hours to minimise API calls.

const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

// Embed your Google Safe Browsing API key here.
// Free tier: 10,000 queries/day. Exceeding it returns 429 — not billed.
// Move to a backend proxy later to keep the key private.
const SAFE_BROWSING_API_KEY: string = 'AIzaSyCEOsTOWFSPfxi3LZkqyjcv68U3LImRGfE';
const SAFE_BROWSING_URL =
  `https://safebrowsing.googleapis.com/v4/threatMatches:find?key=${SAFE_BROWSING_API_KEY}`;

// ─── Tier 1: local regex patterns ────────────────────────────────────────────

// Legitimate TLDs that popular brands use (used to spot fakes).
const KNOWN_BRANDS: [brand: string, pattern: RegExp][] = [
  ['paypal',    /paypa[^l]|pay-?pal\./i],
  ['apple',     /app[^l]e|app1e|app-le\./i],
  ['google',    /go{3,}gle|g00gle|g0ogle/i],
  ['amazon',    /amaz[0o]n|amaz-on/i],
  ['microsoft', /micros[o0]ft|m1crosoft/i],
  ['netflix',   /netfl[i1]x|net-?flix/i],
  ['facebook',  /faceb[o0]{2}k|face-?book/i],
  ['instagram', /instagr[a@]m/i],
  ['twitter',   /tw[i1]tter/i],
  ['linkedin',  /l[i1]nked[i1]n/i],
  ['dropbox',   /dr[o0]pbox/i],
  ['coinbase',  /c[o0][i1]nbase/i],
  ['binance',   /b[i1]nance/i],
  ['metamask',  /meta-?mask/i],
];

// Suspicious TLD patterns used in phishing.
const SUSPICIOUS_TLDS = /\.(xyz|top|club|online|site|info|tk|ml|ga|cf|gq|work|live|click|loan|win|cam|date|review|racing|download|stream|gdn|faith|bid|trade|accountant|science|party|cricket|webcam|trade|men)$/i;

// Homograph — non-ASCII characters that look like ASCII letters.
const HOMOGRAPH_RE = /[àáâãäåæçèéêëìíîïðñòóôõöùúûüýþÿαβγδεζηθικλμνξοπρστυφχψω]/i;

// Subdomain tricks: legitimate domain buried in subdomain (e.g. paypal.com.evil.xyz).
const SUBDOMAIN_TRICK_RE = /^(paypal|apple|google|amazon|microsoft|netflix|facebook|instagram|twitter|linkedin|dropbox|coinbase|binance|metamask)\./i;

function tier1Check(hostname: string): { flagged: boolean; reason: string } {
  // Skip bare IP addresses — not typosquatting targets.
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(hostname)) {
    return { flagged: false, reason: '' };
  }

  // Homograph attack
  if (HOMOGRAPH_RE.test(hostname)) {
    return { flagged: true, reason: 'Homograph domain — non-ASCII characters mimicking legitimate brand' };
  }

  // Brand impersonation patterns
  for (const [brand, re] of KNOWN_BRANDS) {
    if (re.test(hostname)) {
      return { flagged: true, reason: `Possible ${brand} impersonation` };
    }
  }

  // Suspicious TLD
  if (SUSPICIOUS_TLDS.test(hostname)) {
    return { flagged: true, reason: `Suspicious TLD used in phishing — ${hostname.split('.').pop()}` };
  }

  // Subdomain trick: paypal.com.attacker.xyz
  const parts = hostname.split('.');
  if (parts.length >= 3) {
    const sub = parts.slice(0, -2).join('.');
    if (SUBDOMAIN_TRICK_RE.test(sub + '.')) {
      return { flagged: true, reason: `Legitimate brand buried in subdomain — possible phishing` };
    }
  }

  // Excessive hyphens or numbers often indicate generated phishing domains
  const domainPart = parts.slice(-2, -1)[0] ?? '';
  if ((domainPart.match(/-/g) ?? []).length >= 3) {
    return { flagged: true, reason: 'Domain has excessive hyphens — common in generated phishing names' };
  }

  return { flagged: false, reason: '' };
}

// ─── Tier 2: Google Safe Browsing ────────────────────────────────────────────

async function tier2Check(
  url: string
): Promise<{ flagged: boolean; reason: string }> {
  if (!SAFE_BROWSING_API_KEY || SAFE_BROWSING_API_KEY === 'YOUR_GOOGLE_SAFE_BROWSING_API_KEY') {
    return { flagged: false, reason: '' };
  }

  try {
    const body = {
      client:    { clientId: 'remora-extension', clientVersion: '0.2.0' },
      threatInfo: {
        threatTypes:      ['MALWARE', 'SOCIAL_ENGINEERING', 'UNWANTED_SOFTWARE'],
        platformTypes:    ['ANY_PLATFORM'],
        threatEntryTypes: ['URL'],
        threatEntries:    [{ url }],
      },
    };

    const res = await fetch(SAFE_BROWSING_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!res.ok) return { flagged: false, reason: '' }; // Quota exceeded or error — fail open.

    const data = await res.json();
    if (data.matches && data.matches.length > 0) {
      const type = (data.matches[0].threatType as string) ?? 'threat';
      return { flagged: true, reason: `Google Safe Browsing: ${type.replace(/_/g, ' ').toLowerCase()}` };
    }
  } catch {
    // Network error — fail open.
  }

  return { flagged: false, reason: '' };
}

// ─── Cache helpers ────────────────────────────────────────────────────────────

interface CacheEntry {
  flagged: boolean;
  reason:  string;
  ts:      number;
}

async function getCached(hostname: string): Promise<CacheEntry | null> {
  const key = `rm_domain_${hostname}`;
  const stored = await chrome.storage.local.get(key);
  const entry = stored[key] as CacheEntry | undefined;
  if (!entry) return null;
  if (Date.now() - entry.ts > CACHE_TTL_MS) {
    await chrome.storage.local.remove(key);
    return null;
  }
  return entry;
}

async function setCached(hostname: string, entry: Omit<CacheEntry, 'ts'>): Promise<void> {
  const key = `rm_domain_${hostname}`;
  await chrome.storage.local.set({ [key]: { ...entry, ts: Date.now() } });
}

// ─── Public API ───────────────────────────────────────────────────────────────

export interface DomainCheckResult {
  flagged: boolean;
  reason:  string;
}

export async function checkDomain(url: string): Promise<DomainCheckResult> {
  let hostname: string;
  try {
    hostname = new URL(url).hostname;
  } catch {
    return { flagged: false, reason: '' };
  }

  // Check cache first
  const cached = await getCached(hostname);
  if (cached) return { flagged: cached.flagged, reason: cached.reason };

  // Tier 1 — local regex (synchronous, wrapped in async for uniformity)
  const t1 = tier1Check(hostname);
  if (t1.flagged) {
    await setCached(hostname, t1);
    return t1;
  }

  // Tier 2 — Google Safe Browsing
  const t2 = await tier2Check(url);
  await setCached(hostname, t2);
  return t2;
}
