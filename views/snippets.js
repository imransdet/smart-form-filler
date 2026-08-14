import { getSnippets, setSnippets, newFieldId } from "../shared/storage.js";
import { showToast } from "../shared/toast.js";
import { escapeHtml, sanitizeRichHtml } from "../shared/html.js";

const EDIT_ICON = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>`;
const DELETE_ICON = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/></svg>`;

const TOOLBAR_COMMANDS = [
  { cmd: "bold", label: "<b>B</b>", title: "Bold" },
  { cmd: "italic", label: "<i>I</i>", title: "Italic" },
  { cmd: "underline", label: "<u>U</u>", title: "Underline" },
  { cmd: "strikeThrough", label: "<s>S</s>", title: "Strikethrough" },
  { cmd: "insertUnorderedList", label: "&bull; List", title: "Bulleted list" },
  { cmd: "insertOrderedList", label: "1. List", title: "Numbered list" },
  { cmd: "removeFormat", label: "Clear", title: "Clear formatting" },
];

// Pure string handling (no innerHTML) — even a detached element can fire an
// <img onerror> during parsing, so untrusted/imported content never touches the DOM here.
function stripHtmlToText(html) {
  return (html || "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li)>/gi, "\n")
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .trim();
}

function editorHtml(snippet) {
  return `
    <div class="overlay" id="snippetEditorOverlay">
      <div class="overlay-header">
        <h3>${snippet.id ? "Edit Snippet" : "Add Snippet"}</h3>
        <button class="icon-btn" id="closeEditor">✕</button>
      </div>
      <div class="form-row"><label>Name</label><input type="text" id="s_name" value="${escapeHtml(snippet.name || "")}" placeholder="e.g. AUS phone number" /></div>
      <div class="form-row">
        <label>Shortcut (typed to insert)</label>
        <input type="text" id="s_shortcut" value="${escapeHtml(snippet.shortcut || "")}" placeholder="e.g. /mob" />
        <div class="hint">Type this anywhere on a page — in any field, or a rich text box — and it's instantly replaced with the value below.</div>
      </div>

      <div class="form-row">
        <label>Value</label>
        <div class="richtext-toolbar">
          ${TOOLBAR_COMMANDS.map((c) => `<button type="button" class="richtext-btn" data-cmd="${c.cmd}" title="${c.title}">${c.label}</button>`).join("")}
        </div>
        <div id="s_content" class="richtext-editor" contenteditable="true">${sanitizeRichHtml(snippet.content || "")}</div>
      </div>

      <div class="btn-row" style="margin-top:14px;">
        <button class="btn btn-primary" id="saveSnippet" style="flex:2;">Save Snippet</button>
        <button class="btn" id="cancelSnippet" style="flex:1;">Cancel</button>
      </div>
    </div>
  `;
}

function openEditor(root, snippet, onSave) {
  const wrapper = document.createElement("div");
  wrapper.innerHTML = editorHtml(snippet);
  root.appendChild(wrapper.firstElementChild);
  const overlay = root.querySelector("#snippetEditorOverlay");
  window.scrollTo({ top: 0, behavior: "auto" });

  const editor = overlay.querySelector("#s_content");
  overlay.querySelectorAll(".richtext-btn").forEach((btn) => {
    // Prevent the button from stealing focus, so the editor's current selection survives the click.
    btn.addEventListener("mousedown", (e) => e.preventDefault());
    btn.addEventListener("click", () => {
      document.execCommand(btn.dataset.cmd);
      editor.focus();
    });
  });

  function close() {
    overlay.remove();
  }
  overlay.querySelector("#closeEditor").addEventListener("click", close);
  overlay.querySelector("#cancelSnippet").addEventListener("click", close);

  overlay.querySelector("#saveSnippet").addEventListener("click", async () => {
    const name = overlay.querySelector("#s_name").value.trim() || "Untitled Snippet";
    const shortcut = overlay.querySelector("#s_shortcut").value.trim();
    if (!shortcut) {
      showToast("Shortcut is required", "error");
      return;
    }
    const updated = {
      ...snippet,
      name,
      shortcut,
      content: sanitizeRichHtml(editor.innerHTML.trim()),
    };
    const saveBtn = overlay.querySelector("#saveSnippet");
    saveBtn.disabled = true;
    try {
      await onSave(updated);
      close();
      showToast(`Saved "${name}"`);
    } catch (e) {
      saveBtn.disabled = false;
      showToast("Save failed — see console for details", "error");
      console.error("Smart Form Filler: failed to save snippet", e);
    }
  });
}

export async function renderSnippets(container) {
  let snippets = await getSnippets();
  let searchQuery = "";

  function badge(text, cls) {
    return `<span class="badge ${cls || ""}">${text}</span>`;
  }

  function matchesSearch(snippet, query) {
    if (!query) return true;
    const haystack = [snippet.name, snippet.shortcut, stripHtmlToText(snippet.content)].join(" ").toLowerCase();
    return haystack.includes(query);
  }

  function renderList() {
    const query = searchQuery.trim().toLowerCase();
    const visible = snippets.map((snippet, index) => ({ snippet, index })).filter(({ snippet }) => matchesSearch(snippet, query));

    if (!snippets.length) {
      container.querySelector("#snippetList").innerHTML = `<div class="empty-state">No snippets yet.<br />Add one and type its shortcut anywhere on a page to expand it.</div>`;
      return;
    }
    if (!visible.length) {
      container.querySelector("#snippetList").innerHTML = `<div class="empty-state">No snippets match "${escapeHtml(searchQuery)}".</div>`;
      return;
    }
    container.querySelector("#snippetList").innerHTML = visible
      .map(({ snippet, index }) => {
        const preview = stripHtmlToText(snippet.content).slice(0, 60);
        return `
        <div class="field-row" draggable="true" data-index="${index}">
          <span class="drag-handle">⠿</span>
          <div class="field-main">
            <div class="field-name">${escapeHtml(snippet.name)}</div>
            <div class="badges">${badge(escapeHtml(snippet.shortcut), "trigger")}</div>
            ${preview ? `<div class="hint" style="margin-top:3px;">${escapeHtml(preview)}</div>` : ""}
          </div>
          <div class="field-actions">
            <label class="switch"><input type="checkbox" class="toggleEnabled" data-index="${index}" ${snippet.enabled !== false ? "checked" : ""} /><span class="slider"></span></label>
            <button class="icon-btn editSnippet" data-index="${index}" title="Edit">${EDIT_ICON}</button>
            <button class="icon-btn deleteSnippet" data-index="${index}" title="Delete">${DELETE_ICON}</button>
          </div>
        </div>`;
      })
      .join("");
    wireRowEvents();
  }

  async function persist() {
    await setSnippets(snippets);
  }

  let draggedIndex = null;
  function wireRowEvents() {
    const list = container.querySelector("#snippetList");
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
        const [moved] = snippets.splice(draggedIndex, 1);
        snippets.splice(targetIndex, 0, moved);
        draggedIndex = null;
        await persist();
        renderList();
      });
    });
    list.querySelectorAll(".toggleEnabled").forEach((el) => {
      el.addEventListener("change", async () => {
        const idx = Number(el.dataset.index);
        snippets[idx].enabled = el.checked;
        await persist();
      });
    });
    list.querySelectorAll(".editSnippet").forEach((el) => {
      el.addEventListener("click", () => {
        const idx = Number(el.dataset.index);
        openEditor(container, snippets[idx], async (updated) => {
          snippets[idx] = updated;
          await persist();
          renderList();
        });
      });
    });
    list.querySelectorAll(".deleteSnippet").forEach((el) => {
      el.addEventListener("click", async () => {
        const idx = Number(el.dataset.index);
        if (!confirm(`Delete "${snippets[idx].name}"?`)) return;
        snippets.splice(idx, 1);
        await persist();
        renderList();
      });
    });
  }

  container.innerHTML = `
    <div class="btn-row">
      <button class="btn btn-primary btn-sm" id="addSnippet" style="flex:1;">+ Add Snippet</button>
      <input type="text" id="searchInput" class="search-input" placeholder="🔍 Search by name, shortcut, or content…" style="flex:1;" />
    </div>
    <div class="field-list" id="snippetList" style="margin-top:10px;"></div>
  `;
  renderList();

  const searchInput = container.querySelector("#searchInput");
  searchInput.focus();
  searchInput.addEventListener("input", () => {
    searchQuery = searchInput.value;
    renderList();
  });

  container.querySelector("#addSnippet").addEventListener("click", () => {
    const blank = {
      id: newFieldId(),
      name: "",
      enabled: true,
      shortcut: "",
      content: "",
    };
    openEditor(container, blank, async (created) => {
      snippets.unshift(created);
      await persist();
      renderList();
    });
  });
}
