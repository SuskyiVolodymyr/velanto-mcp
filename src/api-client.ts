import type { Config } from "./config.js";

/** An error carrying the HTTP status and parsed body from a failed API call. */
export class VelantoApiError extends Error {
  constructor(
    readonly status: number,
    readonly body: unknown,
  ) {
    super(VelantoApiError.describe(status, body));
    this.name = "VelantoApiError";
  }

  private static describe(status: number, body: unknown): string {
    const base = `Velanto API request failed (HTTP ${status})`;
    if (!body || typeof body !== "object") {
      return typeof body === "string" && body ? `${base}: ${body}` : base;
    }
    const record = body as Record<string, unknown>;
    const message =
      typeof record.message === "string" ? record.message : undefined;
    // nestjs-zod returns field-level issues under `errors` on a 400 — surface
    // them so the model can see WHICH field failed and fix its next attempt.
    const issues = Array.isArray(record.errors)
      ? record.errors
          .map((e) => {
            const issue = e as { path?: unknown; message?: unknown };
            const path = Array.isArray(issue.path) ? issue.path.join(".") : "";
            return path ? `${path}: ${String(issue.message)}` : String(issue.message);
          })
          .join("; ")
      : "";
    const detail = [message, issues].filter(Boolean).join(" — ");
    return detail ? `${base}: ${detail}` : base;
  }
}

type Method = "GET" | "POST" | "PATCH" | "DELETE";

/**
 * A thin authenticated wrapper over the Velanto REST API. It holds no business
 * logic — the API is the source of truth and enforces auth, scopes, and
 * validation; this client just attaches the bearer token and surfaces errors.
 */
export class ApiClient {
  constructor(
    private readonly config: Config,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  get<T>(path: string): Promise<T> {
    return this.request<T>("GET", path);
  }
  post<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>("POST", path, body);
  }
  patch<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>("PATCH", path, body);
  }
  delete<T>(path: string): Promise<T> {
    return this.request<T>("DELETE", path);
  }

  /**
   * POST a multipart/form-data body (a `FormData`). Unlike {@link post}, this
   * sets NO Content-Type header — `fetch` derives `multipart/form-data` plus the
   * boundary from the FormData itself, and setting it by hand would drop the
   * boundary and corrupt the upload. Used to stream an image to POST /media.
   */
  postForm<T>(path: string, form: FormData): Promise<T> {
    return this.send<T>(path, {
      method: "POST",
      headers: { Authorization: `Bearer ${this.config.token}` },
      body: form,
    });
  }

  private request<T>(method: Method, path: string, body?: unknown): Promise<T> {
    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.config.token}`,
    };
    if (body !== undefined) headers["Content-Type"] = "application/json";

    return this.send<T>(path, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  }

  /** Fire one request and turn the response into T (or throw VelantoApiError). */
  private async send<T>(path: string, init: RequestInit): Promise<T> {
    const res = await this.fetchImpl(`${this.config.apiUrl}${path}`, init);

    const text = await res.text();
    const data: unknown = text ? safeJsonParse(text) : null;

    if (!res.ok) throw new VelantoApiError(res.status, data);
    return data as T;
  }
}

function safeJsonParse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}
