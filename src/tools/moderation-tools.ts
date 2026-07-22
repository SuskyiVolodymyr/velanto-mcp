import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ApiClient } from "../api-client.js";
import { handle, queryString } from "./helpers.js";
import { REPORT_STATUSES, REPORT_TYPES } from "../schemas.js";

/**
 * Moderation tools. All require the `moderation` scope AND a staff role on the
 * token's owner — the API's RolesGuard still applies, so a moderation-scoped
 * token held by a non-staff account is refused (returned as an error result).
 */
export function registerModerationTools(
  server: McpServer,
  api: ApiClient,
): void {
  server.registerTool(
    "list_moderation_queue",
    {
      title: "List the moderation queue",
      description:
        "List packs awaiting moderation, oldest submission first. Requires the moderation scope and a staff account.",
      inputSchema: {
        page: z.number().int().positive().optional(),
        limit: z.number().int().positive().max(50).optional(),
        format: z.string().optional().describe("Filter by pack format."),
        q: z.string().optional().describe("Free-text search."),
      },
    },
    ({ page, limit, format, q }) =>
      handle(() =>
        api.get(
          `/packs/moderation-queue${queryString({ page, limit, format, q })}`,
        ),
      ),
  );

  server.registerTool(
    "approve_pack",
    {
      title: "Approve a pack",
      description:
        "Approve a pending pack, making it public. Requires the moderation scope and a staff account.",
      inputSchema: { id: z.string().describe("The pack id to approve.") },
    },
    ({ id }) =>
      handle(() => api.post(`/packs/${encodeURIComponent(id)}/approve`)),
  );

  server.registerTool(
    "reject_pack",
    {
      title: "Reject a pack",
      description:
        "Reject a pending pack with a reason. Requires the moderation scope and a staff account.",
      inputSchema: {
        id: z.string().describe("The pack id to reject."),
        reason: z.string().min(1).describe("Why the pack is being rejected."),
      },
    },
    ({ id, reason }) =>
      handle(() =>
        api.post(`/packs/${encodeURIComponent(id)}/reject`, { reason }),
      ),
  );

  server.registerTool(
    "list_reports",
    {
      title: "List content reports",
      description:
        "List user-filed content reports. Requires the moderation scope and a staff account.",
      inputSchema: {
        page: z.number().int().positive().optional(),
        limit: z.number().int().positive().max(50).optional(),
        // Enums, not free strings: these were documented as "e.g. 'open'"
        // and "e.g. 'pack'", and no report has ever had status 'open' — an
        // agent following that filtered on a value the API doesn't know.
        // Mirrors velanto-backend REPORT_STATUSES / REPORT_TYPES.
        status: z
          .enum(REPORT_STATUSES)
          .optional()
          .describe(
            "Filter by report status. 'new' is unreviewed, 'reviewing' is " +
              "acknowledged, 'closed' is resolved.",
          ),
        type: z
          .enum(REPORT_TYPES)
          .optional()
          .describe("Filter by what was reported."),
      },
    },
    ({ page, limit, status, type }) =>
      handle(() =>
        api.get(`/reports${queryString({ page, limit, status, type })}`),
      ),
  );

  server.registerTool(
    "resolve_report",
    {
      title: "Resolve a report",
      description:
        "Move a report to 'reviewing' (acknowledged) or 'closed' (resolved). Requires the moderation scope and a staff account.",
      inputSchema: {
        id: z.string().describe("The report id."),
        action: z
          .enum(["review", "close"])
          .describe("'review' acknowledges it; 'close' resolves it."),
      },
    },
    ({ id, action }) =>
      handle(() => api.post(`/reports/${encodeURIComponent(id)}/${action}`)),
  );
}
