import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ApiClient } from "../api-client.js";
import { handle } from "./helpers.js";
import { readImageFile } from "./read-image-file.js";

/**
 * Media-upload tool. Lets the model turn a local image file into a Velanto
 * media key it can drop into a pack. Uploading is part of authoring a pack, so
 * it needs the same `packs:write` scope create/update do — the API enforces it.
 */
export function registerMediaTools(server: McpServer, api: ApiClient): void {
  server.registerTool(
    "upload_image",
    {
      title: "Upload an image",
      description:
        "Upload a local image file (.jpg, .png, or .webp, max 1MB) and get back a media key. Use that key as an image item's `value` (or a pack's coverImageKey) when you create or update a pack — it's how a local picture becomes part of a pack. Requires packs:write.",
      inputSchema: {
        path: z
          .string()
          .describe(
            "Absolute path to a local image file (.jpg, .jpeg, .png, or .webp).",
          ),
        kind: z
          .enum(["item", "cover"])
          .optional()
          .describe(
            "What the image is for: 'item' for a pack item image (default), or 'cover' for the pack cover.",
          ),
      },
    },
    ({ path, kind }) =>
      handle(async () => {
        const image = await readImageFile(path);
        const form = new FormData();
        form.set("kind", kind ?? "item");
        // Wrap the Buffer in a plain Uint8Array: a Node Buffer's backing store
        // is ArrayBufferLike (possibly SharedArrayBuffer), which BlobPart's type
        // rejects; a fresh Uint8Array is ArrayBuffer-backed.
        form.set(
          "file",
          new Blob([new Uint8Array(image.data)], { type: image.contentType }),
          image.filename,
        );
        return api.postForm("/media", form);
      }),
  );
}
