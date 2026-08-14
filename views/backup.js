import { getAll, setSettings, setCustomFields, setSnippets, getMissingPresetFields } from "../shared/storage.js";
import { DEFAULT_SETTINGS } from "../shared/constants.js";
import { showToast } from "../shared/toast.js";

export async function renderBackup(container) {
  container.innerHTML = `
    <h2 class="section-title">Export</h2>
    <div class="hint" style="margin-bottom:8px;">Download your settings, custom field rules, and snippets as a JSON file.</div>
    <button class="btn btn-block" id="exportBtn">Export to JSON</button>

    <h2 class="section-title">Import</h2>
    <div class="hint" style="margin-bottom:8px;">Restore settings, custom fields, and snippets from a previously exported file. This overwrites your current configuration.</div>
    <input type="file" id="importInput" accept="application/json" style="display:none;" />
    <button class="btn btn-block" id="importBtn">Import from JSON</button>

    <h2 class="section-title">Reset</h2>
    <button class="btn btn-danger btn-block" id="resetBtn">Reset to defaults</button>
  `;

  container.querySelector("#exportBtn").addEventListener("click", async () => {
    const data = await getAll();
    const payload = { type: "smart-form-filler-backup", version: 1, ...data };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `smart-form-filler-backup-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast("Exported");
  });

  const fileInput = container.querySelector("#importInput");
  container.querySelector("#importBtn").addEventListener("click", () => fileInput.click());
  fileInput.addEventListener("change", async () => {
    const file = fileInput.files[0];
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      if (!parsed || typeof parsed !== "object" || !Array.isArray(parsed.customFields) || typeof parsed.settings !== "object") {
        throw new Error("Invalid backup file");
      }
      await setSettings({ ...DEFAULT_SETTINGS, ...parsed.settings });
      await setCustomFields(parsed.customFields);
      await setSnippets(Array.isArray(parsed.snippets) ? parsed.snippets : []);
      showToast("Imported successfully");
    } catch (e) {
      showToast("Import failed: invalid file", "error");
    } finally {
      fileInput.value = "";
    }
  });

  container.querySelector("#resetBtn").addEventListener("click", async () => {
    if (!confirm("Reset all settings and restore the default custom fields? Any custom fields or snippets you've added or edited will be removed.")) return;
    await setSettings({ ...DEFAULT_SETTINGS });
    await setCustomFields(getMissingPresetFields([]));
    await setSnippets([]);
    showToast("Reset to defaults");
  });
}
