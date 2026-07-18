import { readFile } from "node:fs/promises";
import { basename, extname } from "node:path";

/**
 * The largest image the backend accepts, matching the @fastify/multipart
 * `fileSize` cap on POST /media. Checked here so an oversized file fails fast
 * with a clear message instead of streaming a megabyte only to get a 413.
 */
export const MAX_IMAGE_BYTES = 1_048_576;

const CONTENT_TYPE_BY_EXT: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
};

/** A local image read from disk, ready to attach to a multipart upload. */
export interface LocalImage {
  filename: string;
  data: Buffer;
  contentType: string;
}

/**
 * Read and validate a local image file for upload. Throws an Error whose
 * message is safe to surface to the model (unsupported type, missing file,
 * empty, or too large) so it can correct course rather than hard-fail.
 */
export async function readImageFile(path: string): Promise<LocalImage> {
  const ext = extname(path).toLowerCase();
  const contentType = CONTENT_TYPE_BY_EXT[ext];
  if (!contentType) {
    throw new Error(
      `Unsupported image type "${ext || path}". Supported: .jpg, .jpeg, .png, .webp.`,
    );
  }

  let data: Buffer;
  try {
    data = await readFile(path);
  } catch {
    throw new Error(`Image file not found or unreadable: ${path}`);
  }

  if (data.byteLength === 0) {
    throw new Error(`Image file is empty: ${path}`);
  }
  if (data.byteLength > MAX_IMAGE_BYTES) {
    throw new Error(
      `Image is ${data.byteLength} bytes; the maximum upload size is ${MAX_IMAGE_BYTES} bytes (1MB).`,
    );
  }

  return { filename: basename(path), data, contentType };
}
