import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Config } from "./config.js";
import { ApiClient } from "./api-client.js";
import { registerPackTools } from "./tools/pack-tools.js";
import { registerModerationTools } from "./tools/moderation-tools.js";
import { registerMediaTools } from "./tools/media-tools.js";

export const SERVER_NAME = "velanto-mcp";
export const SERVER_VERSION = "0.1.0";

/**
 * Build a fully wired Velanto MCP server. `fetchImpl` is injectable so tests
 * can drive the tools without a live backend; in production it defaults to the
 * global fetch inside ApiClient.
 */
export function createServer(config: Config, fetchImpl?: typeof fetch): McpServer {
  const api = new ApiClient(config, fetchImpl);
  const server = new McpServer({
    name: SERVER_NAME,
    version: SERVER_VERSION,
  });
  registerPackTools(server, api);
  registerModerationTools(server, api);
  registerMediaTools(server, api);
  return server;
}
