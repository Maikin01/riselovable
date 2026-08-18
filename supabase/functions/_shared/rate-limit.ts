import type { SupabaseClient } from "npm:@supabase/supabase-js@2.110.2";
import { ApiHttpError } from "./http.ts";

export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
};

type RateLimitOptions = {
  failOpen?: boolean;
  requestId?: string;
};

export function clientIp(request: Request): string {
  return (
    request.headers.get("cf-connecting-ip") ??
      request.headers.get("x-real-ip") ??
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      "unknown"
  );
}

export async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value),
  );
  return [...new Uint8Array(digest)].map((byte) =>
    byte.toString(16).padStart(2, "0")
  ).join("");
}

export async function consumeRateLimit(
  admin: SupabaseClient,
  scope: string,
  keyParts: Array<string | null | undefined>,
  limit: number,
  windowSeconds: number,
  options: RateLimitOptions = {},
): Promise<RateLimitResult> {
  const keyHash = await sha256Hex(
    [scope, ...keyParts.map((part) => part ?? "")].join("\u001f"),
  );
  const callRpc = () =>
    admin.rpc("consume_edge_rate_limit", {
      p_scope: scope,
      p_key_hash: keyHash,
      p_limit: limit,
      p_window_seconds: windowSeconds,
    });

  // Chamadas simultâneas na mesma chave podem colidir (unique violation /
  // deadlock). Uma nova tentativa resolve sem derrubar a requisição.
  let { data, error } = await callRpc();
  if (error) {
    await new Promise((resolve) => setTimeout(resolve, 60));
    ({ data, error } = await callRpc());
  }


  if (error) {
    if (options.failOpen) {
      console.warn(
        "[rate-limit]",
        JSON.stringify({
          requestId: options.requestId ?? null,
          scope,
          mode: "fail-open",
          errorCode: error.code ?? null,
        }),
      );
      return { allowed: true, remaining: limit, retryAfterSeconds: 0 };
    }
    throw error;
  }

  const row = Array.isArray(data) ? data[0] : data;
  if (!row || typeof row.allowed !== "boolean") {
    if (options.failOpen) {
      console.warn(
        "[rate-limit]",
        JSON.stringify({
          requestId: options.requestId ?? null,
          scope,
          mode: "fail-open",
          errorCode: "INVALID_RPC_RESPONSE",
        }),
      );
      return { allowed: true, remaining: limit, retryAfterSeconds: 0 };
    }
    throw new Error("Resposta inválida do limitador de requisições.");
  }

  return {
    allowed: row.allowed,
    remaining: Math.max(0, Number(row.remaining ?? 0)),
    retryAfterSeconds: Math.max(0, Number(row.retry_after_seconds ?? 0)),
  };
}

export async function enforceRateLimit(
  admin: SupabaseClient,
  scope: string,
  keyParts: Array<string | null | undefined>,
  limit: number,
  windowSeconds: number,
  options: RateLimitOptions = {},
): Promise<void> {
  const result = await consumeRateLimit(
    admin,
    scope,
    keyParts,
    limit,
    windowSeconds,
    options,
  );
  if (!result.allowed) {
    throw new ApiHttpError(
      429,
      "RATE_LIMITED",
      "Muitas requisições. Tente novamente em instantes.",
      {
        retryAfterSeconds: Math.max(1, result.retryAfterSeconds),
      },
    );
  }
}
