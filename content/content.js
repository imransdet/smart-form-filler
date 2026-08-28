(function () {
  const { locatorEngine, dataGenerator, fieldScanner } = window.FF;

  let lastContextElement = null;

  document.addEventListener(
    "contextmenu",
    (event) => {
      const el = event.target;
      if (el && el.closest && el.closest(fieldScanner.FILLABLE_SELECTOR)) {
        lastContextElement = el.closest(fieldScanner.FILLABLE_SELECTOR);
      } else {
        lastContextElement = null;
      }
    },
    true
  );

  function dateKindFor(el) {
    const type = (el.type || "").toLowerCase();
    if (["date", "datetime-local", "month", "week", "time"].includes(type)) return type;
    return "date";
  }

  function dispatchEvents(el, settings) {
    const cfg = settings.dispatchEvents || {};
    if (cfg.input !== false) el.dispatchEvent(new Event("input", { bubbles: true }));
    if (cfg.change !== false) el.dispatchEvent(new Event("change", { bubbles: true }));
    if (cfg.blur !== false) {
      el.dispatchEvent(new Event("blur"));
      el.dispatchEvent(new Event("focusout", { bubbles: true }));
    }
  }

  // React (and similar frameworks) shadow the native value/checked/selected setters on
  // controlled-input instances to track changes. Assigning through that shadow leaves
  // their internal tracker in sync, so the framework thinks nothing changed and never
  // fires onChange — the field silently reverts on the next render. Calling the setter
  // from the prototype bypasses the shadow so the framework detects a real change.
  function setNativeProp(el, prop, value) {
    const proto = Object.getPrototypeOf(el);
    const descriptor = Object.getOwnPropertyDescriptor(proto, prop);
    if (descriptor && descriptor.set) {
      descriptor.set.call(el, value);
    } else {
      el[prop] = value;
    }
  }

  function setSelectValue(el, desiredValue) {
    const options = Array.from(el.options).filter((o) => !o.disabled && o.value !== "");
    if (!options.length) return;
    let chosen = null;
    if (desiredValue) {
      chosen = options.find(
        (o) => o.value.toLowerCase() === String(desiredValue).toLowerCase() ||
          o.textContent.trim().toLowerCase() === String(desiredValue).toLowerCase()
      );
    }
    if (el.multiple) {
      const pool = chosen ? [chosen] : options;
      const count = chosen ? 1 : dataGenerator.randInt(1, Math.min(3, pool.length));
      const shuffled = [...pool].sort(() => Math.random() - 0.5);
      const picks = new Set(shuffled.slice(0, count));
      Array.from(el.options).forEach((o) => {
        setNativeProp(o, "selected", picks.has(o));
      });
      return;
    }
    const target = chosen || dataGenerator.pick(options);
    setNativeProp(el, "value", target.value);
  }

  function setCheckbox(el, forceChecked) {
    const shouldCheck = typeof forceChecked === "boolean" ? forceChecked : Math.random() < 0.5;
    setNativeProp(el, "checked", shouldCheck);
  }

  // Many modern component libraries (Ant Design, MUI, react-select, Radix, ...) render a
  // "dropdown" as a text input plus a floating popup of clickable options, with no native
  // <select> anywhere. There's no value to set — the only way in is to click it open and
  // click the option, the same way a real user or Playwright would.
  function simulateClick(el) {
    // Many custom widgets nest their real click handler on a different element than
    // whatever a CSS selector matches (an inner label span, a virtualized row wrapper,
    // ...). Hit-testing the actual screen point — like a real click — finds whatever
    // element is truly on top there, so the event lands on the right node even when
    // our selector only found a nearby one. Only trust the hit if it's actually related
    // to `el` (ancestor/descendant/self), so an unrelated overlapping element can't hijack it.
    const rect = el.getBoundingClientRect();
    const x = rect.left + rect.width / 2;
    const y = rect.top + rect.height / 2;
    let target = el;
    if (typeof document.elementFromPoint === "function") {
      const hit = document.elementFromPoint(x, y);
      if (hit && (hit === el || el.contains(hit) || hit.contains(el))) {
        target = hit;
      }
    }

    const base = { bubbles: true, cancelable: true, view: window, clientX: x, clientY: y };
    ["pointerdown", "mousedown", "pointerup", "mouseup", "click"].forEach((type) => {
      const Ctor = type.startsWith("pointer") && typeof PointerEvent === "function" ? PointerEvent : MouseEvent;
      try {
        target.dispatchEvent(new Ctor(type, base));
      } catch (e) {
        target.dispatchEvent(new MouseEvent(type, base));
      }
    });
  }

  function queryListboxOptions() {
    const scoped = Array.from(document.querySelectorAll('[role="listbox"] [role="option"]'));
    const pool = scoped.length
      ? scoped
      : Array.from(
          document.querySelectorAll(
            '.ant-select-item-option, .ant-select-dropdown [role="option"], .MuiAutocomplete-option, [role="listbox"] li'
          )
        );
    return pool.filter((o) => locatorEngine.isVisible(o));
  }

  async function waitForListboxOptions(timeoutMs) {
    const deadline = Date.now() + (timeoutMs || 1500);
    while (Date.now() < deadline) {
      const options = queryListboxOptions();
      if (options.length) return options;
      await new Promise((resolve) => setTimeout(resolve, 40));
    }
    return [];
  }

  async function fillComboboxOption(trigger, desiredText) {
    simulateClick(trigger);
    const options = await waitForListboxOptions();
    if (!options.length) return false;
    let target = null;
    if (desiredText) {
      const wanted = String(desiredText).trim().toLowerCase();
      target =
        options.find((o) => o.textContent.trim().toLowerCase() === wanted) ||
        options.find((o) => o.textContent.trim().toLowerCase().includes(wanted));
    }
    if (!target) target = dataGenerator.pick(options);

    simulateClick(target);
    await new Promise((resolve) => setTimeout(resolve, 80));

    // The popup usually closes once a selection registers. If it's still open, the
    // click likely didn't land as a real "select" — try a couple of other ways a
    // widget might expect that interaction before giving up.
    if (queryListboxOptions().length) {
      target.click();
      await new Promise((resolve) => setTimeout(resolve, 80));
    }
    if (queryListboxOptions().length) {
      const kb = { bubbles: true, cancelable: true, key: "Enter", code: "Enter" };
      target.dispatchEvent(new KeyboardEvent("keydown", kb));
      target.dispatchEvent(new KeyboardEvent("keyup", kb));
    }
    return true;
  }

  function maybeFlash(el, settings) {
    if (settings.enableFillAnimation !== false) window.FF.feedback.flashElement(el);
  }

  // Small built-in word lists (25 first names, 20 last names, ...) mean a page with
  // several similar fields has a real chance of independently rolling the same value
  // twice — e.g. 4 "First Name" fields have roughly a 1-in-4 chance of a random
  // collision. "static" (and a fixed password) are the only cases where repeating on
  // purpose is correct; everything else gets a few retries against what's already
  // been used elsewhere in this same fill pass before falling back to the last roll.
  // "Middle Name" draws from the exact same word list as "First Name" (see
  // data-generator.js) — dedup them as one pool, or a First Name + Middle Name pair
  // for the same person could still both land on e.g. "Grace" while every *other*
  // field type stays correctly unique.
  const DEDUP_POOL_KEY = { middleName: "firstName" };

  function generateUnique(dataType, dataOptions, kind, usedValues) {
    if (dataType === "static" || (dataType === "password" && dataOptions && dataOptions.fixed)) {
      return dataGenerator.generate(dataType, dataOptions, kind);
    }
    const poolKey = DEDUP_POOL_KEY[dataType] || dataType;
    const seen = usedValues.get(poolKey) || new Set();
    if (!usedValues.has(poolKey)) usedValues.set(poolKey, seen);
    let value;
    for (let attempt = 0; attempt < 15; attempt++) {
      value = dataGenerator.generate(dataType, dataOptions, kind);
      if (!value || !seen.has(value.toLowerCase())) break;
    }
    if (value) seen.add(value.toLowerCase());
    return value;
  }

  // DOM tree-distance between two elements (edge count via their lowest common
  // ancestor) — used to find "the nearest actual name field on the page" for an
  // email's "use the generated name" option. No magic thresholds: it always finds
  // whichever recorded name field is genuinely closest to this specific email field,
  // so it works the same whether a repeated section has 3 fields or 30.
  function ancestorChain(el) {
    const chain = [];
    let node = el;
    while (node) {
      chain.push(node);
      node = node.parentElement;
    }
    return chain;
  }

  function domDistance(a, b) {
    const chainA = ancestorChain(a);
    const indexInB = new Map(ancestorChain(b).map((node, i) => [node, i]));
    for (let i = 0; i < chainA.length; i++) {
      if (indexInB.has(chainA[i])) return i + indexInB.get(chainA[i]);
    }
    return Infinity;
  }

  function nearestRecordValue(el, dataType, nameRecords) {
    let best = null;
    let bestDist = Infinity;
    for (const rec of nameRecords) {
      if (rec.dataType !== dataType) continue;
      const dist = domDistance(el, rec.el);
      if (dist < bestDist) {
        bestDist = dist;
        best = rec;
      }
    }
    return best ? best.value : null;
  }

  function fillRadioGroup(radios, settings, matchedElement) {
    const target = matchedElement || dataGenerator.pick(radios);
    radios.forEach((r) => {
      setNativeProp(r, "checked", r === target);
    });
    dispatchEvents(target, settings);
    maybeFlash(target, settings);
  }

  // An email field set to "use a previously generated name/username" gets the actual
  // resolved value injected here (see nearestRecordValue above) instead of inventing
  // its own independent one.
  function resolveDataOptions(el, dataType, dataOptions, nameRecords) {
    if (dataType !== "email" || !dataOptions) return dataOptions;
    if (dataOptions.usernameSource === "previousName") {
      const resolvedFirstName = nearestRecordValue(el, "firstName", nameRecords);
      const resolvedLastName = nearestRecordValue(el, "lastName", nameRecords);
      if (resolvedFirstName && resolvedLastName) return { ...dataOptions, resolvedFirstName, resolvedLastName };
    } else if (dataOptions.usernameSource === "previousUsername") {
      const resolvedUsername = nearestRecordValue(el, "username", nameRecords);
      if (resolvedUsername) return { ...dataOptions, resolvedUsername };
    }
    return dataOptions;
  }

  function recordNameValue(el, dataType, value, nameRecords) {
    if (value && (dataType === "firstName" || dataType === "lastName" || dataType === "username")) {
      nameRecords.push({ el, dataType, value });
    }
  }

  async function applyValue(el, dataType, dataOptions, settings, usedValues, nameRecords) {
    const tag = el.tagName;
    const effectiveOptions = resolveDataOptions(el, dataType, dataOptions, nameRecords);
    const comboTrigger = tag !== "SELECT" && fieldScanner.comboboxTriggerFor(el);
    if (comboTrigger) {
      const kind = dateKindFor(el);
      const desiredText = dataType ? generateUnique(dataType, effectiveOptions, kind, usedValues) : "";
      recordNameValue(el, dataType, desiredText, nameRecords);
      const handled = await fillComboboxOption(comboTrigger, desiredText);
      if (handled) {
        maybeFlash(comboTrigger, settings);
        return;
      }
      // No popup ever appeared (not actually this kind of widget) — fall through and
      // try filling it like a normal field instead of leaving it untouched.
    }
    if (tag === "SELECT") {
      const value = dataType ? generateUnique(dataType, effectiveOptions, null, usedValues) : null;
      recordNameValue(el, dataType, value, nameRecords);
      setSelectValue(el, value);
      dispatchEvents(el, settings);
      maybeFlash(el, settings);
      return;
    }
    if (el.type === "checkbox") {
      // Not deduped: this is only ever coerced to a true/false checked state below,
      // so "reusing" a raw value across checkboxes has no meaning to avoid.
      const raw = dataType ? dataGenerator.generate(dataType, effectiveOptions, null) : undefined;
      const forced = raw === undefined ? undefined : /^(true|1|yes|checked|on)$/i.test(String(raw));
      setCheckbox(el, forced);
      dispatchEvents(el, settings);
      maybeFlash(el, settings);
      return;
    }
    if (el.isContentEditable) {
      const value = generateUnique(dataType || "text", effectiveOptions, null, usedValues);
      recordNameValue(el, dataType, value, nameRecords);
      el.textContent = value;
      dispatchEvents(el, settings);
      maybeFlash(el, settings);
      return;
    }
    const kind = dateKindFor(el);
    let value = generateUnique(dataType, effectiveOptions, kind, usedValues);
    recordNameValue(el, dataType, value, nameRecords);
    if (el.maxLength && el.maxLength > 0 && value.length > el.maxLength) {
      value = value.slice(0, el.maxLength);
    }
    setNativeProp(el, "value", value);
    dispatchEvents(el, settings);
    maybeFlash(el, settings);
  }

  function defaultDataTypeFor(el, settings) {
    const tag = el.tagName;
    const type = (el.type || "text").toLowerCase();
    if (tag === "SELECT") return [null, {}];
    if (tag === "TEXTAREA") return ["text", { minWords: 8, maxWords: 20 }];
    if (el.isContentEditable) return ["text", { minWords: 6, maxWords: 14 }];
    switch (type) {
      case "email":
        return ["email", {}];
      case "tel":
        return ["telephone", {}];
      case "url":
        return ["url", {}];
      case "number": {
        const min = el.min !== "" ? Number(el.min) : 0;
        const max = el.max !== "" ? Number(el.max) : min + 1000;
        const decimals = el.step && el.step.includes(".") ? el.step.split(".")[1].length : 0;
        return ["number", { min, max, decimals }];
      }
      case "range": {
        const min = el.min !== "" ? Number(el.min) : 0;
        const max = el.max !== "" ? Number(el.max) : 100;
        return ["number", { min, max, decimals: 0 }];
      }
      case "color":
        return ["color", {}];
      case "checkbox":
        return [null, {}];
      case "password":
        return ["password", { fixed: settings.fillPasswordMode === "fixed", fixedValue: settings.fixedPasswordValue }];
      case "date":
      case "datetime-local":
      case "month":
      case "week":
      case "time":
        return ["date", {}];
      case "search":
        return ["text", { minWords: 1, maxWords: 2 }];
      default:
        return ["text", { minWords: 1, maxWords: 3 }];
    }
  }

  function handleAgreeTerms(el, settings) {
    if (el.type !== "checkbox") return false;
    if (fieldScanner.matchesAnyPattern(el, settings.agreeTermsFieldsMatching, settings)) {
      setCheckbox(el, true);
      dispatchEvents(el, settings);
      maybeFlash(el, settings);
      return true;
    }
    return false;
  }

  function syncConfirmationFields(elements, settings) {
    const patterns = fieldScanner.csvToPatterns(settings.confirmationFieldsMatching);
    if (!patterns.length) return;
    const formIds = new WeakMap();
    let formCounter = 0;
    function formKeyPart(el) {
      const formRef = el.form || document;
      if (!formIds.has(formRef)) formIds.set(formRef, `g${formCounter++}`);
      return formIds.get(formRef);
    }
    const forms = new Map();
    elements.forEach((el) => {
      const type = (el.type || el.tagName).toLowerCase();
      if (!["password", "email"].includes(type)) return;
      const key = `${formKeyPart(el)}_${type}`;
      if (!forms.has(key)) forms.set(key, []);
      forms.get(key).push(el);
    });
    forms.forEach((group) => {
      if (group.length !== 2) return;
      const [a, b] = group;
      const aIsConfirm = fieldScanner.matchesAnyPattern(a, settings.confirmationFieldsMatching, settings);
      const bIsConfirm = fieldScanner.matchesAnyPattern(b, settings.confirmationFieldsMatching, settings);
      if (aIsConfirm && !bIsConfirm) {
        setNativeProp(a, "value", b.value);
        dispatchEvents(a, settings);
      } else if (bIsConfirm && !aIsConfirm) {
        setNativeProp(b, "value", a.value);
        dispatchEvents(b, settings);
      }
    });
  }

  async function fillElements(elements, settings, customFields) {
    const pool = elements.filter((el) => el.type !== "radio");

    const formIds = new WeakMap();
    let formCounter = 0;
    function radioGroupKey(el) {
      const formRef = el.form || document;
      if (!formIds.has(formRef)) formIds.set(formRef, `g${formCounter++}`);
      return `${formIds.get(formRef)}_${el.name}`;
    }

    const radiosByGroup = new Map();
    elements
      .filter((el) => el.type === "radio")
      .forEach((el) => {
        const key = radioGroupKey(el);
        if (!radiosByGroup.has(key)) radiosByGroup.set(key, []);
        radiosByGroup.get(key).push(el);
      });

    const claimed = new Set();
    let unclaimedPool = pool.slice();
    const radioMatched = new Map();

    // Page-wide so two similar fields anywhere on the page (not just within one
    // "section") can't collide with each other.
    const usedValues = new Map();
    // Every First/Last/Username value generated this pass, so an email field's "use
    // the generated name" option can look up its nearest real match (see
    // nearestRecordValue / resolveDataOptions above) instead of relying on a cache.
    const nameRecords = [];

    const enabledRules = (customFields || []).filter((rule) => rule.enabled !== false);
    for (const rule of enabledRules) {
      const radioCandidates = [];
      radiosByGroup.forEach((radios) => radios.forEach((r) => radioCandidates.push(r)));
      const allUnclaimedRadios = radioCandidates.filter((r) => !claimed.has(r));
      const matches = locatorEngine.findMatches(rule, [...unclaimedPool, ...allUnclaimedRadios], settings);
      for (const el of matches) {
        if (claimed.has(el)) continue;
        claimed.add(el);
        if (el.type === "radio") {
          radioMatched.set(radioGroupKey(el), el);
        } else {
          await applyValue(el, rule.dataType, rule.dataOptions, settings, usedValues, nameRecords);
        }
      }
      unclaimedPool = unclaimedPool.filter((el) => !claimed.has(el));
    }

    for (const el of unclaimedPool) {
      if (handleAgreeTerms(el, settings)) continue;
      const [dataType, dataOptions] = defaultDataTypeFor(el, settings);
      await applyValue(el, dataType, dataOptions, settings, usedValues, nameRecords);
    }

    radiosByGroup.forEach((radios, key) => {
      fillRadioGroup(radios, settings, radioMatched.get(key));
    });

    syncConfirmationFields(elements, settings);

    // One chime per fill pass rather than per field — filling 30 fields shouldn't play 30 dings.
    if (settings.enableFillSound !== false && elements.length > 0) {
      window.FF.feedback.playSuccessSound();
    }

    return elements.length;
  }

  function clearElements(elements) {
    elements.forEach((el) => {
      if (el.tagName === "SELECT") {
        Array.from(el.options).forEach((o) => setNativeProp(o, "selected", false));
      } else if (el.type === "checkbox" || el.type === "radio") {
        setNativeProp(el, "checked", false);
      } else if (el.isContentEditable) {
        el.textContent = "";
      } else {
        setNativeProp(el, "value", "");
      }
      el.dispatchEvent(new Event("input", { bubbles: true }));
      el.dispatchEvent(new Event("change", { bubbles: true }));
    });
    return elements.length;
  }

  function scopeFromTarget(target) {
    if (target && target.closest) {
      const form = target.closest("form");
      if (form) return form;
    }
    return document;
  }

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (!message || !message.action) return;

    chrome.storage.local.get(["ff_settings", "ff_customFields"], async (stored) => {
      const settings = Object.assign(
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
          enableFillAnimation: true,
          enableFillSound: true,
        },
        stored.ff_settings || {}
      );
      const customFields = stored.ff_customFields || [];

      let result = { filled: 0 };
      switch (message.action) {
        case "fillAll": {
          const elements = fieldScanner.getFillableElements(settings, document);
          result.filled = await fillElements(elements, settings, customFields);
          break;
        }
        case "fillForm": {
          const scope = scopeFromTarget(lastContextElement);
          const elements = fieldScanner.getFillableElements(settings, scope);
          result.filled = await fillElements(elements, settings, customFields);
          break;
        }
        case "fillField": {
          if (lastContextElement) {
            const elements = [lastContextElement];
            result.filled = await fillElements(elements, settings, customFields);
          }
          break;
        }
        case "clear": {
          const elements = fieldScanner.getFillableElements(
            Object.assign({}, settings, { ignoreHiddenFields: false, ignoreFieldsWithValue: false }),
            document
          );
          result.filled = clearElements(elements);
          break;
        }
        default:
          break;
      }
      sendResponse(result);
    });

    return true;
  });
})();
