// Known sites that trigger false positives in injection scanning.
// These domains are excluded from both injection scanning and domain blocking.
// Format: exact hostname or suffix match (e.g. "example.com" also covers "www.example.com").

export const ALLOWLIST: string[] = [
  'promptguard.co',
  'promptguard.com',
  'lakera.ai',
  'learnprompting.org',
  'simonwillison.net',      // security researcher — discusses injection heavily
  'gandalf.lakera.ai',      // prompt injection game
  'jailbreakchat.com',      // jailbreak research
];

export function isAllowlisted(hostname: string): boolean {
  return ALLOWLIST.some(
    (entry) => hostname === entry || hostname.endsWith(`.${entry}`)
  );
}
