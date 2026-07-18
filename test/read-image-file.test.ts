import { afterAll, describe, it, expect } from "vitest";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { readImageFile } from "../src/tools/read-image-file.js";

// A real temp dir; each case writes a file and reads it back through the helper.
const dirPromise = mkdtemp(join(tmpdir(), "velanto-mcp-img-"));

async function writeTemp(name: string, bytes: Buffer): Promise<string> {
  const path = join(await dirPromise, name);
  await writeFile(path, bytes);
  return path;
}

afterAll(async () => {
  await rm(await dirPromise, { recursive: true, force: true });
});

describe("readImageFile", () => {
  it("reads a png and reports its name, bytes and content type", async () => {
    const bytes = Buffer.from([0x89, 0x50, 0x4e, 0x47]);
    const path = await writeTemp("cover.png", bytes);

    const image = await readImageFile(path);

    expect(image.filename).toBe("cover.png");
    expect(image.contentType).toBe("image/png");
    expect(image.data.equals(bytes)).toBe(true);
  });

  it("maps .jpg and .jpeg to image/jpeg", async () => {
    const jpg = await readImageFile(await writeTemp("a.jpg", Buffer.from([1])));
    const jpeg = await readImageFile(
      await writeTemp("a.jpeg", Buffer.from([1])),
    );

    expect(jpg.contentType).toBe("image/jpeg");
    expect(jpeg.contentType).toBe("image/jpeg");
  });

  it("rejects an unsupported extension", async () => {
    const path = await writeTemp("notes.txt", Buffer.from("hello"));

    await expect(readImageFile(path)).rejects.toThrow(/unsupported image type/i);
  });

  it("rejects a path that does not exist", async () => {
    await expect(
      readImageFile(join(await dirPromise, "missing.png")),
    ).rejects.toThrow(/not found|unreadable/i);
  });

  it("rejects an empty file", async () => {
    const path = await writeTemp("empty.png", Buffer.alloc(0));

    await expect(readImageFile(path)).rejects.toThrow(/empty/i);
  });

  it("rejects a file larger than 1MB", async () => {
    const path = await writeTemp("big.png", Buffer.alloc(1_048_577, 1));

    await expect(readImageFile(path)).rejects.toThrow(/maximum upload size/i);
  });
});
