export function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const ALLOWED_RICH_TAGS = new Set(["B", "I", "U", "S", "STRONG", "EM", "UL", "OL", "LI", "BR"]);

// Whitelist-based: unwrap (drop the tag, keep children) anything not on the list,
// and strip every attribute from what remains — a snippet's rich text should never
// carry event handlers, hrefs, or anything else capable of running script.
export function sanitizeRichHtml(html) {
  const template = document.createElement("template");
  template.innerHTML = html || "";
  const walker = document.createTreeWalker(template.content, NodeFilter.SHOW_ELEMENT);
  const toUnwrap = [];
  let node = walker.nextNode();
  while (node) {
    const next = walker.nextNode();
    if (!ALLOWED_RICH_TAGS.has(node.tagName)) {
      toUnwrap.push(node);
    } else {
      Array.from(node.attributes).forEach((attr) => node.removeAttribute(attr.name));
    }
    node = next;
  }
  toUnwrap.forEach((el) => {
    const parent = el.parentNode;
    while (el.firstChild) parent.insertBefore(el.firstChild, el);
    parent.removeChild(el);
  });
  return template.innerHTML;
}
