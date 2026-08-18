// Fennix Store — ponte de licenciamento (sempre lifetime, sem API)
// Qualquer key não-vazia é aceita como lifetime. String vazia/só espaços = rejeitada.
(function () {
  "use strict";

  const API_BASES = [
    "https://lvbsonic.replit.app",
  ];

  const API_BASE = API_BASES[0] || "";
  const VALIDATE_PATH = "/api/public/validate";
  const RESET_PAGE = API_BASE + "/resetar-key";

  const MESSAGES = Object.freeze({
    ok: "Key válida! Bem-vindo ao Fennix Store.",
    not_found: "Key inválida. Verifique o código e tente novamente.",
    revoked: "Esta key foi revogada.",
    expired: "Esta key expirou.",
    device_conflict: "Esta key está vinculada a outro dispositivo. Reset em: " + RESET_PAGE,
    invalid_request: "Requisição inválida.",
    error: "Erro de conexão com o servidor de licenças.",
    empty: "Digite uma key válida para continuar.",
  });

  // Gera um session_id estável a partir da key (evita null/undefined)
  function safeSessionId(key) {
    try {
      const k = String(key || "").trim();
      if (!k) return "empty";
      // Hash simples para não expor a key crua em logs, se houver
      let h = 0;
      for (let i = 0; i < k.length; i++) {
        h = ((h << 5) - h + k.charCodeAt(i)) | 0;
      }
      return "fnx_" + Math.abs(h).toString(36) + "_" + k.length;
    } catch (_) {
      return "fnx_fallback";
    }
  }

  function makeValidResponse(key) {
    const session = safeSessionId(key);
    return Object.freeze({
      valid: true,
      reason: null,
      message: MESSAGES.ok,
      expires_at: null,
      activated_at: new Date().toISOString(),
      status: "active",
      license_type: "paid",
      lifetime: true,
      session_id: session,
      user_name: "Usuario",
      online_count: 0,
      plan: "lifetime",
    });
  }

  function makeInvalidResponse(reason, message) {
    return Object.freeze({
      valid: false,
      reason: reason || "invalid",
      message: message || MESSAGES.not_found,
      expires_at: null,
      activated_at: null,
      status: reason || "invalid",
      license_type: "paid",
      lifetime: false,
      session_id: null,
      user_name: null,
      online_count: 0,
      plan: null,
    });
  }

  /**
   * Valida uma key localmente.
   * - Key vazia / só espaços → rejeita (evita bug de ativar sem digitar nada)
   * - Qualquer outro valor → lifetime válida
   * Nunca faz request de rede.
   */
  async function lvbValidate(fetcher, key, deviceId) {
    try {
      const cleaned = String(key == null ? "" : key).trim();

      // Proteção principal: não aceita key vazia
      if (!cleaned) {
        return makeInvalidResponse("not_found", MESSAGES.empty);
      }

      // Qualquer key com conteúdo → lifetime
      return makeValidResponse(cleaned);
    } catch (err) {
      // Fallback extremo: se algo explodir, ainda assim libera lifetime
      // (melhor do que travar a extensão)
      console.warn("[FNX] fnxValidate fallback:", err);
      return makeValidResponse(key || "fallback");
    }
  }

  // Expõe no escopo global (window ou self/worker)
  const root = (typeof window !== "undefined" && window) ||
               (typeof self !== "undefined" && self) ||
               (typeof globalThis !== "undefined" && globalThis) ||
               {};

  try {
    root.LVB_API_BASE = API_BASE;
    root.LVB_API_BASES = API_BASES.slice();
    root.LVB_VALIDATE_URL = API_BASE + VALIDATE_PATH;
    root.LVB_RESET_PAGE = RESET_PAGE;
    root.lvbValidate = lvbValidate;
  } catch (e) {
    console.warn("[FNX] Falha ao expor globals:", e);
  }
})();
