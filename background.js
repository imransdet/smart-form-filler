import { getSettings, seedDefaultFieldsIfEmpty } from "./shared/storage.js";

const MENU_FILL_ALL = "ff-fill-all";
const MENU_FILL_FORM = "ff-fill-form";
const MENU_FILL_FIELD = "ff-fill-field";

async function syncContextMenus() {
  const settings = await getSettings();
  await chrome.contextMenus.removeAll();
  if (!settings.enableContextMenu) return;
  chrome.contextMenus.create({
    id: MENU_FILL_ALL,
    title: "Fill all inputs",
    contexts: ["page", "editable"],
  });
  chrome.contextMenus.create({
    id: MENU_FILL_FORM,
    title: "Fill this form",
    contexts: ["page", "editable"],
  });
  chrome.contextMenus.create({
    id: MENU_FILL_FIELD,
    title: "Fill this field",
    contexts: ["editable"],
  });
}

async function broadcastToTab(tabId, message) {
  let frames = [];
  try {
    frames = await chrome.webNavigation.getAllFrames({ tabId });
  } catch (e) {
    frames = [{ frameId: 0 }];
  }
  const responses = await Promise.all(
    frames.map((frame) =>
      chrome.tabs.sendMessage(tabId, message, { frameId: frame.frameId }).catch(() => null)
    )
  );
  return responses.reduce((sum, r) => sum + (r && r.filled ? r.filled : 0), 0);
}

chrome.runtime.onInstalled.addListener((details) => {
  syncContextMenus();
  if (details.reason === "install") {
    seedDefaultFieldsIfEmpty();
  }
});
chrome.runtime.onStartup.addListener(() => {
  syncContextMenus();
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && changes.ff_settings) {
    syncContextMenus();
  }
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (!tab || !tab.id) return;
  const actionByMenu = {
    [MENU_FILL_ALL]: "fillAll",
    [MENU_FILL_FORM]: "fillForm",
    [MENU_FILL_FIELD]: "fillField",
  };
  const action = actionByMenu[info.menuItemId];
  if (!action) return;
  if (action === "fillAll") {
    broadcastToTab(tab.id, { action });
  } else {
    chrome.tabs.sendMessage(tab.id, { action }, { frameId: info.frameId || 0 }).catch(() => {});
  }
});

chrome.commands.onCommand.addListener((command, tab) => {
  if (command === "fill-all-inputs" && tab && tab.id) {
    broadcastToTab(tab.id, { action: "fillAll" });
  }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // The popup knows its target tab explicitly; a content script (e.g. the on-page
  // overlay button) has no chrome.tabs access to look its own tab up, but Chrome
  // already attaches it as sender.tab for any message a content script sends.
  const tabId = (message && message.tabId) || (sender && sender.tab && sender.tab.id);
  if (message && message.action === "broadcastFill" && tabId) {
    broadcastToTab(tabId, { action: message.fillAction || "fillAll" }).then((filled) => {
      sendResponse({ filled });
    });
    return true;
  }
  if (message && message.action === "clearTab" && tabId) {
    broadcastToTab(tabId, { action: "clear" }).then((filled) => {
      sendResponse({ filled });
    });
    return true;
  }
  return undefined;
});
