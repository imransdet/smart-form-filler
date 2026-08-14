import { renderHome } from "../views/home.js";

const view = document.getElementById("view");

document.getElementById("openSettings").addEventListener("click", () => {
  // tabs.create avoids openOptionsPage() silently no-op'ing on a stale manifest cache.
  chrome.tabs.create({ url: chrome.runtime.getURL("options/options.html") });
});

renderHome(view);
