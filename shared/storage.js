import { DEFAULT_SETTINGS, DEFAULT_CUSTOM_FIELDS, DEFAULT_FIELD_PRESETS, DEFAULT_SNIPPETS, STORAGE_KEYS } from "./constants.js";

export async function getSettings() {
  const stored = await chrome.storage.local.get(STORAGE_KEYS.settings);
  return { ...DEFAULT_SETTINGS, ...(stored[STORAGE_KEYS.settings] || {}) };
}

export async function setSettings(settings) {
  await chrome.storage.local.set({ [STORAGE_KEYS.settings]: settings });
}

export async function getCustomFields() {
  const stored = await chrome.storage.local.get(STORAGE_KEYS.customFields);
  return stored[STORAGE_KEYS.customFields] || DEFAULT_CUSTOM_FIELDS;
}

export async function setCustomFields(customFields) {
  await chrome.storage.local.set({ [STORAGE_KEYS.customFields]: customFields });
}

export async function getSnippets() {
  const stored = await chrome.storage.local.get(STORAGE_KEYS.snippets);
  return stored[STORAGE_KEYS.snippets] || DEFAULT_SNIPPETS;
}

export async function setSnippets(snippets) {
  await chrome.storage.local.set({ [STORAGE_KEYS.snippets]: snippets });
}

export async function getAll() {
  const [settings, customFields, snippets] = await Promise.all([getSettings(), getCustomFields(), getSnippets()]);
  return { settings, customFields, snippets };
}

export function newFieldId() {
  return `f_${Math.random().toString(36).slice(2, 10)}_${Math.random().toString(36).slice(2, 6)}`;
}

export function getMissingPresetFields(existingFields) {
  const have = new Set((existingFields || []).map((f) => f.presetKey).filter(Boolean));
  return DEFAULT_FIELD_PRESETS.filter((preset) => !have.has(preset.presetKey)).map((preset) => ({
    ...preset,
    id: newFieldId(),
    enabled: true,
  }));
}

export async function seedDefaultFieldsIfEmpty() {
  const existing = await getCustomFields();
  if (existing.length) return existing;
  const seeded = getMissingPresetFields([]);
  await setCustomFields(seeded);
  return seeded;
}
