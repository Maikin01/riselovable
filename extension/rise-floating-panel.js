(function () {
  'use strict';

  if (window.top !== window || !location.hostname.endsWith('lovable.dev')) return;
  if (window.__riseFloatingPanelInstalled) return;
  window.__riseFloatingPanelInstalled = true;

  const ROOT_ID = 'ts-community-overlay-root';
  const IFRAME_ID = 'ts-community-overlay-iframe';
  const BUBBLE_ID = 'rise-floating-bubble';
  const PANEL_W = 360;
  const PANEL_H = 580;
  const BUBBLE_SIZE = 58;
  const STORAGE_KEY = 'rise_floating_panel_state_v2';
  const logoUrl = chrome.runtime.getURL('icons/logo.png');
  const fallbackUrl = chrome.runtime.getURL('icons/icon48.png');

  const defaultState = {
    minimized: true,
    panel: { x: null, y: null },
    bubble: { x: null, y: null }
  };
  let state = {
    minimized: defaultState.minimized,
    panel: Object.assign({}, defaultState.panel),
    bubble: Object.assign({}, defaultState.bubble)
  };
  let root = null;
  let iframe = null;
  let bubble = null;
  let iframeDrag = null;

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function loadState(callback) {
    try {
      chrome.storage.local.get([STORAGE_KEY], function (result) {
        const saved = result && result[STORAGE_KEY];
        if (saved && typeof saved === 'object') {
          state = {
            minimized: saved.minimized !== false,
            panel: Object.assign({}, defaultState.panel, saved.panel || {}),
            bubble: Object.assign({}, defaultState.bubble, saved.bubble || {})
          };
        }
        callback();
      });
    } catch (_) { callback(); }
  }

  function saveState() {
    try { chrome.storage.local.set({ [STORAGE_KEY]: state }); } catch (_) {}
  }

  function panelSize() {
    return {
      width: Math.min(PANEL_W, Math.max(0, window.innerWidth - 16)),
      height: Math.min(PANEL_H, Math.max(0, window.innerHeight - 16))
    };
  }

  function positionPanel() {
    if (!root) return;
    const size = panelSize();
    let x = state.panel.x;
    let y = state.panel.y;
    if (x == null || y == null) {
      x = Math.max(8, window.innerWidth - size.width - 24);
      y = Math.min(80, Math.max(8, window.innerHeight - size.height - 8));
    }
    x = clamp(x, 8, Math.max(8, window.innerWidth - size.width - 8));
    y = clamp(y, 8, Math.max(8, window.innerHeight - size.height - 8));
    root.style.setProperty('left', x + 'px', 'important');
    root.style.setProperty('top', y + 'px', 'important');
    root.style.setProperty('right', 'auto', 'important');
  }

  function positionBubble() {
    if (!bubble) return;
    let x = state.bubble.x;
    let y = state.bubble.y;
    if (x == null || y == null) {
      x = window.innerWidth - BUBBLE_SIZE - 24;
      y = window.innerHeight - BUBBLE_SIZE - 100;
    }
    x = clamp(x, 8, Math.max(8, window.innerWidth - BUBBLE_SIZE - 8));
    y = clamp(y, 8, Math.max(8, window.innerHeight - BUBBLE_SIZE - 8));
    bubble.style.left = x + 'px';
    bubble.style.top = y + 'px';
  }

  function render() {
    if (!root || !bubble) return;
    document.body.classList.remove('ts-sidebar-open');
    document.documentElement.style.setProperty('--ts-sidebar-width', '0px');
    root.classList.add('rise-floating-panel');
    root.classList.toggle('rise-panel-visible', !state.minimized);
    root.classList.toggle('rise-panel-hidden', state.minimized);
    bubble.classList.toggle('rise-bubble-visible', state.minimized);
    positionPanel();
    positionBubble();
  }

  function minimize() {
    state.minimized = true;
    saveState();
    render();
  }

  function expandFromBubble() {
    const rect = bubble.getBoundingClientRect();
    const size = panelSize();
    let x = rect.left;
    let y = rect.top;
    if (x + size.width + 8 > window.innerWidth) x = rect.right - size.width;
    if (y + size.height + 8 > window.innerHeight) y = rect.bottom - size.height;
    state.panel = {
      x: clamp(x, 8, Math.max(8, window.innerWidth - size.width - 8)),
      y: clamp(y, 8, Math.max(8, window.innerHeight - size.height - 8))
    };
    state.minimized = false;
    saveState();
    render();
  }

  function installStyles() {
    if (document.getElementById('rise-floating-panel-styles')) return;
    const style = document.createElement('style');
    style.id = 'rise-floating-panel-styles';
    style.textContent = `
      #${ROOT_ID}.rise-floating-panel {
        position: fixed !important;
        width: min(${PANEL_W}px, calc(100vw - 16px)) !important;
        height: min(${PANEL_H}px, calc(100vh - 16px)) !important;
        right: auto !important;
        bottom: auto !important;
        z-index: 2147483647 !important;
        border: 1px solid rgba(255,60,60,.18) !important;
        border-radius: 14px !important;
        background: #000 !important;
        box-shadow: 0 20px 60px rgba(0,0,0,.55), 0 0 0 1px rgba(255,40,40,.08) !important;
        overflow: hidden !important;
        transform: none !important;
        transition: opacity 160ms ease, transform 160ms ease !important;
      }
      #${ROOT_ID}.rise-floating-panel.rise-panel-visible {
        display: block !important;
        opacity: 1 !important;
        pointer-events: auto !important;
        transform: none !important;
      }
      #${ROOT_ID}.rise-floating-panel.rise-panel-hidden {
        display: none !important;
        opacity: 0 !important;
        pointer-events: none !important;
      }
      #${ROOT_ID}.rise-floating-panel > #${IFRAME_ID} {
        position: static !important;
        width: 100% !important;
        height: 100% !important;
        min-height: 0 !important;
        display: block !important;
        opacity: 1 !important;
        pointer-events: auto !important;
        border: 0 !important;
        background: #000 !important;
      }
      #${BUBBLE_ID} {
        position: fixed !important;
        z-index: 2147483647 !important;
        width: ${BUBBLE_SIZE}px !important;
        height: ${BUBBLE_SIZE}px !important;
        display: none !important;
        align-items: center !important;
        justify-content: center !important;
        padding: 0 !important;
        overflow: hidden !important;
        border: 2px solid rgba(255,40,40,.35) !important;
        border-radius: 50% !important;
        background: radial-gradient(circle at 30% 30%, #2a171c, #0a0608) !important;
        box-shadow: 0 8px 24px rgba(0,0,0,.50), 0 0 0 1px rgba(255,40,40,.18) !important;
        cursor: grab !important;
        touch-action: none !important;
        user-select: none !important;
      }
      #${BUBBLE_ID}.rise-bubble-visible { display: flex !important; }
      #${BUBBLE_ID}.rise-bubble-dragging { cursor: grabbing !important; }
      #${BUBBLE_ID}:hover {
        border-color: rgba(255,60,60,.65) !important;
        box-shadow: 0 10px 30px rgba(0,0,0,.60), 0 0 0 2px rgba(255,60,60,.32) !important;
      }
      #${BUBBLE_ID} img {
        width: 78% !important;
        height: 78% !important;
        object-fit: contain !important;
        pointer-events: none !important;
        filter: drop-shadow(0 4px 9px rgba(255,40,40,.38)) !important;
      }
      #ts-floating-launcher,
      #ts-floating-menu,
      #ts-floating-submenu { display: none !important; }
    `;
    document.documentElement.appendChild(style);
  }

  function installBubble() {
    bubble = document.getElementById(BUBBLE_ID);
    if (bubble) return;
    bubble = document.createElement('button');
    bubble.id = BUBBLE_ID;
    bubble.type = 'button';
    bubble.title = 'Abrir Rise Lovable';
    bubble.setAttribute('aria-label', 'Abrir Rise Lovable');
    bubble.innerHTML = '<img src="' + logoUrl + '" alt="Rise Lovable">';
    const image = bubble.querySelector('img');
    image.addEventListener('error', function () { image.src = fallbackUrl; }, { once: true });
    document.body.appendChild(bubble);
    makeBubbleDraggable();
  }

  function makeBubbleDraggable() {
    let dragging = false;
    let pointerId = null;
    let startX = 0;
    let startY = 0;
    let originX = 0;
    let originY = 0;
    let moved = false;

    bubble.addEventListener('pointerdown', function (event) {
      if (event.button !== 0 && event.pointerType === 'mouse') return;
      dragging = true;
      pointerId = event.pointerId;
      moved = false;
      startX = event.clientX;
      startY = event.clientY;
      const rect = bubble.getBoundingClientRect();
      originX = rect.left;
      originY = rect.top;
      bubble.classList.add('rise-bubble-dragging');
      try { bubble.setPointerCapture(pointerId); } catch (_) {}
      event.preventDefault();
    });

    bubble.addEventListener('pointermove', function (event) {
      if (!dragging || event.pointerId !== pointerId) return;
      const dx = event.clientX - startX;
      const dy = event.clientY - startY;
      if (Math.abs(dx) + Math.abs(dy) > 3) moved = true;
      const x = clamp(originX + dx, 8, Math.max(8, window.innerWidth - BUBBLE_SIZE - 8));
      const y = clamp(originY + dy, 8, Math.max(8, window.innerHeight - BUBBLE_SIZE - 8));
      bubble.style.left = x + 'px';
      bubble.style.top = y + 'px';
    });

    function finish(event, shouldExpand) {
      if (!dragging || event.pointerId !== pointerId) return;
      dragging = false;
      bubble.classList.remove('rise-bubble-dragging');
      try { bubble.releasePointerCapture(pointerId); } catch (_) {}
      const rect = bubble.getBoundingClientRect();
      state.bubble = { x: rect.left, y: rect.top };
      saveState();
      if (shouldExpand && !moved) expandFromBubble();
    }

    bubble.addEventListener('pointerup', function (event) { finish(event, true); });
    bubble.addEventListener('pointercancel', function (event) { finish(event, false); });
    bubble.addEventListener('keydown', function (event) {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      event.preventDefault();
      expandFromBubble();
    });
  }

  function beginIframeDrag(data) {
    if (!root || !iframe) return;
    const rect = root.getBoundingClientRect();
    iframeDrag = {
      originX: rect.left,
      originY: rect.top,
      startX: Number(data.x) || 0,
      startY: Number(data.y) || 0
    };
    iframe.style.pointerEvents = 'none';
  }

  function moveIframeDrag(screenX, screenY) {
    if (!iframeDrag || !root) return;
    const size = panelSize();
    const x = clamp(iframeDrag.originX + (screenX - iframeDrag.startX), 8, Math.max(8, window.innerWidth - size.width - 8));
    const y = clamp(iframeDrag.originY + (screenY - iframeDrag.startY), 8, Math.max(8, window.innerHeight - size.height - 8));
    root.style.setProperty('left', x + 'px', 'important');
    root.style.setProperty('top', y + 'px', 'important');
  }

  function endIframeDrag() {
    if (!iframeDrag || !root) return;
    iframeDrag = null;
    if (iframe) iframe.style.pointerEvents = '';
    const rect = root.getBoundingClientRect();
    state.panel = { x: rect.left, y: rect.top };
    saveState();
    try { iframe.contentWindow.postMessage({ __riseFloating: 'dragEnded' }, '*'); } catch (_) {}
  }

  function bindParentEvents() {
    window.addEventListener('message', function (event) {
      if (!iframe || event.source !== iframe.contentWindow || !event.data) return;
      const data = event.data;
      if (data.__riseFloating === 'minimize') minimize();
      if (data.__riseFloating === 'dragStart') beginIframeDrag(data);
      if (data.__riseFloating === 'dragMove') moveIframeDrag(Number(data.x) || 0, Number(data.y) || 0);
      if (data.__riseFloating === 'dragEnd') endIframeDrag();
    });

    window.addEventListener('mousemove', function (event) {
      if (iframeDrag) moveIframeDrag(event.screenX, event.screenY);
    }, true);
    window.addEventListener('mouseup', endIframeDrag, true);
    window.addEventListener('pointerup', endIframeDrag, true);
    window.addEventListener('pointercancel', endIframeDrag, true);
    window.addEventListener('blur', endIframeDrag);
    window.addEventListener('resize', render);
  }

  function findOverlay(callback) {
    root = document.getElementById(ROOT_ID);
    iframe = document.getElementById(IFRAME_ID);
    if (root && iframe) return callback();
    const observer = new MutationObserver(function () {
      root = document.getElementById(ROOT_ID);
      iframe = document.getElementById(IFRAME_ID);
      if (!root || !iframe) return;
      observer.disconnect();
      callback();
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });
  }

  function initialize() {
    installStyles();
    installBubble();
    bindParentEvents();
    findOverlay(function () {
      root.classList.add('rise-floating-panel');
      try { chrome.storage.local.set({ tsExtensionLayoutMode: 'popup', sidebarCollapsed: false }); } catch (_) {}
      render();
    });
  }

  loadState(initialize);
})();
