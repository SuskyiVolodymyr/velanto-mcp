import { describe, it, expect, vi } from "vitest";
import { ApiClient, VelantoApiError } from "../src/api-client.js";

const cfg = { apiUrl: "https://api.test", token: "vlt_pat_a_b" };

function res(status: number, body?: unknown): Response {
  return new Response(body === undefined ? "" : JSON.stringify(body), {
    status,
  });
}

describe("ApiClient", () => {
  it("attaches the bearer token and serializes the body on POST", async () => {
    const fetchMock = vi.fn().mockResolvedValue(res(201, { id: "p1" }));
    const api = new ApiClient(cfg, fetchMock as unknown as typeof fetch);

    const out = await api.post("/packs", { title: "x" });

    expect(out).toEqual({ id: "p1" });
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.test/packs");
    expect(init.method).toBe("POST");
    const headers = init.headers as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer vlt_pat_a_b");
    expect(headers["Content-Type"]).toBe("application/json");
    expect(JSON.parse(init.body as string)).toEqual({ title: "x" });
  });

  it("omits the body and content-type on GET", async () => {
    const fetchMock = vi.fn().mockResolvedValue(res(200, []));
    const api = new ApiClient(cfg, fetchMock as unknown as typeof fetch);

    await api.get("/packs");

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(init.body).toBeUndefined();
    expect((init.headers as Record<string, string>)["Content-Type"]).toBe(
      undefined,
    );
  });

  it("throws VelantoApiError carrying status and message on a non-2xx", async () => {
    // A fresh Response per call — a body can only be read once.
    const fetchMock = vi
      .fn()
      .mockImplementation(() =>
        Promise.resolve(res(403, { message: "missing scope: packs:write" })),
      );
    const api = new ApiClient(cfg, fetchMock as unknown as typeof fetch);

    const err = await api.post("/packs", {}).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(VelantoApiError);
    expect(err).toMatchObject({ status: 403 });
    expect((err as VelantoApiError).message).toMatch(/missing scope/);
  });

  it("returns null for an empty (204-style) response body", async () => {
    const fetchMock = vi.fn().mockResolvedValue(res(200));
    const api = new ApiClient(cfg, fetchMock as unknown as typeof fetch);
    expect(await api.delete("/packs/p1")).toBeNull();
  });

  it("posts multipart form data with the bearer token and no explicit content-type", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(res(201, { key: "media/item/x.webp" }));
    const api = new ApiClient(cfg, fetchMock as unknown as typeof fetch);

    const form = new FormData();
    form.set("kind", "item");
    form.set(
      "file",
      new Blob([Uint8Array.from([1, 2, 3])], { type: "image/png" }),
      "x.png",
    );

    const out = await api.postForm("/media", form);

    expect(out).toEqual({ key: "media/item/x.webp" });
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.test/media");
    expect(init.method).toBe("POST");
    const headers = init.headers as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer vlt_pat_a_b");
    // Must NOT set Content-Type: fetch derives the multipart boundary itself,
    // and a hand-set value would omit it and break the upload.
    expect(headers["Content-Type"]).toBeUndefined();
    expect(init.body).toBe(form);
  });

  it("surfaces a non-2xx multipart response as a VelantoApiError", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(res(403, { message: "missing scope: packs:write" }));
    const api = new ApiClient(cfg, fetchMock as unknown as typeof fetch);

    const err = await api
      .postForm("/media", new FormData())
      .catch((e: unknown) => e);
    expect(err).toBeInstanceOf(VelantoApiError);
    expect((err as VelantoApiError).status).toBe(403);
  });
});
