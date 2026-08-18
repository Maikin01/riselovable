export type CorsMode = "public" | "protected";

export type HttpContext = {
  requestId: string;
  corsMode: CorsMode;
  origin: string | null;
  originAllowed: boolean;
};

const REQUEST_ID_PATTERN = /^[A-Za-z0-9._:-]{8,128}$/;
const EXPOSED_HEADERS = "x-request-id, retry-after";
const ALLOWED_HEADERS =
  "authorization, x-client-info, apikey, content-type, x-request-id";

export type FieldIssue = { field: string; message: string };

export class ApiHttpError extends Error {
  readonly status: number;
  readonly code: string;
  readonly publicMessage: string;
  readonly retryAfterSeconds?: number;
  readonly fields?: FieldIssue[];

  constructor(
    status: number,
    code: string,
    publicMessage: string,
    options: {
      cause?: unknown;
      retryAfterSeconds?: number;
      fields?: FieldIssue[];
    } = {},
  ) {
    super(
      publicMessage,
      options.cause === undefined ? undefined : { cause: options.cause },
    );
    this.name = "ApiHttpError";
    this.status = status;
    this.code = code;
    this.publicMessage = publicMessage;
    this.retryAfterSeconds = options.retryAfterSeconds;
    this.fields = options.fields;
  }
}

function requestIdFrom(request: Request): string {
  const incoming = request.headers.get("x-request-id")?.trim();
  return incoming && REQUEST_ID_PATTERN.test(incoming)
    ? incoming
    : crypto.randomUUID();
}

function normalizedOrigin(value: string): string | null {
  try {
    return new URL(value).origin.toLowerCase();
  } catch {
    return null;
  }
}

function allowedProtectedOrigins(): Set<string> {
  const configured = Deno.env.get("APP_ALLOWED_ORIGINS") ?? "";
  const origins = configured
    .split(",")
    .map((value) => normalizedOrigin(value.trim()))
    .filter((value): value is string => !!value && value !== "*");

  if (Deno.env.get("APP_ALLOW_LOCALHOST_ORIGINS") === "true") {
    origins.push(
      "http://localhost:3000",
      "http://localhost:5173",
      "http://localhost:8080",
      "http://127.0.0.1:5173",
      "http://127.0.0.1:8080",
    );
  }

  return new Set(origins);
}

const TRUSTED_HOST_SUFFIXES = [
  ".lovable.app",
  ".lovableproject.com",
  ".lovable.dev",
];

const TRUSTED_ORIGINS = new Set([
  "https://lovable.dev",
  "https://www.lovable.dev",
]);

function isTrustedHost(origin: string): boolean {
  try {
    const { protocol, hostname } = new URL(origin);
    if (protocol !== "https:") return false;
    if (TRUSTED_ORIGINS.has(origin)) return true;
    return TRUSTED_HOST_SUFFIXES.some((suffix) => hostname.endsWith(suffix));
  } catch {
    return false;
  }
}

export function createHttpContext(
  request: Request,
  corsMode: CorsMode,
): HttpContext {
  const origin = request.headers.get("origin");
  const normalized = origin ? normalizedOrigin(origin) : null;
  const originAllowed = corsMode === "public" ||
    origin === null ||
    (!!normalized &&
      (allowedProtectedOrigins().has(normalized) || isTrustedHost(normalized)));


  return {
    requestId: requestIdFrom(request),
    corsMode,
    origin,
    originAllowed,
  };
}

export function assertAllowedOrigin(context: HttpContext): void {
  if (!context.originAllowed) {
    throw new ApiHttpError(403, "ORIGIN_NOT_ALLOWED", "Origem não autorizada.");
  }
}

function corsHeaders(context?: HttpContext): Headers {
  const headers = new Headers({
    "Access-Control-Allow-Headers": ALLOWED_HEADERS,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Expose-Headers": EXPOSED_HEADERS,
  });

  if (!context || context.corsMode === "public") {
    headers.set("Access-Control-Allow-Origin", "*");
  } else {
    headers.set("Vary", "Origin");
    if (context.origin && context.originAllowed) {
      headers.set("Access-Control-Allow-Origin", context.origin);
    }
  }

  if (context) headers.set("X-Request-Id", context.requestId);
  return headers;
}

export function json(
  data: unknown,
  status = 200,
  context?: HttpContext,
  extraHeaders?: HeadersInit,
): Response {
  const headers = corsHeaders(context);
  headers.set("Content-Type", "application/json; charset=utf-8");
  if (extraHeaders) {
    new Headers(extraHeaders).forEach((value, key) => headers.set(key, value));
  }
  return new Response(JSON.stringify(data), { status, headers });
}

export function options(context?: HttpContext): Response {
  return new Response(null, { status: 204, headers: corsHeaders(context) });
}

function normalizeError(error: unknown): ApiHttpError {
  if (error instanceof ApiHttpError) return error;

  if (error instanceof Error && error.name === "ZodError") {
    const issues = (error as unknown as { issues?: Array<{ path?: unknown[]; message?: string }> })
      .issues ?? [];
    const fields: FieldIssue[] = issues.map((issue) => ({
      field: Array.isArray(issue.path) ? issue.path.join(".") : "",
      message: issue.message ?? "Valor inválido.",
    }));
    const summary = fields.length
      ? `Dados inválidos: ${
        fields.map((f) => `${f.field || "campo"} (${f.message})`).join("; ")
      }`
      : "Dados inválidos.";
    return new ApiHttpError(400, "VALIDATION_ERROR", summary, {
      cause: error,
      fields,
    });
  }

  const message = error instanceof Error ? error.message : "";
  if (
    /não autenticado|sessão inválida|sessão ausente|sessão expirada/i.test(
      message,
    )
  ) {
    return new ApiHttpError(
      401,
      "UNAUTHORIZED",
      "Sessão inválida ou expirada.",
      {
        cause: error,
      },
    );
  }
  if (/acesso negado/i.test(message)) {
    return new ApiHttpError(403, "FORBIDDEN", "Acesso negado.", {
      cause: error,
    });
  }
  if (/não encontrado|não encontrada/i.test(message)) {
    return new ApiHttpError(404, "NOT_FOUND", message, { cause: error });
  }

  return new ApiHttpError(500, "INTERNAL_ERROR", "Erro interno do servidor.", {
    cause: error,
  });
}

export function errorResponse(error: unknown, context?: HttpContext): Response {
  const normalized = normalizeError(error);
  const internalMessage = error instanceof Error
    ? error.message
    : (error && typeof error === "object")
    ? JSON.stringify(error)
    : String(error);
  console.error(
    "[edge]",
    JSON.stringify({
      requestId: context?.requestId ?? null,
      code: normalized.code,
      status: normalized.status,
      errorName: error instanceof Error ? error.name : typeof error,
      internalMessage,
    }),
  );

  const extraHeaders = new Headers({ "Cache-Control": "no-store" });
  if (normalized.retryAfterSeconds != null) {
    extraHeaders.set("Retry-After", String(normalized.retryAfterSeconds));
  }

  return json(
    {
      error: normalized.publicMessage,
      code: normalized.code,
      fields: normalized.fields ?? undefined,
      requestId: context?.requestId ?? crypto.randomUUID(),
    },
    normalized.status,
    context,
    extraHeaders,
  );
}

export async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch (error) {
    throw new ApiHttpError(400, "INVALID_JSON", "JSON inválido.", {
      cause: error,
    });
  }
}
