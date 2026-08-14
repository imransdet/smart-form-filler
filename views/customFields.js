import { getCustomFields, setCustomFields, newFieldId } from "../shared/storage.js";
import { LOCATOR_TYPES, MATCH_MODES, ARIA_ROLES, DATA_TYPES } from "../shared/constants.js";
import { showToast } from "../shared/toast.js";
import { optionsHtml, dataOptionsFields, readDataOptions } from "./dataTypeEditor.js";
import { escapeHtml } from "../shared/html.js";

const NEEDS_MATCH_MODE = new Set(["label", "placeholder", "attribute", "text", "testId"]);

const EDIT_ICON = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>`;
const DELETE_ICON = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/></svg>`;

function editorHtml(rule) {
  const locatorType = rule.locatorType || "label";

  return `
    <div class="overlay" id="editorOverlay">
      <div class="overlay-header">
        <h3>${rule.id ? "Edit Custom Field" : "Add Custom Field"}</h3>
        <button class="icon-btn" id="closeEditor">✕</button>
      </div>
      <div class="form-row"><label>Name</label><input type="text" id="f_name" value="${escapeHtml(rule.name || "")}" placeholder="e.g. Work Email" /></div>

      <div class="form-row">
        <label>Locator Type</label>
        <select id="f_locatorType">${optionsHtml(LOCATOR_TYPES, locatorType)}</select>
        <div class="hint" id="locatorHint"></div>
      </div>

      <div id="matchValueWrap"></div>

      <h2 class="section-title">Value to fill</h2>
      <div class="form-row">
        <label>Data Type</label>
        <select id="f_dataType">${optionsHtml(DATA_TYPES, rule.dataType || "text")}</select>
      </div>
      <div id="dataOptionsWrap"></div>

      <div class="btn-row" style="margin-top:14px;">
        <button class="btn btn-primary" id="saveField" style="flex:2;">Save Field</button>
        <button class="btn" id="cancelField" style="flex:1;">Cancel</button>
      </div>
    </div>
  `;
}

const LOCATOR_HINTS = {
  label: "Matches a field's associated <label>, aria-label, or aria-labelledby text.",
  placeholder: "Matches the field's placeholder text.",
  css: "A CSS selector, e.g. #email or input[name='email'].",
  xpath: "An XPath expression, e.g. //input[@name='email'].",
  role: "Matches the field's ARIA role (like Playwright getByRole), optionally filtered by accessible name.",
  testId: "Matches a data-testid attribute (like Playwright getByTestId).",
  text: "Matches visible text near the field (like Playwright getByText).",
  attribute: "Regex against the field's id, name, and class combined (classic Fake Filler style).",
};

function matchValueHtml(rule) {
  const locatorType = rule.locatorType || "label";
  if (locatorType === "role") {
    return `
      <div class="form-row"><label>Role</label><select id="f_matchValue">${optionsHtml(ARIA_ROLES, rule.matchValue)}</select></div>
      <div class="form-row"><label>Accessible name contains (optional)</label><input type="text" id="f_roleName" value="${escapeHtml(rule.roleName || "")}" /></div>
    `;
  }
  if (locatorType === "css" || locatorType === "xpath") {
    return `<div class="form-row"><label>${locatorType === "css" ? "CSS Selector" : "XPath Expression"}</label>
      <input type="text" id="f_matchValue" value="${escapeHtml(rule.matchValue || "")}" /></div>`;
  }
  const matchModeSelect = NEEDS_MATCH_MODE.has(locatorType)
    ? `<div class="form-row"><label>Match Mode</label><select id="f_matchMode">${optionsHtml(MATCH_MODES, rule.matchMode || "contains")}</select></div>`
    : "";
  const testIdExtra =
    locatorType === "testId"
      ? `<div class="form-row"><label>Attribute name (optional override)</label><input type="text" id="f_testIdAttr" value="${escapeHtml(rule.testIdAttr || "")}" placeholder="data-testid" /></div>`
      : "";
  return `
    <div class="form-row"><label>Match Value</label><input type="text" id="f_matchValue" value="${escapeHtml(rule.matchValue || "")}" /></div>
    ${matchModeSelect}
    ${testIdExtra}
  `;
}

