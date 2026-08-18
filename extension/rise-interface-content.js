(function () {
  'use strict';

  if (window.top !== window || window.__riseInterfaceThemeInstalled) return;
  window.__riseInterfaceThemeInstalled = true;

  const style = document.createElement('style');
  style.id = 'rise-interface-content-theme';
  style.textContent = `
    #ts-floating-launcher {
      width: 58px !important;
      height: 58px !important;
      border-radius: 50% !important;
      background: radial-gradient(circle at 30% 30%, #2a171c, #0a0608) !important;
      border: 2px solid rgba(255, 40, 40, 0.35) !important;
      box-shadow: 0 8px 24px rgba(0,0,0,.50), 0 0 0 1px rgba(255,40,40,.18) !important;
      backdrop-filter: none !important;
      -webkit-backdrop-filter: none !important;
    }
    #ts-floating-launcher:hover {
      transform: scale(1.04) !important;
      border-color: rgba(255, 60, 60, 0.65) !important;
      box-shadow: 0 10px 30px rgba(0,0,0,.60), 0 0 0 2px rgba(255,60,60,.32) !important;
    }
    #ts-floating-launcher.ts-launcher-active {
      background: radial-gradient(circle at 30% 30%, #35181e, #0a0608) !important;
      border-color: #ff2a2a !important;
    }
    #ts-floating-launcher img {
      width: 45px !important;
      height: 45px !important;
      border-radius: 0 !important;
      filter: drop-shadow(0 4px 9px rgba(255,40,40,.38)) !important;
    }
    #ts-floating-menu .ts-fab-label,
    #ts-floating-submenu .ts-fab-label {
      background: rgba(20, 6, 8, 0.90) !important;
      border-color: rgba(255, 60, 60, 0.20) !important;
      color: #f4eff0 !important;
    }
    #ts-floating-menu .ts-fab-circle,
    #ts-floating-submenu .ts-fab-circle {
      background: linear-gradient(180deg, #ff2a2a, #b80000) !important;
      border-color: rgba(255,255,255,.14) !important;
      box-shadow: 0 5px 16px rgba(255,30,30,.34) !important;
    }
    #ts-notification-panel {
      background: rgba(20, 6, 8, .97) !important;
      border-color: rgba(255, 60, 60, .20) !important;
    }
    #ts-community-overlay-root:not(.ts-popup-mode) {
      box-shadow: -10px 0 34px rgba(255, 20, 20, .10), -1px 0 rgba(255,60,60,.16) !important;
    }
  `;
  (document.head || document.documentElement).appendChild(style);

  function refreshLauncherIdentity() {
    const launcher = document.getElementById('ts-floating-launcher');
    if (launcher) {
      launcher.title = 'Rise Lovable — clique para abrir o menu (arraste para mover)';
      const image = launcher.querySelector('img');
      if (image) image.alt = 'Rise Lovable';
    }

  }

  refreshLauncherIdentity();
  new MutationObserver(refreshLauncherIdentity).observe(document.documentElement, {
    childList: true,
    subtree: true
  });
})();
