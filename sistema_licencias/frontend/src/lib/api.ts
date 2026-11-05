/**
 * Cliente HTTP único de la aplicación.
 *
 * Las cookies de sesión viajan con `credentials: include`; el token CSRF se lee
 * de la cookie legible `tb_csrf` y se envía en la cabecera `X-CSRF-Token` en
 * cada mutación. La interfaz nunca guarda tokens en localStorage.
 */

const API_BASE = (import.meta.env.VITE_API_URL ?? "/api/v1").replace(/\/$/, "");

export interface ApiErrorPayload {
  code: string;
  message: string;
  fields?: Array<{ field?: string; message?: string }>;
  [key: string]: unknown;
}

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details: ApiErrorPayload | null;

  constructor(status: number, code: string, message: string, details: ApiErrorPayload | null) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

function readCookie(name: string): string | null {
  const prefix = `${name}=`;
  for (const part of document.cookie.split(";")) {
    const trimmed = part.trim();
    if (trimmed.startsWith(prefix)) {
      return decodeURIComponent(trimmed.slice(prefix.length));
    }
  }
  return null;
}

<<<<<<< HEAD
export function buildUrl(path: string, params?: Record<string, unknown>): string {
=======
function buildUrl(path: string, params?: Record<string, unknown>): string {
>>>>>>> 375601f98034ff3fad8c977a1bdcea7ff8dc8984
  const url = path.startsWith(API_BASE)
    ? path
    : `${API_BASE}${path.startsWith("/") ? path : `/${path}`}`;
  if (!params) return url;
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "") continue;
    search.set(key, String(value));
  }
  const query = search.toString();
  return query ? `${url}?${query}` : url;
}

async function parseResponse<T>(response: Response): Promise<T> {
  if (response.status === 204) return undefined as T;
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    if (!response.ok) {
      throw new ApiError(
        response.status,
        "http_error",
        `La solicitud falló (${response.status})`,
        null,
      );
    }
    return (await response.text()) as T;
  }
  const payload = (await response.json()) as unknown;
  if (!response.ok) {
    const errorPayload =
      typeof payload === "object" && payload !== null && "error" in payload
        ? ((payload as { error: ApiErrorPayload }).error ?? null)
        : null;
    throw new ApiError(
      response.status,
      errorPayload?.code ?? "http_error",
      errorPayload?.message ?? `La solicitud falló (${response.status})`,
      errorPayload,
    );
  }
  return payload as T;
}

interface RequestOptions {
  method?: string;
  body?: unknown;
  formData?: FormData;
  signal?: AbortSignal;
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const method = (options.method ?? "GET").toUpperCase();
  const headers = new Headers({ Accept: "application/json" });
  const mutating = !["GET", "HEAD", "OPTIONS"].includes(method);
  if (mutating) {
    const csrf = readCookie("tb_csrf");
    if (csrf) headers.set("X-CSRF-Token", csrf);
  }

  let body: BodyInit | undefined;
  if (options.formData) {
    body = options.formData;
  } else if (options.body !== undefined) {
    headers.set("Content-Type", "application/json");
    body = JSON.stringify(options.body);
  }

  const response = await fetch(buildUrl(path), {
    method,
    headers,
    body,
    credentials: "include",
    signal: options.signal,
  });
  return parseResponse<T>(response);
}

export const api = {
  get<T>(path: string, params?: Record<string, unknown>, signal?: AbortSignal): Promise<T> {
    const url = buildUrl(path, params);
    return request<T>(url, { signal });
  },
  post<T>(path: string, body?: unknown, signal?: AbortSignal): Promise<T> {
    return request<T>(path, { method: "POST", body, signal });
  },
  patch<T>(path: string, body?: unknown, signal?: AbortSignal): Promise<T> {
    return request<T>(path, { method: "PATCH", body, signal });
  },
  delete<T>(path: string, signal?: AbortSignal): Promise<T> {
    return request<T>(path, { method: "DELETE", signal });
  },
  upload<T>(path: string, formData: FormData, signal?: AbortSignal): Promise<T> {
    return request<T>(path, { method: "POST", formData, signal });
  },
};
