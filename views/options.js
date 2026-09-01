import { getSettings, setSettings } from "../shared/storage.js";
import { showToast } from "../shared/toast.js";
import { escapeHtml } from "../shared/html.js";

function toggleRow(id, title, desc, checked) {
  return `
    <div class="toggle-row">
      <div class="toggle-text">
        <div class="title">${title}</div>
        ${desc ? `<div class="hint">${desc}</div>` : ""}
      </div>
      <label class="switch"><input type="checkbox" id="${id}" ${checked ? "checked" : ""} /><span class="slider"></span></label>
    </div>
  `;
}

export async function renderOptions(container) {
  const settings = await getSettings();

  container.innerHTML = `
    <h2 class="section-title">Passwords</h2>
    ${toggleRow("s_fixedPassword", "Use fixed password", "Fill all password fields with the same value instead of a random one.", settings.fillPasswordMode === "fixed")}
    <div class="form-row"><label>Fixed password value</label><input type="text" id="s_fixedPasswordValue" value="${escapeHtml(settings.fixedPasswordValue || "")}" /></div>

    <h2 class="section-title">Field selection</h2>
    ${toggleRow("s_ignoreHidden", "Ignore hidden fields", "Skip fields that aren't visible on the page.", settings.ignoreHiddenFields)}
    ${toggleRow("s_ignoreWithValue", "Don't overwrite filled fields", "Skip fields that already contain a value.", settings.ignoreFieldsWithValue)}
    <div class="form-row"><label>Ignore fields matching</label><input type="text" id="s_ignoreMatching" value="${escapeHtml(settings.ignoreFieldsMatching || "")}" placeholder="comma-separated, e.g. captcha, honeypot" /></div>

    <h2 class="section-title">Smart pairing</h2>
    <div class="form-row"><label>Confirmation fields matching</label><input type="text" id="s_confirmMatching" value="${escapeHtml(settings.confirmationFieldsMatching || "")}" />
      <div class="hint">Password/email fields matching this pattern are set equal to their sibling field.</div></div>
    <div class="form-row"><label>Agree-to-terms fields matching</label><input type="text" id="s_agreeMatching" value="${escapeHtml(settings.agreeTermsFieldsMatching || "")}" />
      <div class="hint">Checkboxes matching this pattern are always checked, not randomised.</div></div>

    <h2 class="section-title">Matching attributes</h2>
    <div class="hint" style="margin-bottom:6px;">Which attributes count toward Label/Attribute locator matching and the ignore-fields pattern.</div>
    <div class="two-col">
      ${["id", "name", "label", "ariaLabel", "placeholder", "className"]
        .map(
          (attr) =>
            `<label style="display:flex;align-items:center;gap:6px;margin-bottom:6px;"><input type="checkbox" class="matchAttr" data-attr="${attr}" ${settings.matchAttributes?.[attr] !== false ? "checked" : ""} /> ${attr}</label>`
        )
        .join("")}
    </div>
    <div class="form-row"><label>Test ID attribute</label><input type="text" id="s_testIdAttribute" value="${escapeHtml(settings.testIdAttribute || "data-testid")}" /></div>

    <h2 class="section-title">Framework compatibility</h2>
    ${toggleRow("s_dispatchInput", "Dispatch input events", "", settings.dispatchEvents?.input !== false)}
    ${toggleRow("s_dispatchChange", "Dispatch change events", "", settings.dispatchEvents?.change !== false)}
    ${toggleRow("s_dispatchBlur", "Dispatch blur/focusout events", "", settings.dispatchEvents?.blur !== false)}

    <h2 class="section-title">Snippets</h2>
    ${toggleRow("s_snippets", "Enable snippet shortcuts", "Typing a snippet's shortcut (configured on the Snippets tab) anywhere on a page instantly expands it to that snippet's value.", settings.enableSnippets !== false)}

    <h2 class="section-title">Fill feedback</h2>
    ${toggleRow("s_fillAnimation", "Flash filled fields", "Briefly highlight each field right after it's filled, so you can see exactly what changed.", settings.enableFillAnimation !== false)}
    ${toggleRow("s_fillSound", "Play a success sound", "A short chime when a fill or snippet expansion completes.", settings.enableFillSound !== false)}

    <h2 class="section-title">Floating button</h2>
    ${toggleRow("s_overlayButton", "Show floating Fill All Forms button", "A small round button on every page — click to fill, or drag it anywhere on screen. Its position is remembered.", settings.enableOverlayButton !== false)}

    <h2 class="section-title">Other</h2>
    <div class="form-row"><label>Default max length</label><input type="number" id="s_maxLength" value="${settings.defaultMaxLength ?? 100}" /></div>
    ${toggleRow("s_contextMenu", "Enable right-click context menu", "Adds Fill all / Fill this form / Fill this field to the right-click menu.", settings.enableContextMenu !== false)}
  `;

  async function save() {
    const attrs = {};
    container.querySelectorAll(".matchAttr").forEach((el) => {
      attrs[el.dataset.attr] = el.checked;
    });
    const updated = {
      ...settings,
      fillPasswordMode: container.querySelector("#s_fixedPassword").checked ? "fixed" : "random",
      fixedPasswordValue: container.querySelector("#s_fixedPasswordValue").value,
      ignoreHiddenFields: container.querySelector("#s_ignoreHidden").checked,
      ignoreFieldsWithValue: container.querySelector("#s_ignoreWithValue").checked,
      ignoreFieldsMatching: container.querySelector("#s_ignoreMatching").value,
      confirmationFieldsMatching: container.querySelector("#s_confirmMatching").value,
      agreeTermsFieldsMatching: container.querySelector("#s_agreeMatching").value,
      matchAttributes: attrs,
      testIdAttribute: container.querySelector("#s_testIdAttribute").value || "data-testid",
      dispatchEvents: {
        input: container.querySelector("#s_dispatchInput").checked,
        change: container.querySelector("#s_dispatchChange").checked,
        blur: container.querySelector("#s_dispatchBlur").checked,
      },
      defaultMaxLength: Number(container.querySelector("#s_maxLength").value) || 100,
      enableContextMenu: container.querySelector("#s_contextMenu").checked,
      enableSnippets: container.querySelector("#s_snippets").checked,
      enableFillAnimation: container.querySelector("#s_fillAnimation").checked,
      enableFillSound: container.querySelector("#s_fillSound").checked,
      enableOverlayButton: container.querySelector("#s_overlayButton").checked,
    };
    Object.assign(settings, updated);
    await setSettings(updated);
    showToast("Settings saved");
  }

  container.querySelectorAll("input").forEach((el) => {
    el.addEventListener("change", save);
  });
}