function openEditor(root, rule, onSave) {
  const wrapper = document.createElement("div");
  wrapper.innerHTML = editorHtml(rule);
  root.appendChild(wrapper.firstElementChild);
  const overlay = root.querySelector("#editorOverlay");
  window.scrollTo({ top: 0, behavior: "auto" });

  // Re-rendering a section (e.g. on Locator Type change) must not discard values the
  // user already typed into it — so capture the live DOM into `draft` first and use
  // that as the basis for the next render, instead of reverting to the original `rule`.
  const draft = { ...rule };

  function captureMatchValueDom() {
    const mv = overlay.querySelector("#f_matchValue");
    if (mv) draft.matchValue = mv.value;
    const mm = overlay.querySelector("#f_matchMode");
    if (mm) draft.matchMode = mm.value;
    const rn = overlay.querySelector("#f_roleName");
    if (rn) draft.roleName = rn.value;
    const ti = overlay.querySelector("#f_testIdAttr");
    if (ti) draft.testIdAttr = ti.value;
  }

  function refreshMatchValue() {
    captureMatchValueDom();
    draft.locatorType = overlay.querySelector("#f_locatorType").value;
    overlay.querySelector("#locatorHint").textContent = LOCATOR_HINTS[draft.locatorType] || "";
    overlay.querySelector("#matchValueWrap").innerHTML = matchValueHtml(draft);
  }

  function refreshDataOptions() {
    if (overlay.querySelector("#dataOptionsWrap").children.length) {
      // Merge rather than replace: switching data type A -> B -> A must not lose A's
      // fields just because B's field set doesn't include them.
      draft.dataOptions = { ...draft.dataOptions, ...readDataOptions(draft.dataType, overlay) };
    }
    draft.dataType = overlay.querySelector("#f_dataType").value;
    overlay.querySelector("#dataOptionsWrap").innerHTML = dataOptionsFields(draft.dataType, draft.dataOptions);
  }

  refreshMatchValue();
  refreshDataOptions();

  overlay.querySelector("#f_locatorType").addEventListener("change", refreshMatchValue);
  overlay.querySelector("#f_dataType").addEventListener("change", refreshDataOptions);

  function close() {
    overlay.remove();
  }
  overlay.querySelector("#closeEditor").addEventListener("click", close);
  overlay.querySelector("#cancelField").addEventListener("click", close);

  overlay.querySelector("#saveField").addEventListener("click", async () => {
    const locatorType = overlay.querySelector("#f_locatorType").value;
    const dataType = overlay.querySelector("#f_dataType").value;
    const name = overlay.querySelector("#f_name").value.trim() || "Untitled Field";
    const matchValueEl = overlay.querySelector("#f_matchValue");
    const matchValue = matchValueEl ? matchValueEl.value.trim() : "";
    if (!matchValue) {
      showToast("Match value is required", "error");
      return;
    }
    const updated = {
      ...rule,
      name,
      locatorType,
      matchValue,
      matchMode: overlay.querySelector("#f_matchMode")?.value || rule.matchMode || "contains",
      roleName: overlay.querySelector("#f_roleName")?.value.trim() || "",
      testIdAttr: overlay.querySelector("#f_testIdAttr")?.value.trim() || "",
      dataType,
      dataOptions: readDataOptions(dataType, overlay),
    };
    const saveBtn = overlay.querySelector("#saveField");
    saveBtn.disabled = true;
    try {
      await onSave(updated);
      close();
      showToast(`Saved "${name}"`);
    } catch (e) {
      saveBtn.disabled = false;
      showToast("Save failed — see console for details", "error");
      console.error("Smart Form Filler: failed to save custom field", e);
    }
  });
}

