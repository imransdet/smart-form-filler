(function () {
  const stateCache = window.FF.stateCache;

  function setNativeValue(el, value) {
    const proto = Object.getPrototypeOf(el);
    const descriptor = Object.getOwnPropertyDescriptor(proto, "value");
    if (descriptor && descriptor.set) {
      descriptor.set.call(el, value);
    } else {
      el.value = value;
    }
  }

  function safeSelectionStart(el) {
    try {
      return el.selectionStart;
    } catch (e) {
      return null;
    }
  }

  function findShortcutMatch(textBeforeCaret, snippets) {
    let best = null;
    (snippets || []).forEach((snippet) => {
      if (snippet.enabled === false) return;
      const shortcut = (snippet.shortcut || "").trim();
      if (!shortcut) return;
      if (textBeforeCaret.endsWith(shortcut) && (!best || shortcut.length > best.shortcut.length)) {
        best = { snippet, shortcut };
      }
    });
    return best;
  }

  // Plain fields can only take plain text, so rich formatting is flattened —
  // <br>/block closes become newlines so multi-line content isn't collapsed.
  // Pure string handling (no innerHTML) — even a detached element can fire an
  // <img onerror> during parsing, so untrusted HTML never touches the DOM here.
  function contentAsPlainText(html) {
    return (html || "")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/(p|div|li)>/gi, "\n")
      .replace(/<[^>]*>/g, "")
      .replace(/&nbsp;/gi, " ")
      .replace(/&amp;/gi, "&")
      .replace(/&lt;/gi, "<")
      .replace(/&gt;/gi, ">")
      .replace(/&quot;/gi, '"')
      .replace(/&#39;/gi, "'");
  }

  const ALLOWED_RICH_TAGS = new Set(["B", "I", "U", "S", "STRONG", "EM", "UL", "OL", "LI", "BR"]);

  // A snippet is about to be inserted into whatever page the user is on — sanitize
  // its stored HTML first (whitelist tags, strip all attributes) so an imported or
  // tampered snippet can never carry a script/handler onto a site the user visits.
  function sanitizeRichHtml(html) {
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
    return template.content;
  }

  function expandInInputLike(el) {
    const settings = stateCache.getSettings();
    if (!settings || settings.enableSnippets === false) return;
    const caret = safeSelectionStart(el);
    if (typeof caret !== "number") return;

    const before = el.value.slice(0, caret);
    const match = findShortcutMatch(before, stateCache.getSnippets());
    if (!match) return;

    const prefix = el.value.slice(0, caret - match.shortcut.length);
    const suffix = el.value.slice(caret);
    const replacement = contentAsPlainText(match.snippet.content);

    setNativeValue(el, prefix + replacement + suffix);
    const newCaret = prefix.length + replacement.length;
    el.setSelectionRange(newCaret, newCaret);
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));

    if (settings.enableFillAnimation !== false) window.FF.feedback.flashElement(el);
    if (settings.enableFillSound !== false) window.FF.feedback.playSuccessSound();
  }

  function expandInContentEditable() {
    const settings = stateCache.getSettings();
    if (!settings || settings.enableSnippets === false) return;
    const selection = window.getSelection();
    if (!selection || !selection.rangeCount) return;
    const range = selection.getRangeAt(0);
    if (!range.collapsed || range.startContainer.nodeType !== Node.TEXT_NODE) return;

    const node = range.startContainer;
    const before = node.textContent.slice(0, range.startOffset);
    const match = findShortcutMatch(before, stateCache.getSnippets());
    if (!match) return;

    const replaceRange = document.createRange();
    replaceRange.setStart(node, range.startOffset - match.shortcut.length);
    replaceRange.setEnd(node, range.startOffset);
    replaceRange.deleteContents();

    // A rich-text host gets the snippet's actual formatting (bold/italic/lists/...);
    // parse it into real, sanitized nodes rather than inserting the shortcut's own text node.
    const fragment = sanitizeRichHtml(match.snippet.content);
    const lastNode = fragment.lastChild;
    replaceRange.insertNode(fragment);

    const after = document.createRange();
    if (lastNode) {
      after.setStartAfter(lastNode);
    } else {
      after.setStart(replaceRange.startContainer, replaceRange.startOffset);
    }
    after.collapse(true);
    selection.removeAllRanges();
    selection.addRange(after);

    const host = node.parentElement;
    if (host) host.dispatchEvent(new Event("input", { bubbles: true }));

    if (settings.enableFillAnimation !== false) window.FF.feedback.flashElement(host);
    if (settings.enableFillSound !== false) window.FF.feedback.playSuccessSound();
  }

  document.addEventListener(
    "input",
    (event) => {
      const el = event.target;
      if (!el) return;
      if (el.tagName === "INPUT" || el.tagName === "TEXTAREA") {
        expandInInputLike(el);
      } else if (el.isContentEditable) {
        expandInContentEditable();
      }
    },
    true
  );
})();
