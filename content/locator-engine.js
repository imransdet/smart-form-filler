(function (global) {
  function matchString(value, pattern, mode) {
    if (!pattern) return false;
    const v = value || "";
    if (mode === "exact") return v.trim().toLowerCase() === pattern.trim().toLowerCase();
    if (mode === "regex") {
      try {
        return new RegExp(pattern, "i").test(v);
      } catch (e) {
        return false;
      }
    }
    return v.toLowerCase().includes(pattern.toLowerCase());
  }

  function isVisible(el) {
    if (!(el instanceof Element)) return false;
    const style = getComputedStyle(el);
    if (style.display === "none" || style.visibility === "hidden") return false;
    const rect = el.getBoundingClientRect();
    return rect.width > 0 || rect.height > 0;
  }

  function resolveLabelledBy(el) {
    const ids = (el.getAttribute("aria-labelledby") || "").split(/\s+/).filter(Boolean);
    return ids
      .map((id) => {
        const ref = document.getElementById(id);
        return ref ? ref.textContent.trim() : "";
      })
      .filter(Boolean)
      .join(" ");
  }

  function findWrappingLabel(el) {
    let node = el.parentElement;
    while (node) {
      if (node.tagName === "LABEL") return node;
      node = node.parentElement;
    }
    return null;
  }

  function labelTextFor(el) {
    const ariaLabel = el.getAttribute("aria-label");
    if (ariaLabel) return ariaLabel.trim();

    const labelledBy = resolveLabelledBy(el);
    if (labelledBy) return labelledBy;

    if (el.id) {
      const forLabel = document.querySelector(`label[for="${CSS.escape(el.id)}"]`);
      if (forLabel) return forLabel.textContent.trim();
    }

    const wrapping = findWrappingLabel(el);
    if (wrapping) {
      const clone = wrapping.cloneNode(true);
      clone.querySelectorAll("input, select, textarea, button").forEach((n) => n.remove());
      return clone.textContent.trim();
    }

    // Many real forms describe a field with a plain <span>/<div>/<td> instead of
    // a semantic <label>. Fall back to nearby text so "Label" still matches those.
    return nearbyText(el);
  }

  function implicitRole(el) {
    const explicit = el.getAttribute("role");
    if (explicit) return explicit.toLowerCase();
    const tag = el.tagName.toLowerCase();
    const type = (el.type || "").toLowerCase();
    if (tag === "textarea") return "textbox";
    if (tag === "select") return "combobox";
    if (tag === "button") return "button";
    if (tag === "input") {
      if (type === "checkbox") return "checkbox";
      if (type === "radio") return "radio";
      if (type === "number") return "spinbutton";
      if (type === "range") return "slider";
      if (type === "search") return "searchbox";
      return "textbox";
    }
    if (el.isContentEditable) return "textbox";
    return "generic";
  }

  function attributeString(el, settings) {
    const attrs = (settings && settings.matchAttributes) || {};
    const parts = [];
    if (attrs.id !== false) parts.push(el.id || "");
    if (attrs.name !== false) parts.push(el.getAttribute("name") || "");
    if (attrs.className !== false) parts.push(el.className || "");
    if (attrs.ariaLabel !== false) parts.push(el.getAttribute("aria-label") || "");
    if (attrs.placeholder !== false) parts.push(el.getAttribute("placeholder") || "");
    if (attrs.label !== false) parts.push(labelTextFor(el));
    return parts.filter(Boolean).join(" ");
  }

  function nearbyText(el) {
    const chunks = [];
    if (el.previousSibling && el.previousSibling.nodeType === Node.TEXT_NODE) {
      chunks.push(el.previousSibling.textContent.trim());
    }
    if (el.previousElementSibling && !["INPUT", "SELECT", "TEXTAREA"].includes(el.previousElementSibling.tagName)) {
      chunks.push(el.previousElementSibling.textContent.trim());
    }
    const parent = el.parentElement;
    if (parent) {
      const ownText = Array.from(parent.childNodes)
        .filter((n) => n.nodeType === Node.TEXT_NODE)
        .map((n) => n.textContent.trim())
        .filter(Boolean)
        .join(" ");
      if (ownText) chunks.push(ownText);
    }
    return chunks.filter(Boolean).join(" ");
  }

  function queryCss(selector) {
    try {
      return Array.from(document.querySelectorAll(selector));
    } catch (e) {
      return [];
    }
  }

  function queryXPath(expression) {
    try {
      const result = document.evaluate(expression, document, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
      const out = [];
      for (let i = 0; i < result.snapshotLength; i++) out.push(result.snapshotItem(i));
      return out;
    } catch (e) {
      return [];
    }
  }

  function findMatches(rule, candidates, settings) {
    const pattern = rule.matchValue || "";
    const mode = rule.matchMode || "contains";

    switch (rule.locatorType) {
      case "label":
        return candidates.filter((el) => matchString(labelTextFor(el), pattern, mode));

      case "placeholder":
        return candidates.filter((el) => matchString(el.getAttribute("placeholder") || "", pattern, mode));

      case "attribute":
        return candidates.filter((el) => matchString(attributeString(el, settings), pattern, mode));

      case "testId": {
        const attr = rule.testIdAttr || (settings && settings.testIdAttribute) || "data-testid";
        return candidates.filter((el) => matchString(el.getAttribute(attr) || "", pattern, mode));
      }

      case "text":
        return candidates.filter((el) => matchString(nearbyText(el), pattern, mode));

      case "role": {
        const candidateSet = new Set(candidates);
        const wantedRole = (pattern || "").trim().toLowerCase();
        return candidates.filter((el) => {
          if (!candidateSet.has(el)) return false;
          if (wantedRole && implicitRole(el) !== wantedRole) return false;
          if (rule.roleName) return matchString(labelTextFor(el), rule.roleName, mode);
          return true;
        });
      }

      case "css": {
        const set = new Set(candidates);
        return queryCss(pattern).filter((el) => set.has(el));
      }

      case "xpath": {
        const set = new Set(candidates);
        return queryXPath(pattern).filter((el) => set.has(el));
      }

      default:
        return [];
    }
  }

  global.FF = global.FF || {};
  global.FF.locatorEngine = {
    findMatches,
    labelTextFor,
    implicitRole,
    attributeString,
    isVisible,
  };
})(typeof window !== "undefined" ? window : self);
