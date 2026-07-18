import { describe, it, expect, vi } from "vitest";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createServer } from "../src/server.js";

function res(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status });
}

/** Wire a Client to a fresh server over an in-memory transport pair. */
async function harness(fetchImpl: unknown): Promise<Client> {
  const server = createServer(
    { apiUrl: "https://api.test", token: "vlt_pat_a_b" },
    fetchImpl as typeof fetch,
  );
  const [clientTransport, serverTransport] =
    InMemoryTransport.createLinkedPair();
  const client = new Client({ name: "test", version: "1.0.0" });
  await Promise.all([
    server.connect(serverTransport),
    client.connect(clientTransport),
  ]);
  return client;
}

const VALID_PACK = {
  title: "Best Movies",
  description: "Pick each round.",
  coverTone: "cyan",
  format: "save_one",
  tags: ["Movies"],
  groups: [
    {
      id: "g1",
      name: "90s",
      items: [{ id: "i1", type: "text", title: "Matrix", value: "1999" }],
    },
  ],
  rounds: [{ id: "r1", slots: [{ groupId: "g1", mode: "manual", itemIds: ["i1"] }] }],
};

function textOf(result: unknown): string {
  const content = (result as { content: { text: string }[] }).content;
  return content.map((c) => c.text).join("\n");
}

describe("velanto-mcp server", () => {
  it("exposes exactly the pack and moderation tools", async () => {
    const client = await harness(vi.fn());
    const { tools } = await client.listTools();
    expect(tools.map((t) => t.name).sort()).toEqual(
      [
        "approve_pack",
        "create_pack",
        "delete_pack",
        "get_pack",
        "list_moderation_queue",
        "list_my_packs",
        "list_reports",
        "reject_pack",
        "resolve_report",
        "update_pack",
        "upload_image",
      ].sort(),
    );
  });

  it("get_pack calls GET /packs/:id and returns the body", async () => {
    const fetchMock = vi.fn().mockResolvedValue(res(200, { id: "p1", title: "Movies" }));
    const client = await harness(fetchMock);

    const out = await client.callTool({ name: "get_pack", arguments: { id: "p1" } });

    expect((fetchMock.mock.calls[0] as string[])[0]).toBe(
      "https://api.test/packs/p1",
    );
    expect(textOf(out)).toContain("Movies");
    expect((out as { isError?: boolean }).isError).toBeFalsy();
  });

  it("list_my_packs resolves whoami then filters by author id", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(res(200, { id: "u1" }))
      .mockResolvedValueOnce(res(200, { items: [] }));
    const client = await harness(fetchMock);

    await client.callTool({ name: "list_my_packs", arguments: {} });

    expect((fetchMock.mock.calls[0] as string[])[0]).toBe(
      "https://api.test/users/me",
    );
    expect((fetchMock.mock.calls[1] as string[])[0]).toContain("authorId=u1");
  });

  it("create_pack posts the pack body to /packs", async () => {
    const fetchMock = vi.fn().mockResolvedValue(res(201, { id: "p9" }));
    const client = await harness(fetchMock);

    await client.callTool({ name: "create_pack", arguments: VALID_PACK });

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.test/packs");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body as string).title).toBe("Best Movies");
  });

  it("create_pack forwards a coverImageKey (a custom cover from upload_image)", async () => {
    const fetchMock = vi.fn().mockResolvedValue(res(201, { id: "p10" }));
    const client = await harness(fetchMock);

    await client.callTool({
      name: "create_pack",
      arguments: { ...VALID_PACK, coverImageKey: "media/cover/abc.webp" },
    });

    // The zod shape must keep coverImageKey — otherwise a cover uploaded via
    // upload_image is silently dropped and can never attach to a pack.
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(init.body as string).coverImageKey).toBe(
      "media/cover/abc.webp",
    );
  });

  it("surfaces an API error as an isError result the model can read", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        res(403, { message: "Token is missing a required scope: packs:write" }),
      );
    const client = await harness(fetchMock);

    const out = await client.callTool({
      name: "create_pack",
      arguments: VALID_PACK,
    });

    expect((out as { isError?: boolean }).isError).toBe(true);
    expect(textOf(out)).toContain("missing a required scope");
  });

  it("reject_pack posts the reason to the reject endpoint", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(res(200, { id: "p1", status: "rejected" }));
    const client = await harness(fetchMock);

    await client.callTool({
      name: "reject_pack",
      arguments: { id: "p1", reason: "duplicate" },
    });

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.test/packs/p1/reject");
    expect(JSON.parse(init.body as string)).toEqual({ reason: "duplicate" });
  });

  it("resolve_report posts to the chosen action endpoint", async () => {
    const fetchMock = vi.fn().mockResolvedValue(res(200, { id: "r1" }));
    const client = await harness(fetchMock);

    await client.callTool({
      name: "resolve_report",
      arguments: { id: "r1", action: "close" },
    });

    expect((fetchMock.mock.calls[0] as string[])[0]).toBe(
      "https://api.test/reports/r1/close",
    );
  });

  it("upload_image reads the file and posts it as multipart to /media", async () => {
    const dir = await mkdtemp(join(tmpdir(), "velanto-mcp-srv-"));
    const path = join(dir, "cover.png");
    await writeFile(path, Buffer.from([0x89, 0x50, 0x4e, 0x47]));

    const fetchMock = vi
      .fn()
      .mockResolvedValue(res(201, { key: "media/cover/abc.webp" }));
    const client = await harness(fetchMock);

    const out = await client.callTool({
      name: "upload_image",
      arguments: { path, kind: "cover" },
    });

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.test/media");
    expect(init.method).toBe("POST");
    // A FormData body carrying the kind + the file part.
    const form = init.body as FormData;
    expect(form).toBeInstanceOf(FormData);
    expect(form.get("kind")).toBe("cover");
    expect(form.get("file")).toBeInstanceOf(Blob);
    // The returned key is surfaced for use in a pack.
    expect(textOf(out)).toContain("media/cover/abc.webp");
    expect((out as { isError?: boolean }).isError).toBeFalsy();
  });

  it("upload_image returns a readable error when the file is missing", async () => {
    const client = await harness(vi.fn());

    const out = await client.callTool({
      name: "upload_image",
      arguments: { path: "/no/such/image.png" },
    });

    expect((out as { isError?: boolean }).isError).toBe(true);
    expect(textOf(out)).toMatch(/not found|unreadable/i);
  });
});
