import { VelantoApiError } from "../api-client.js";

/** The MCP tool-result shape this server returns. */
export interface ToolResult {
  content: { type: "text"; text: string }[];
  isError?: boolean;
  [key: string]: unknown;
}

/** A successful result: the API response, pretty-printed as JSON text. */
export function ok(data: unknown): ToolResult {
  return {
    content: [{ type: "text", text: JSON.stringify(data ?? null, null, 2) }],
  };
}

/** A failed result the AI can read and react to (e.g. "missing scope"). */
export function fail(message: string): ToolResult {
  return { content: [{ type: "text", text: message }], isError: true };
}

/**
 * Run an API-calling function and convert the outcome into a ToolResult. A
 * VelantoApiError (missing scope, validation failure, 404, …) becomes an
 * `isError` result carrying the API's message rather than throwing, so the
 * model can adapt instead of the tool call hard-failing.
 */
export async function handle(fn: () => Promise<unknown>): Promise<ToolResult> {
  try {
    return ok(await fn());
  } catch (err) {
    if (err instanceof VelantoApiError) return fail(err.message);
    return fail(err instanceof Error ? err.message : String(err));
  }
}

/** Build a query string from defined params only (skips undefined/empty). */
export function queryString(
  params: Record<string, string | number | undefined>,
): string {
  const pairs = Object.entries(params).filter(
    ([, v]) => v !== undefined && v !== "",
  );
  if (pairs.length === 0) return "";
  const search = new URLSearchParams();
  for (const [k, v] of pairs) search.set(k, String(v));
  return `?${search.toString()}`;
}
