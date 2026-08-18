// Fennix Store — ponte de licenciamento integrada ao Lovable Cloud
(function () {
  "use strict";

  // O host da API agora é o próprio domínio da aplicação (Lovable Cloud)
  const API_BASE = "https://riselovable.lovable.app";
  const VALIDATE_PATH = API_BASE + "/api/public/license/validate";

  const MESSAGES = Object.freeze({
    ok: "Chave válida! Bem-vindo ao Rise Lovable.",
    not_found: "Chave inválida ou não encontrada no sistema.",
    revoked: "Esta chave foi revogada.",
    expired: "Esta chave expirou.",
    device_conflict: "Esta chave já está em uso em outro computador.",
    invalid_request: "Requisição inválida.",
    error: "Erro de conexão com o servidor de licenças.",
    empty: "Digite a chave gerada no painel para continuar.",
  });

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
   * Valida uma chave contra a API real do backend.
   * Agora realiza a tentativa de ativação automática antes da validação.
   */
  async function lvbValidate(fetcher, key, deviceId) {
    try {
      const cleaned = String(key == null ? "" : key).trim();
      if (!cleaned) return makeInvalidResponse("not_found", MESSAGES.empty);

      // 1. Tentar Ativação (Caso a chave seja nova/pendente)
      // O endpoint /activate é idempotente para o mesmo device_hash.
      try {
        await fetcher(API_BASE + "/api/public/license/activate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            key: cleaned,
            device_hash: deviceId,
            ext_version: "32.0.4"
          })
        });
      } catch (actErr) {
        console.warn("[Rise] Falha ou já ativa no endpoint de ativação:", actErr);
      }

      // 2. Validação final
      const response = await fetcher(VALIDATE_PATH, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          key: cleaned,
          device_hash: deviceId
        })
      });

      if (!response || !response.valid) {
        const reason = response ? response.reason : "error";
        return makeInvalidResponse(reason, (response && response.message) || MESSAGES.not_found);
      }

      // Retorna o objeto de sucesso vindo da API
      return Object.freeze({
        valid: true,
        reason: null,
        message: response.message || MESSAGES.ok,
        expires_at: response.expires_at,
        activated_at: response.activated_at,
        status: response.status,
        license_type: response.license_type,
        lifetime: !!response.lifetime,
        session_id: response.session_id,
        user_name: response.user_name || "Cliente",
        online_count: response.online_count || 0,
        plan: response.plan,
      });
    } catch (err) {
      console.error("[Rise] Erro na validação:", err);
      return makeInvalidResponse("error", MESSAGES.error);
    }
  }

  // Expõe no escopo global
  const root = (typeof window !== "undefined" && window) ||
               (typeof self !== "undefined" && self) ||
               (typeof globalThis !== "undefined" && globalThis) ||
               {};

  try {
    root.lvbValidate = lvbValidate;
  } catch (e) {
    console.warn("[Rise] Falha ao expor lvbValidate:", e);
  }
})();