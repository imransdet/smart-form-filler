import { getCustomFields } from "../shared/storage.js";
import { showToast } from "../shared/toast.js";

async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

function isFillableUrl(tab) {
  if (!tab || !tab.url) return false;
  return /^https?:|^file:/.test(tab.url);
}

export async function renderHome(container) {
  const customFields = await getCustomFields();
  const tab = await getActiveTab();
  const disabled = !isFillableUrl(tab);

  container.innerHTML = `
    <div class="fill-hero">
      <button class="btn btn-primary btn-block" id="fillAll" ${disabled ? "disabled" : ""}>Fill All Forms</button>
      <div class="btn-row" style="margin-top:8px;">
        <button class="btn" id="fillForm" ${disabled ? "disabled" : ""}>Fill This Form</button>
        <button class="btn" id="clearForm" ${disabled ? "disabled" : ""}>Clear Form</button>
      </div>
      <div class="count" id="resultCount"></div>
    </div>
    <h2 class="section-title">Status</h2>
    <div class="hint">
      ${customFields.length} custom field rule${customFields.length === 1 ? "" : "s"} configured.
      ${disabled ? "This page can't be filled by extensions." : "Right-click any field on the page for single-field actions."}
    </div>
  `;

  const resultCount = container.querySelector("#resultCount");

  async function run(fillAction, label) {
    if (!tab) return;
    resultCount.textContent = "Working…";
    const response = await chrome.runtime.sendMessage({ action: "broadcastFill", tabId: tab.id, fillAction });
    const filled = (response && response.filled) || 0;
    resultCount.textContent = `${label}: ${filled} field${filled === 1 ? "" : "s"}`;
    showToast(`${label} — ${filled} field${filled === 1 ? "" : "s"}`);
  }

  container.querySelector("#fillAll").addEventListener("click", () => run("fillAll", "Filled"));
  container.querySelector("#fillForm").addEventListener("click", () => run("fillForm", "Filled form"));
  container.querySelector("#clearForm").addEventListener("click", async () => {
    if (!tab) return;
    resultCount.textContent = "Working…";
    const response = await chrome.runtime.sendMessage({ action: "clearTab", tabId: tab.id });
    const cleared = (response && response.filled) || 0;
    resultCount.textContent = `Cleared: ${cleared} field${cleared === 1 ? "" : "s"}`;
    showToast(`Cleared ${cleared} field${cleared === 1 ? "" : "s"}`);
  });
}
