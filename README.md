# velanto-mcp

A [Model Context Protocol](https://modelcontextprotocol.io) server for the
[Velanto](https://playvelanto.com) API. It lets an AI assistant (Claude, or any
MCP client) create, edit, and moderate elimination-quiz packs on your behalf,
authenticated by a scoped **Personal Access Token** you control.

The server is a thin, well-typed wrapper over the Velanto REST API. It holds no
business logic and no database access — the API enforces authentication, scopes,
and validation, and a token can never do more than your own account can.

## Setup

### 1. Create a Personal Access Token

1. Sign in at [playvelanto.com](https://playvelanto.com) and open
   **Settings → API tokens**.
2. Create a token, choosing only the permissions the assistant needs
   (see [Scopes](#scopes)).
3. Copy the token (shown once — it starts with `vlt_pat_`). Treat it like a
   password.

### 2. Add the server to your MCP client

For **Claude Desktop**, add this to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "velanto": {
      "command": "npx",
      "args": ["-y", "velanto-mcp"],
      "env": {
        "VELANTO_API_TOKEN": "vlt_pat_your_token_here"
      }
    }
  }
}
```

Then restart the client and ask it to, for example, "create a 10-round pack of
the best sci-fi movies."

## Configuration

| Variable            | Required | Default                       | Description                                   |
| ------------------- | -------- | ----------------------------- | --------------------------------------------- |
| `VELANTO_API_TOKEN` | yes      | —                             | Your Personal Access Token (`vlt_pat_…`).     |
| `VELANTO_API_URL`   | no       | `https://api.playvelanto.com` | API base URL (use `http://localhost:3001` for local dev). |

## Scopes

A tool only works if your token carries the matching scope **and** your account
has the necessary role. Grant the least you need:

| Scope          | Enables                                              |
| -------------- | --------------------------------------------------- |
| `packs:read`   | `get_pack`, `list_my_packs`                         |
| `packs:write`  | `create_pack`, `update_pack`                        |
| `packs:delete` | `delete_pack`                                        |
| `moderation`   | the moderation tools (also requires a staff account) |
| `profile:read` | `list_my_packs` (to resolve your account)           |

## Tools

**Pack authoring**

- `get_pack` — fetch a pack by id (including your own pending packs).
- `list_my_packs` — list the packs you authored, all statuses.
- `create_pack` — create a new pack (enters moderation before going public).
- `update_pack` — edit one of your packs (re-enters moderation).
- `delete_pack` — permanently delete one of your packs.

**Moderation** (staff accounts, with the `moderation` scope)

- `list_moderation_queue` — packs awaiting review.
- `approve_pack` / `reject_pack` — resolve a pending pack.
- `list_reports` — user-filed content reports.
- `resolve_report` — mark a report reviewed or closed.

All five formats are supported. Every pack is pools (`groups`) plus `rounds` of
`slots`; the format fixes each round's slot shape:

| Format                                  | Round shape                                                                                        |
| --------------------------------------- | -------------------------------------------------------------------------------------------------- |
| `save_one`, `sacrifice_one`, `rank_blind` | Exactly 1 slot, drawing 2–8 items.                                                                 |
| `nxn`                                   | Exactly 2 slots (one per side), both `random`, 1–8 items per side.                                  |
| `1v1`                                   | Exactly 2 slots, both `random`, exactly 1 item per side.                                            |

Versus rounds (`nxn`, `1v1`) must pit two **different** groups against each
other, and every round must use the same two groups in the same order.

> The API validates every request and returns a clear error the assistant can
> act on.

## Development

```bash
npm install
npm run build      # compile to dist/
npm test           # vitest (in-memory MCP client ↔ server)
npm run typecheck
```

## License

MIT
