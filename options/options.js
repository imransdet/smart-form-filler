import { renderCustomFields } from "../views/customFields.js";
import { renderSnippets } from "../views/snippets.js";
import { renderOptions } from "../views/options.js";
import { renderBackup } from "../views/backup.js";

const routes = {
  "/custom-fields": renderCustomFields,
  "/snippets": renderSnippets,
  "/options": renderOptions,
  "/backup": renderBackup,
};

const view = document.getElementById("view");
const tabs = document.getElementById("tabs");

function currentPath() {
  const hash = location.hash.replace(/^#/, "") || "/custom-fields";
  return routes[hash] ? hash : "/custom-fields";
}

async function render() {
  const path = currentPath();
  Array.from(tabs.querySelectorAll("a")).forEach((a) => {
    a.classList.toggle("active", a.dataset.route === path);
  });
  view.innerHTML = "";
  await routes[path](view);
}

window.addEventListener("hashchange", render);
render();
