(function (global) {
  let settings = null;
  let customFields = null;
  let snippets = null;
  const listeners = [];

  function withDefaults(raw) {
    return Object.assign(
      {
        ignoreHiddenFields: true,
        ignoreFieldsWithValue: false,
        ignoreFieldsMatching: "",
        confirmationFieldsMatching: "confirm,repeat,verify",
        agreeTermsFieldsMatching: "agree,accept,terms,tos",
        matchAttributes: { id: true, name: true, label: true, ariaLabel: true, placeholder: true, className: false },
        testIdAttribute: "data-testid",
        dispatchEvents: { input: true, change: true, blur: true },
        fillPasswordMode: "random",
        fixedPasswordValue: "",
        enableSnippets: true,
        enableFillAnimation: true,
        enableFillSound: true,
        enableOverlayButton: true,
      },
      raw || {}
    );
  }

  function refresh() {
    chrome.storage.local.get(["ff_settings", "ff_customFields", "ff_snippets"], (stored) => {
      settings = withDefaults(stored.ff_settings);
      customFields = stored.ff_customFields || [];
      snippets = stored.ff_snippets || [];
      listeners.forEach((fn) => fn());
    });
  }

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "local" && (changes.ff_settings || changes.ff_customFields || changes.ff_snippets)) refresh();
  });

  refresh();

  global.FF = global.FF || {};
  global.FF.stateCache = {
    getSettings: () => settings,
    getCustomFields: () => customFields || [],
    getSnippets: () => snippets || [],
    onChange: (fn) => listeners.push(fn),
  };
})(typeof window !== "undefined" ? window : self);
