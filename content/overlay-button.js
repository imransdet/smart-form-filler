(function () {
  if (window.top !== window) return; // one button per page, not one per iframe

  const stateCache = window.FF.stateCache;

  const POSITION_KEY = "ff_overlay_position";
  const SIZE = 52;
  const MARGIN = 16;

  let hostEl = null;
  let buttonEl = null;
  let dragging = false;
  let moved = false;
  let startX = 0;
  let startY = 0;
  let startLeft = 0;
  let startTop = 0;

  function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
  }

  function applyPosition(left, top) {
    const maxLeft = Math.max(MARGIN, window.innerWidth - SIZE - MARGIN);
    const maxTop = Math.max(MARGIN, window.innerHeight - SIZE - MARGIN);
    const clampedLeft = clamp(left, MARGIN, maxLeft);
    const clampedTop = clamp(top, MARGIN, maxTop);
    hostEl.style.left = `${clampedLeft}px`;
    hostEl.style.top = `${clampedTop}px`;
    return { left: clampedLeft, top: clampedTop };
  }

  function savePosition(left, top) {
    try {
      chrome.storage.local.set({ [POSITION_KEY]: { left, top } });
    } catch (e) {
      // Extension context can go away on navigation mid-drag — safe to ignore.
    }
  }

  function loadPosition() {
    chrome.storage.local.get(POSITION_KEY, (stored) => {
      const saved = stored[POSITION_KEY];
      if (saved && typeof saved.left === "number" && typeof saved.top === "number") {
        applyPosition(saved.left, saved.top);
      } else {
        applyPosition(window.innerWidth - SIZE - MARGIN, window.innerHeight - SIZE - MARGIN);
      }
    });
  }

  function triggerFill() {
    buttonEl.style.transform = "scale(0.9)";
    setTimeout(() => {
      buttonEl.style.transform = "scale(1)";
    }, 150);
    chrome.runtime.sendMessage({ action: "broadcastFill", fillAction: "fillAll" });
  }

  function onPointerMove(event) {
    if (!dragging) return;
    const dx = event.clientX - startX;
    const dy = event.clientY - startY;
    if (Math.abs(dx) > 4 || Math.abs(dy) > 4) moved = true;
    applyPosition(startLeft + dx, startTop + dy);
  }

  function onPointerUp(event) {
    if (!dragging) return;
    dragging = false;
    buttonEl.style.cursor = "grab";
    buttonEl.removeEventListener("pointermove", onPointerMove);
    try {
      buttonEl.releasePointerCapture(event.pointerId);
    } catch (e) {
      // Not critical — the listener is already removed either way.
    }
    const rect = hostEl.getBoundingClientRect();
    if (moved) {
      savePosition(rect.left, rect.top);
    } else {
      triggerFill();
    }
  }

  function onPointerDown(event) {
    if (event.button !== undefined && event.button !== 0) return; // left click/primary touch only
    dragging = true;
    moved = false;
    startX = event.clientX;
    startY = event.clientY;
    const rect = hostEl.getBoundingClientRect();
    startLeft = rect.left;
    startTop = rect.top;
    buttonEl.style.cursor = "grabbing";
    try {
      buttonEl.setPointerCapture(event.pointerId);
    } catch (e) {
      // Pointer capture isn't universally implemented — dragging still works via the
      // pointermove listener below, capture just makes it more reliable when it exists.
    }
    buttonEl.addEventListener("pointermove", onPointerMove);
    event.preventDefault();
  }

  function createButton() {
    // A shadow root keeps the host page's CSS from leaking in (or ours leaking out) —
    // injected floating UI otherwise regularly breaks on sites with aggressive global
    // styles. Inline style properties, not an injected <style>/<link>, since a page's
    // CSP can silently block stylesheet injection (the same class of bug that broke
    // the fill-flash animation before it was switched to this approach).
    hostEl = document.createElement("div");
    hostEl.style.cssText = `
      all: initial;
      position: fixed;
      z-index: 2147483647;
      width: ${SIZE}px;
      height: ${SIZE}px;
      left: ${window.innerWidth - SIZE - MARGIN}px;
      top: ${window.innerHeight - SIZE - MARGIN}px;
    `;
    const shadow = hostEl.attachShadow({ mode: "open" });

    buttonEl = document.createElement("button");
    buttonEl.type = "button";
    buttonEl.setAttribute("aria-label", "Fill All Forms");
    buttonEl.title = "Fill All Forms — drag to move";
    buttonEl.style.cssText = `
      all: initial;
      display: flex;
      align-items: center;
      justify-content: center;
      box-sizing: border-box;
      width: 100%;
      height: 100%;
      border-radius: 50%;
      background: #0da34b;
      box-shadow: 0 4px 14px rgba(0, 0, 0, 0.3);
      cursor: grab;
      touch-action: none;
      transition: transform 0.15s ease, box-shadow 0.15s ease;
    `;
    buttonEl.innerHTML = `
      <svg width="26" height="26" viewBox="0 0 128 128" style="pointer-events: none;">
        <path d="M100 26 H40 a18 18 0 0 0 0 36 h48 a18 18 0 0 1 0 36 H28" fill="none" stroke="#ffffff" stroke-width="20" stroke-linecap="round"></path>
        <circle cx="100" cy="26" r="10" fill="#00391b"></circle>
      </svg>
    `;

    buttonEl.addEventListener("pointerdown", onPointerDown);
    buttonEl.addEventListener("pointerup", onPointerUp);
    buttonEl.addEventListener("pointercancel", onPointerUp);
    buttonEl.addEventListener("mouseenter", () => {
      if (!dragging) buttonEl.style.boxShadow = "0 6px 18px rgba(0, 0, 0, 0.38)";
    });
    buttonEl.addEventListener("mouseleave", () => {
      if (!dragging) buttonEl.style.boxShadow = "0 4px 14px rgba(0, 0, 0, 0.3)";
    });

    shadow.appendChild(buttonEl);
    document.documentElement.appendChild(hostEl);

    window.addEventListener("resize", () => {
      if (!hostEl) return;
      const rect = hostEl.getBoundingClientRect();
      applyPosition(rect.left, rect.top);
    });
  }

  function destroy() {
    if (hostEl) hostEl.remove();
    hostEl = null;
    buttonEl = null;
  }

  function syncVisibility() {
    const settings = stateCache.getSettings();
    if (!settings) return; // not loaded yet — syncVisibility runs again once it is
    if (settings.enableOverlayButton === false) {
      destroy();
    } else if (!hostEl) {
      createButton();
      loadPosition();
    }
  }

  stateCache.onChange(syncVisibility);
  syncVisibility();
})();
