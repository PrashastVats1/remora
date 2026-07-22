/**
 * Walks the DOM tree depth-first, yielding each Element once.
 * Uses a WeakSet to guard against cycles (e.g. shadow-root re-entry).
 */
export function* walkElements(root: Document | Element): Generator<Element> {
  const visited = new WeakSet<Element>();
  const queue: Element[] = [];

  // nodeType 9 = DOCUMENT_NODE — use nodeType to avoid cross-realm instanceof failure
  const startEl = root.nodeType === 9
    ? (root as Document).documentElement
    : (root as Element);
  if (startEl) queue.push(startEl);

  while (queue.length > 0) {
    const el = queue.pop()!;
    if (visited.has(el)) continue;
    visited.add(el);
    yield el;
    // Push children in reverse so left-most child is processed first.
    for (let i = el.children.length - 1; i >= 0; i--) {
      queue.push(el.children[i]);
    }
  }
}

/**
 * Returns all attribute key/value pairs for an element as a plain record.
 */
export function elementAttributes(el: Element): Record<string, string> {
  const attrs: Record<string, string> = {};
  for (let i = 0; i < el.attributes.length; i++) {
    const attr = el.attributes[i];
    attrs[attr.name] = attr.value;
  }
  return attrs;
}

/**
 * Builds a short CSS selector path to an element (up to 3 ancestors deep).
 * Useful for highlighting elements in a UI.
 */
export function selectorPath(el: Element): string {
  const parts: string[] = [];
  let current: Element | null = el;

  while (current && parts.length < 4) {
    let part = current.tagName.toLowerCase();
    if (current.id) {
      part += `#${current.id}`;
    } else if (current.className && typeof current.className === 'string') {
      const first = current.className.trim().split(/\s+/)[0];
      if (first) part += `.${first}`;
    }
    parts.unshift(part);
    current = current.parentElement;
  }

  return parts.join(' > ');
}
