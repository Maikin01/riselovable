(function() {
  "use strict";

  let checkTimer = null;

  async function checkLicenseStatus() {
    try {
      const res = await new Promise(r => chrome.storage.local.get(["ql_license_valid", "ql_license_key", "ql_hw_fingerprint"], r));
      
      if (!res.ql_license_valid || !res.ql_license_key) return;

      // Importante: No background.js, usamos a API real do Rise
      // Para simplificar e evitar redundância, vamos usar o endpoint de validação
      // Se a chave expirou ou o HWID mudou, o backend retornará valid: false
      
      // Buscamos a URL base dinamicamente (prod vs dev)
      // Aqui usamos a URL estável do projeto Lovable
      const API_URL = "https://riselovable.lovable.app/api/public/license/validate";
      
      const response = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          key: res.ql_license_key,
          hwid: res.ql_hw_fingerprint
        })
      });

      const data = await response.json();

      if (!data || !data.valid) {
        console.warn("[Rise Guard] Chave expirada ou inválida. Desconectando...");
        chrome.storage.local.remove([
          "ql_license_valid", "ql_license_key", "ql_session_id", 
          "ql_user_name", "ql_expires_at", "ql_activated_at", 
          "ql_license_status", "ql_license_type", "ql_license_lifetime"
        ]);
        
        // Notifica todas as abas/painéis para fecharem
        chrome.runtime.sendMessage({ action: "tsClosePanel" });
      }
    } catch (e) {
      console.error("[Rise Guard] Erro no check de licença:", e);
    }
  }

  // Inicia o loop de verificação (a cada 10 segundos para desconexão mais rápida)
  function startGuard() {
    if (checkTimer) clearInterval(checkTimer);
    checkTimer = setInterval(checkLicenseStatus, 10000);
    checkLicenseStatus();
  }

  // Monitora mudanças no storage para iniciar o guard assim que logar
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes.ql_license_valid) {
      if (changes.ql_license_valid.newValue === true) {
        startGuard();
      } else {
        if (checkTimer) clearInterval(checkTimer);
      }
    }
  });

  // Checagem inicial
  startGuard();
})();
