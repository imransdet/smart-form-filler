import { escapeHtml } from "../shared/html.js";

export function optionsHtml(list, selected) {
  return list
    .map((o) => {
      const value = typeof o === "string" ? o : o.value;
      const label = typeof o === "string" ? o : o.label;
      return `<option value="${escapeHtml(value)}" ${value === selected ? "selected" : ""}>${escapeHtml(label)}</option>`;
    })
    .join("");
}

export function dataOptionsFields(dataType, opts) {
  const o = opts || {};
  switch (dataType) {
    case "static":
      return `<div class="form-row"><label>Value</label><input type="text" id="opt_value" value="${escapeHtml(o.value || "")}" /></div>`;
    case "text":
      return `<div class="two-col">
        <div class="form-row"><label>Min words</label><input type="number" id="opt_minWords" value="${escapeHtml(o.minWords ?? 4)}" min="1" /></div>
        <div class="form-row"><label>Max words</label><input type="number" id="opt_maxWords" value="${escapeHtml(o.maxWords ?? 12)}" min="1" /></div>
      </div>`;
    case "alphanumeric":
      return `<div class="form-row"><label>Template</label><input type="text" id="opt_template" value="${escapeHtml(o.template || "AAA-####")}" />
        <div class="hint"># = digit, ? = uppercase letter, @ = lowercase letter, * = alphanumeric, other chars are literal.</div></div>`;
    case "number":
      return `<div class="two-col">
        <div class="form-row"><label>Min</label><input type="number" id="opt_min" value="${escapeHtml(o.min ?? 0)}" /></div>
        <div class="form-row"><label>Max</label><input type="number" id="opt_max" value="${escapeHtml(o.max ?? 1000)}" /></div>
      </div>
      <div class="form-row"><label>Decimal places</label><input type="number" id="opt_decimals" value="${escapeHtml(o.decimals ?? 0)}" min="0" /></div>`;
    case "date":
      return `<div class="two-col">
        <div class="form-row"><label>Min (days from today)</label><input type="number" id="opt_minDays" value="${escapeHtml(o.minDays ?? -365)}" /></div>
        <div class="form-row"><label>Max (days from today)</label><input type="number" id="opt_maxDays" value="${escapeHtml(o.maxDays ?? 365)}" /></div>
      </div>`;
    case "password":
      return `<div class="toggle-row">
          <div class="toggle-text"><div class="title">Use fixed value</div></div>
          <label class="switch"><input type="checkbox" id="opt_fixed" ${o.fixed ? "checked" : ""} /><span class="slider"></span></label>
        </div>
        <div class="form-row"><label>Fixed value</label><input type="text" id="opt_fixedValue" value="${escapeHtml(o.fixedValue || "")}" /></div>`;
    case "telephone":
      return `<div class="form-row"><label>Template</label><input type="text" id="opt_template" value="${escapeHtml(o.template || "04## ### ###")}" />
        <div class="hint"># = digit, other characters are literal.</div></div>`;
    case "email": {
      const usernameSource = o.usernameSource || "random";
      const hostnameSource = o.hostnameSource || "random";
      const usernameRadio = (value, label) =>
        `<label class="radio-option"><input type="radio" name="opt_usernameSource" value="${value}" ${usernameSource === value ? "checked" : ""} /> ${label}</label>`;
      const hostnameRadio = (value, label) =>
        `<label class="radio-option"><input type="radio" name="opt_hostnameSource" value="${value}" ${hostnameSource === value ? "checked" : ""} /> ${label}</label>`;
      return `
        <div class="form-row"><label>Username Prefix</label><input type="text" id="opt_usernamePrefix" value="${escapeHtml(o.usernamePrefix || "")}" placeholder="e.g. alimran+" /></div>
        <div class="form-row">
          <label>Username</label>
          <div class="radio-group">
            ${usernameRadio("previousUsername", "Use a previously generated username")}
            ${usernameRadio("previousName", "Use a previously generated first and last name")}
            ${usernameRadio("random", "Use a random name")}
            ${usernameRadio("list", "Select from the list below (comma separated)")}
          </div>
          <textarea id="opt_usernameList" placeholder="jack, jill">${escapeHtml((o.usernameList || []).join(", "))}</textarea>
          <div class="radio-group" style="margin-top:6px;">
            ${usernameRadio("regex", "A regular expression")}
          </div>
          <input type="text" id="opt_usernameRegex" value="${escapeHtml(o.usernameRegex || "")}" placeholder="[a-z]{5,8}[0-9]{2}" />
        </div>
        <div class="form-row">
          <label>Hostname</label>
          <div class="radio-group">
            ${hostnameRadio("random", "Use a randomly generated host name")}
            ${hostnameRadio("list", "Select from the list below")}
          </div>
          <textarea id="opt_hostnameList" placeholder="example.com, mail.example.com">${escapeHtml((o.hostnameList || []).join(", "))}</textarea>
          <div class="hint">List each host with a comma. You may include the @ sign as well.</div>
        </div>
      `;
    }
    case "list":
      return `<div class="form-row"><label>Values (one per line)</label><textarea id="opt_values">${escapeHtml((o.values || []).join("\n"))}</textarea></div>`;
    case "regex":
      return `<div class="form-row"><label>Regular expression</label><input type="text" id="opt_pattern" value="${escapeHtml(o.pattern || "")}" />
        <div class="hint">Supports literals, [ranges], \\d \\w \\s, *, +, ?, {n,m}, (groups|alternation).</div></div>`;
    default:
      return `<div class="hint">No extra options for this data type.</div>`;
  }
}

export function readDataOptions(dataType, root) {
  const val = (id) => {
    const el = root.querySelector(`#${id}`);
    return el ? el.value : "";
  };
  switch (dataType) {
    case "static":
      return { value: val("opt_value") };
    case "text":
      return { minWords: Number(val("opt_minWords")) || 4, maxWords: Number(val("opt_maxWords")) || 12 };
    case "alphanumeric":
      return { template: val("opt_template") || "AAA-####" };
    case "number":
      return {
        min: Number(val("opt_min")) || 0,
        max: Number(val("opt_max")) || 1000,
        decimals: Number(val("opt_decimals")) || 0,
      };
    case "date":
      return { minDays: Number(val("opt_minDays")) || -365, maxDays: Number(val("opt_maxDays")) || 365 };
    case "password":
      return { fixed: !!root.querySelector("#opt_fixed")?.checked, fixedValue: val("opt_fixedValue") };
    case "telephone":
      return { template: val("opt_template") || "04## ### ###" };
    case "email":
      return {
        usernamePrefix: val("opt_usernamePrefix"),
        usernameSource: root.querySelector('input[name="opt_usernameSource"]:checked')?.value || "random",
        usernameList: val("opt_usernameList").split(",").map((s) => s.trim()).filter(Boolean),
        usernameRegex: val("opt_usernameRegex"),
        hostnameSource: root.querySelector('input[name="opt_hostnameSource"]:checked')?.value || "random",
        hostnameList: val("opt_hostnameList").split(",").map((s) => s.trim()).filter(Boolean),
      };
    case "list":
      return { values: val("opt_values").split("\n").map((s) => s.trim()).filter(Boolean) };
    case "regex":
      return { pattern: val("opt_pattern") };
    default:
      return {};
  }
}
