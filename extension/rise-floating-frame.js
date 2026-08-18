(function () {
  'use strict';

  if (window.top === window || window.__riseFloatingFrameInstalled) return;
  window.__riseFloatingFrameInstalled = true;

  function sendToParent(type, data) {
    try {
      window.parent.postMessage(Object.assign({ __riseFloating: type }, data || {}), '*');
    } catch (_) {}
  }

  function install() {
    const header = document.querySelector('.sp-header');
    const actions = document.querySelector('.sp-header-actions');
    if (!header || !actions) return false;

    if (!document.getElementById('riseMinimizeButton')) {
      const button = document.createElement('button');
      button.type = 'button';
      button.id = 'riseMinimizeButton';
      button.className = 'sp-icon-btn rise-minimize-btn';
      button.title = 'Minimizar';
      button.setAttribute('aria-label', 'Minimizar');
      button.textContent = '\u2212';
      button.addEventListener('click', function (event) {
        event.preventDefault();
        event.stopPropagation();
        sendToParent('minimize');
      });
      actions.appendChild(button);
    }

    if (header.dataset.riseDragBound === '1') return true;
    header.dataset.riseDragBound = '1';
    header.style.cursor = 'grab';
    header.style.touchAction = 'none';
    header.style.userSelect = 'none';

    header.addEventListener('pointerdown', function (event) {
      if (event.button !== 0 || event.target.closest('button, a, input, textarea')) return;
      header.style.cursor = 'grabbing';
      sendToParent('dragStart', { x: event.screenX, y: event.screenY });
      try { header.setPointerCapture(event.pointerId); } catch (_) {}
      event.preventDefault();
    });

    header.addEventListener('pointermove', function (event) {
      if (!header.hasPointerCapture || !header.hasPointerCapture(event.pointerId)) return;
      sendToParent('dragMove', { x: event.screenX, y: event.screenY });
    });

    function finish(event) {
      header.style.cursor = 'grab';
      try {
        if (header.hasPointerCapture && header.hasPointerCapture(event.pointerId)) {
          header.releasePointerCapture(event.pointerId);
        }
      } catch (_) {}
      sendToParent('dragEnd');
    }

    header.addEventListener('pointerup', finish);
    header.addEventListener('pointercancel', finish);
    return true;
  }

  if (!install()) {
    const observer = new MutationObserver(function () {
      if (install()) observer.disconnect();
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });
  }
})();