export async function renderCustomFields(container) {
  let fields = await getCustomFields();
  let searchQuery = "";

  function badge(text, cls) {
    return `<span class="badge ${cls || ""}">${text}</span>`;
  }

  function matchesSearch(rule, query) {
    if (!query) return true;
    const locatorLabel = LOCATOR_TYPES.find((l) => l.value === rule.locatorType)?.label || rule.locatorType;
    const dataLabel = DATA_TYPES.find((d) => d.value === rule.dataType)?.label || rule.dataType;
    const haystack = [rule.name, rule.matchValue, locatorLabel, dataLabel].join(" ").toLowerCase();
    return haystack.includes(query);
  }

  function renderList() {
    const query = searchQuery.trim().toLowerCase();
    const visible = fields.map((rule, index) => ({ rule, index })).filter(({ rule }) => matchesSearch(rule, query));

    if (!fields.length) {
      container.querySelector("#fieldList").innerHTML = `<div class="empty-state">No custom fields yet.<br />Add one to match by label, placeholder, CSS, XPath, role, test id, text, or attribute.</div>`;
      return;
    }
    if (!visible.length) {
      container.querySelector("#fieldList").innerHTML = `<div class="empty-state">No custom fields match "${escapeHtml(searchQuery)}".</div>`;
      return;
    }
    container.querySelector("#fieldList").innerHTML = visible
      .map(({ rule, index }) => {
        const locatorLabel = LOCATOR_TYPES.find((l) => l.value === rule.locatorType)?.label || rule.locatorType;
        const dataLabel = DATA_TYPES.find((d) => d.value === rule.dataType)?.label || rule.dataType;
        return `
        <div class="field-row" draggable="true" data-index="${index}">
          <span class="drag-handle">⠿</span>
          <div class="field-main">
            <div class="field-name">${escapeHtml(rule.name)}</div>
            <div class="badges">${badge(locatorLabel, "locator")}${badge(dataLabel)}</div>
          </div>
          <div class="field-actions">
            <label class="switch"><input type="checkbox" class="toggleEnabled" data-index="${index}" ${rule.enabled !== false ? "checked" : ""} /><span class="slider"></span></label>
            <button class="icon-btn editField" data-index="${index}" title="Edit">${EDIT_ICON}</button>
            <button class="icon-btn deleteField" data-index="${index}" title="Delete">${DELETE_ICON}</button>
          </div>
        </div>`;
      })
      .join("");
    wireRowEvents();
  }

  async function persist() {
    await setCustomFields(fields);
  }

  let draggedIndex = null;
  function wireRowEvents() {
    const list = container.querySelector("#fieldList");
    list.querySelectorAll(".field-row").forEach((row) => {
      row.addEventListener("dragstart", () => {
        draggedIndex = Number(row.dataset.index);
        row.classList.add("dragging");
      });
      row.addEventListener("dragend", () => row.classList.remove("dragging"));
      row.addEventListener("dragover", (e) => e.preventDefault());
      row.addEventListener("drop", async (e) => {
        e.preventDefault();
        const targetIndex = Number(row.dataset.index);
        if (draggedIndex === null || draggedIndex === targetIndex) return;
        const [moved] = fields.splice(draggedIndex, 1);
        fields.splice(targetIndex, 0, moved);
        draggedIndex = null;
        await persist();
        renderList();
      });
    });
    list.querySelectorAll(".toggleEnabled").forEach((el) => {
      el.addEventListener("change", async () => {
        const idx = Number(el.dataset.index);
        fields[idx].enabled = el.checked;
        await persist();
      });
    });
    list.querySelectorAll(".editField").forEach((el) => {
      el.addEventListener("click", () => {
        const idx = Number(el.dataset.index);
        openEditor(container, fields[idx], async (updated) => {
          fields[idx] = updated;
          await persist();
          renderList();
        });
      });
    });
    list.querySelectorAll(".deleteField").forEach((el) => {
      el.addEventListener("click", async () => {
        const idx = Number(el.dataset.index);
        if (!confirm(`Delete "${fields[idx].name}"?`)) return;
        fields.splice(idx, 1);
        await persist();
        renderList();
      });
    });
  }

  container.innerHTML = `
    <div class="btn-row">
      <button class="btn btn-primary btn-sm" id="addField" style="flex:1;">+ Add Custom Field</button>
      <input type="text" id="searchInput" class="search-input" placeholder="🔍 Search by name, match value, locator, or data type…" style="flex:1;" />
    </div>
    <div class="field-list" id="fieldList" style="margin-top:10px;"></div>
  `;
  renderList();

  const searchInput = container.querySelector("#searchInput");
  searchInput.focus();
  searchInput.addEventListener("input", () => {
    searchQuery = searchInput.value;
    renderList();
  });

  container.querySelector("#addField").addEventListener("click", () => {
    const blank = {
      id: newFieldId(),
      name: "",
      enabled: true,
      locatorType: "label",
      matchValue: "",
      matchMode: "contains",
      dataType: "text",
      dataOptions: {},
    };
    openEditor(container, blank, async (created) => {
      fields.unshift(created);
      await persist();
      renderList();
    });
  });
}
