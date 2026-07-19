import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ApiClient } from "../api-client.js";
import {
  createPackShape,
  updatePackShape,
  PACK_MODERATION_STATUSES,
} from "../schemas.js";
import { handle, queryString } from "./helpers.js";

/**
 * Pack-authoring tools. Reads need `packs:read`, create/update need
 * `packs:write`, delete needs `packs:delete` — the token's scopes are enforced
 * by the API, and a request lacking a scope comes back as an error result.
 */
export function registerPackTools(server: McpServer, api: ApiClient): void {
  server.registerTool(
    "get_pack",
    {
      title: "Get a pack",
      description:
        "Fetch a single pack by id, including its groups, rounds, and moderation status. Your own not-yet-approved packs are visible with a packs:read token.",
      inputSchema: { id: z.string().describe("The pack id.") },
    },
    ({ id }) => handle(() => api.get(`/packs/${encodeURIComponent(id)}`)),
  );

  server.registerTool(
    "list_my_packs",
    {
      title: "List my packs",
      description:
        "List packs you authored (all statuses, including drafts, pending and rejected). Optionally filter to one status. Requires packs:read and profile:read.",
      inputSchema: {
        status: z
          .enum(PACK_MODERATION_STATUSES)
          .optional()
          .describe(
            "Only return packs with this moderation status (draft, pending, approved, rejected). Omit for all statuses.",
          ),
        limit: z
          .number()
          .int()
          .positive()
          .max(50)
          .optional()
          .describe("Max packs to return (default 20)."),
      },
    },
    ({ status, limit }) =>
      handle(async () => {
        const me = await api.get<{ id: string }>("/users/me");
        const qs = queryString({
          authorId: me.id,
          status,
          limit: limit ?? 20,
        });
        return api.get(`/packs${qs}`);
      }),
  );

  server.registerTool(
    "create_pack",
    {
      title: "Create a pack",
      description:
        "Create a new elimination-quiz pack. It enters moderation before becoming public (unless your account is staff/trusted), or pass draft:true to save it privately without submitting for review. Requires packs:write.",
      inputSchema: createPackShape,
    },
    (input) => handle(() => api.post("/packs", input)),
  );

  server.registerTool(
    "update_pack",
    {
      title: "Update a pack",
      description:
        "Replace one of your own packs. Send the pack id plus the COMPLETE pack body — title, description, coverTone, format, tags and rounds — exactly as create_pack takes it, not just the fields you want to change: this replaces the pack, and omitting a field is rejected rather than leaving it untouched. Editing re-enters moderation; pass draft:true to unpublish it back to a private draft, or draft:false to (re)publish. Requires packs:write.",
      inputSchema: updatePackShape,
    },
    ({ id, ...patch }) =>
      handle(() => api.patch(`/packs/${encodeURIComponent(id)}`, patch)),
  );

  server.registerTool(
    "delete_pack",
    {
      title: "Delete a pack",
      description:
        "Permanently delete one of your own packs. This cannot be undone. Requires packs:delete.",
      inputSchema: { id: z.string().describe("The pack id to delete.") },
    },
    ({ id }) => handle(() => api.delete(`/packs/${encodeURIComponent(id)}`)),
  );
}
