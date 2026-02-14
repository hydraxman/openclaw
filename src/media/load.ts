import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { mediaKindFromMime, type MediaKind } from "./constants.js";
import { fetchRemoteMedia } from "./fetch.js";
import { convertHeicToJpeg, normalizeExifOrientation } from "./image-ops.js";
import { detectMime, extensionForMime } from "./mime.js";

export type LoadedMedia = {
  buffer: Buffer;
  contentType?: string;
  mimeType?: string;
  fileName?: string;
  kind: MediaKind;
};

function isHttpUrl(value: string): boolean {
  return /^https?:\/\//i.test(value.trim());
}

function toFilePath(source: string): string {
  const trimmed = source.trim();
  if (trimmed.startsWith("file://")) {
    return fileURLToPath(trimmed);
  }
  return trimmed;
}

async function loadLocalFile(source: string, maxBytes?: number): Promise<LoadedMedia> {
  const filePath = toFilePath(source);
  const stats = await fs.stat(filePath);
  if (maxBytes && stats.size > maxBytes) {
    throw new Error(`Media exceeds maxBytes ${maxBytes} (size ${stats.size}).`);
  }

  const buffer = await fs.readFile(filePath);
  const contentType = await detectMime({ buffer, filePath });
  const kind = mediaKindFromMime(contentType ?? undefined);
  return {
    buffer,
    contentType: contentType ?? undefined,
    mimeType: contentType ?? undefined,
    fileName: path.basename(filePath),
    kind,
  };
}

async function loadRemoteFile(source: string, maxBytes?: number): Promise<LoadedMedia> {
  const media = await fetchRemoteMedia({ url: source, maxBytes });
  const kind = mediaKindFromMime(media.contentType ?? undefined);
  return {
    buffer: media.buffer,
    contentType: media.contentType ?? undefined,
    mimeType: media.contentType ?? undefined,
    fileName: media.fileName ?? undefined,
    kind,
  };
}

export async function loadWebMediaRaw(source: string, maxBytes?: number): Promise<LoadedMedia> {
  if (isHttpUrl(source)) {
    return await loadRemoteFile(source, maxBytes);
  }
  return await loadLocalFile(source, maxBytes);
}

export async function loadWebMedia(source: string, maxBytes?: number): Promise<LoadedMedia> {
  const media = await loadWebMediaRaw(source, maxBytes);
  if (media.kind !== "image") {
    return media;
  }

  const contentType = (media.contentType ?? "").toLowerCase();
  if (contentType === "image/heic" || contentType === "image/heif") {
    const converted = await convertHeicToJpeg(media.buffer);
    const ext = extensionForMime("image/jpeg") ?? ".jpg";
    const baseName = media.fileName ? path.parse(media.fileName).name : "image";
    return {
      buffer: converted,
      contentType: "image/jpeg",
      mimeType: "image/jpeg",
      fileName: `${baseName}${ext}`,
      kind: "image",
    };
  }

  if (contentType === "image/gif") {
    return media;
  }

  const normalized = await normalizeExifOrientation(media.buffer);
  return {
    ...media,
    buffer: normalized,
  };
}
