(function (global) {
  const FILLABLE_SELECTOR = [
    "input:not([type=hidden]):not([type=file]):not([type=button]):not([type=submit]):not([type=reset]):not([type=image])",
    "textarea",
    "select",
    "[contenteditable=''], [contenteditable='true']",
  ].join(", ");

  const COMBOBOX_TRIGGER_SELECTOR = '[role="combobox"], [aria-haspopup="listbox"]';

  function comboboxTriggerFor(el) {
    return (el.closest && el.closest(COMBOBOX_TRIGGER_SELECTOR)) || null;
  }

  function hasExistingValue(el) {
    if (el.tagName === "SELECT") return el.selectedIndex > 0 && !!el.value;
    if (el.type === "checkbox" || el.type === "radio") return el.checked;
    if (el.isContentEditable) return el.textContent.trim() !== "";
    return (el.value || "").trim() !== "";
  }

  function csvToPatterns(csv) {
    return (csv || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  }

  function matchesAnyPattern(el, csv, settings) {
    const patterns = csvToPatterns(csv);
    if (!patterns.length) return false;
    const haystack = global.FF.locatorEngine.attributeString(el, settings).toLowerCase();
    return patterns.some((p) => haystack.includes(p.toLowerCase()));
  }

  function getFillableElements(settings, root) {
    const scope = root || document;
    const all = Array.from(scope.querySelectorAll(FILLABLE_SELECTOR));
    return all.filter((el) => {
      if (el.disabled) return false;
      // A combobox's own input is often marked readonly (typing isn't how you interact
      // with it) but is still fillable by clicking it open and clicking an option.
      if (el.readOnly && !comboboxTriggerFor(el)) return false;
      if (settings.ignoreHiddenFields && !global.FF.locatorEngine.isVisible(el)) return false;
      if (settings.ignoreFieldsWithValue && hasExistingValue(el)) return false;
      if (matchesAnyPattern(el, settings.ignoreFieldsMatching, settings)) return false;
      return true;
    });
  }

  global.FF = global.FF || {};
  global.FF.fieldScanner = {
    FILLABLE_SELECTOR,
    getFillableElements,
    hasExistingValue,
    matchesAnyPattern,
    csvToPatterns,
    comboboxTriggerFor,
  };
})(typeof window !== "undefined" ? window : self);
