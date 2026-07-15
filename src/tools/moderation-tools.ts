import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ApiClient } from "../api-client.js";
import { handle, queryString } from "./helpers.js";

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
        api.get(`/packs/moderation-queue${queryString({ page, limit, format, q })}`),
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
        status: z
          .string()
          .optional()
          .describe("Filter by report status (e.g. 'open')."),
        type: z
          .string()
          .optional()
          .describe("Filter by report type (e.g. 'pack')."),
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
        "Mark a report as reviewed (acknowledged) or closed (resolved). Requires the moderation scope and a staff account.",
      inputSchema: {
        id: z.string().describe("The report id."),
        action: z
          .enum(["review", "close"])
          .describe("'review' acknowledges it; 'close' resolves it."),
      },
    },
    ({ id, action }) =>
      handle(() =>
        api.post(`/reports/${encodeURIComponent(id)}/${action}`),
      ),
  );
}
