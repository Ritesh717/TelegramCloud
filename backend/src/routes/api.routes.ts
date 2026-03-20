import { Router, Request, Response } from "express";
import busboy from "busboy";
import bigInt from "big-integer";
import path from "path";
import { Api } from "telegram";
import { generateRandomBytes } from "telegram/Helpers";

import { BACKEND_CONSTANTS } from "../constants/BackendConstants";
import { telegramService } from "../services/telegram.service";

const router = Router();
const DEFAULT_FALLBACK_TIMESTAMP = new Date("2015-01-01T00:00:00.000Z").getTime();

const formatSize = (bytes: number) => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
};

const normalizeTelegramDate = (value: unknown) => {
  if (value instanceof Date) return value.getTime();
  if (typeof value === "number") {
    if (value <= 0) return DEFAULT_FALLBACK_TIMESTAMP;
    return value < 1_000_000_000_000 ? value * 1000 : value;
  }
  if (typeof value === "string") {
    const numeric = Number(value);
    if (!Number.isNaN(numeric)) {
      return normalizeTelegramDate(numeric);
    }
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? DEFAULT_FALLBACK_TIMESTAMP : parsed;
  }
  return DEFAULT_FALLBACK_TIMESTAMP;
};

const sanitizeCaptionLine = (label: string, value: string) =>
  `${label}: ${value}`;

const extractCreatedAtFromCaption = (caption: string) => {
  const tagged = caption.match(/\[createdAt:(\d{10,13})\]/);
  if (tagged?.[1]) {
    return normalizeTelegramDate(Number(tagged[1]));
  }

  const dateLine = caption.match(/(?:^|\n)Date:\s*(.+?)(?:\n|$)/);
  if (dateLine?.[1]) {
    return normalizeTelegramDate(dateLine[1].trim());
  }

  return null;
};

const choosePartSize = (fileSize: number) => {
  if (fileSize >= BACKEND_CONSTANTS.TELEGRAM.LARGE_FILE_THRESHOLD) {
    return BACKEND_CONSTANTS.TELEGRAM.UPLOAD_CHUNK_SIZE;
  }

  if (fileSize >= 100 * 1024 * 1024) {
    return BACKEND_CONSTANTS.TELEGRAM.UPLOAD_CHUNK_SIZE;
  }

  if (fileSize >= 20 * 1024 * 1024) {
    return BACKEND_CONSTANTS.TELEGRAM.MEDIUM_UPLOAD_CHUNK_SIZE;
  }

  return BACKEND_CONSTANTS.TELEGRAM.SMALL_UPLOAD_CHUNK_SIZE;
};

async function handleTelegramStream(
  stream: any,
  filename: string,
  fileSize: number,
  metadata: any,
  res: Response,
) {
  const startTime = Date.now();
  try {
    const isLarge = fileSize > 10 * 1024 * 1024;
    const fileId = bigInt(generateRandomBytes(8).toString("hex"), 16);
    const partSize = choosePartSize(fileSize);
    const partCount = Math.ceil(fileSize / partSize);

    let partIndex = 0;
    let chunks: Buffer[] = [];
    let currentSize = 0;

    for await (const chunk of stream) {
      chunks.push(chunk);
      currentSize += chunk.length;

      while (currentSize >= partSize) {
        const combined = Buffer.concat(chunks);
        const partBytes = combined.slice(0, partSize);
        const remaining = combined.slice(partSize);

        await telegramService.uploadPart(isLarge, {
          fileId,
          filePart: partIndex,
          fileTotalParts: partCount,
          bytes: partBytes,
        });

        chunks = [remaining];
        currentSize = remaining.length;
        partIndex++;
      }
    }

    if (currentSize > 0) {
      const finalBytes = Buffer.concat(chunks);
      await telegramService.uploadPart(isLarge, {
        fileId,
        filePart: partIndex,
        fileTotalParts: partCount,
        bytes: finalBytes,
      });
      partIndex++;
    }

    const finalInputFile = isLarge
      ? new Api.InputFileBig({ id: fileId, parts: partIndex, name: filename })
      : new Api.InputFile({
          id: fileId,
          parts: partIndex,
          name: filename,
          md5Checksum: "",
        });

    const createdAt = metadata.creationTime
      ? normalizeTelegramDate(metadata.creationTime)
      : DEFAULT_FALLBACK_TIMESTAMP;
    const dateStr = new Date(createdAt).toLocaleString();

    const captionLines = [filename, sanitizeCaptionLine("Date", dateStr)];
    captionLines.push(`[createdAt:${createdAt}]`);
    if (metadata.location) {
      captionLines.push(
        sanitizeCaptionLine(
          "Location",
          `${metadata.location.latitude}, ${metadata.location.longitude}`,
        ),
      );
    }
    if (metadata.hash) {
      captionLines.push(`[hash:${metadata.hash}]`);
    }

    const result = await telegramService.sendFile("me", {
      file: finalInputFile,
      caption: captionLines.join("\n"),
      forceDocument: true,
      workers: 1,
    });

    const duration = Date.now() - startTime;
    console.log(`[Backend] ✅ Uploaded: ${filename} (${formatSize(fileSize)}) in ${duration}ms`);

    if (!res.headersSent) res.json(result);
  } catch (error: any) {
    console.error("[Backend] Upload error:", error);
    if (!res.headersSent) res.status(500).json({ error: error.message });
  }
}

router.get("/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

router.post("/send-code", async (req, res) => {
  try {
    const result = await telegramService.sendCode(req.body.phoneNumber);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/sign-in", async (req, res) => {
  try {
    const { phoneNumber, phoneCodeHash, code } = req.body;
    await telegramService.signIn(phoneNumber, phoneCodeHash, code);
    res.json({ success: true });
  } catch (error: any) {
    if (error.message.includes("SESSION_PASSWORD_NEEDED")) {
      return res.status(401).json({ error: "SESSION_PASSWORD_NEEDED" });
    }
    res.status(500).json({ error: error.message });
  }
});

router.post("/check-password", async (req, res) => {
  try {
    await telegramService.checkPassword(req.body.password);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/auth-status", async (_req, res) => {
  console.log("[Backend] Checking auth status...");
  const authorized = await telegramService.isAuthenticated();
  console.log("[Backend] Auth status:", authorized);
  res.json({ authorized });
});

router.post("/upload", (req, res) => {
  const filename = (req.query.filename as string) || "file";
  const fileSize = parseInt(req.query.fileSize as string) || 0;
  const metadataRaw = req.query.metadata as string;
  let metadata: any = {};
  if (metadataRaw) {
    try {
      metadata = JSON.parse(Buffer.from(metadataRaw, "base64").toString());
    } catch {
      metadata = {};
    }
  }

  const contentType = req.headers["content-type"] || "";
  if (contentType.includes("multipart/form-data")) {
    const bb = busboy({ headers: req.headers });
    bb.on("file", (_name, file) =>
      handleTelegramStream(file, filename, fileSize, metadata, res),
    );
    req.pipe(bb);
  } else {
    handleTelegramStream(req, filename, fileSize, metadata, res);
  }
});

router.post("/upload-batch", async (req: Request, res: Response) => {
  console.log("[Backend] Uploading batch...");
  const bb = busboy({
    headers: req.headers,
    limits: { fileSize: 1024 * 1024 * 1024 },
  });
  const uploadPromises: Promise<any>[] = [];
  const mediaResults: {
    [key: number]: { inputFile: any; filename: string; fileSize: number; duration: number };
  } = {};
  let manifest: Array<{
    filename?: string;
    hash?: string;
    fileSize?: number;
    metadata?: any;
  }> = [];
  let fileCount = 0;

  bb.on("field", (name, val) => {
    if (name === "manifest") {
      try {
        const parsed = JSON.parse(val);
        manifest = Array.isArray(parsed) ? parsed : [];
      } catch {
        manifest = [];
      }
    }
  });

  bb.on("file", (_name, file, info) => {
    const index = fileCount++;
    console.log("[Backend] Uploading file:", index);
    const { filename } = info;
    const startTime = Date.now();

    const uploadPromise = (async () => {
      let bytes = Buffer.alloc(0);
      for await (const chunk of file) {
        bytes = Buffer.concat([bytes, chunk]);
      }

      const fileSize = bytes.length;
      const isLarge = fileSize > 10 * 1024 * 1024;
      const fileId = bigInt(generateRandomBytes(8).toString("hex"), 16);
      const partSize = choosePartSize(fileSize);
      const partCount = Math.ceil(fileSize / partSize);

      for (let i = 0; i < partCount; i++) {
        const start = i * partSize;
        const end = Math.min(start + partSize, fileSize);
        const partBytes = bytes.slice(start, end);
        await telegramService.uploadPart(isLarge, {
          fileId,
          filePart: i,
          fileTotalParts: partCount,
          bytes: partBytes,
        });
      }

      mediaResults[index] = {
        inputFile: isLarge
          ? new Api.InputFileBig({
              id: fileId,
              parts: partCount,
              name: filename,
            })
          : new Api.InputFile({
              id: fileId,
              parts: partCount,
              name: filename,
              md5Checksum: "",
            }),
        filename,
        fileSize,
        duration: Date.now() - startTime,
      };
    })();
    console.log("[Backend] Uploading file:", index);
    uploadPromises.push(uploadPromise);
  });

  bb.on("finish", async () => {
    try {
      await Promise.all(uploadPromises);
      console.log(`[Backend] Total Batch: ${fileCount} files uploaded`);
      const results: any[] = [];
      for (let i = 0; i < fileCount; i++) {
        const item = mediaResults[i];
        if (!item) continue;
        
        console.log(`[Backend] ✅ Batch File [${i}]: ${item.filename} (${formatSize(item.fileSize)}) in ${item.duration}ms`);
        const manifestItem = manifest[i] || {};
        const hash = manifestItem.hash || "";
        const metadata = manifestItem.metadata || {};
        const createdAt = metadata.creationTime
          ? normalizeTelegramDate(metadata.creationTime)
          : DEFAULT_FALLBACK_TIMESTAMP;
        const dateStr = new Date(createdAt).toLocaleString();
        const captionLines = [
          item.filename,
          sanitizeCaptionLine("Date", dateStr),
          `[createdAt:${createdAt}]`,
        ];

        if (metadata.location) {
          captionLines.push(
            sanitizeCaptionLine(
              "Location",
              `${metadata.location.latitude}, ${metadata.location.longitude}`,
            ),
          );
        }

        if (hash) {
          captionLines.push(`[hash:${hash}]`);
        }

        try {
          const result = await telegramService.sendFile("me", {
            file: item.inputFile,
            caption: captionLines.join("\n"),
            forceDocument: true,
          });
          results.push(result);
        } catch (sendErr: any) {
          results.push({ error: sendErr.message, filename: item.filename });
        }
      }

      res.json(results);
    } catch (error: any) {
      if (!res.headersSent) res.status(500).json({ error: error.message });
    }
  });

  req.pipe(bb);
});

router.get("/cloud-media", async (req, res) => {
  try {
    const limit =
      parseInt(req.query.limit as string) ||
      BACKEND_CONSTANTS.TELEGRAM.DEFAULT_LIMIT;
    const offsetId = parseInt(req.query.offsetId as string) || 0;
    const messages = await telegramService.getHistory("me", {
      limit,
      offsetId,
    });

    const media = messages
      .filter(
        (message: any) =>
          message.media && (message.media.document || message.media.photo),
      )
      .map((message: any) => {
        const photoSizes = message.media?.photo?.sizes || [];
        const largestPhoto =
          photoSizes.length > 0 ? photoSizes[photoSizes.length - 1] : null;
        return {
          id: message.id,
          date:
            extractCreatedAtFromCaption(message.message || "") ??
            normalizeTelegramDate(message.date),
          message: message.message || "",
          filename:
            message.media.document?.attributes?.find(
              (attribute: any) => attribute.fileName,
            )?.fileName || `item-${message.id}`,
          size: message.media.document?.size || largestPhoto?.size || 0,
          mimeType: message.media.document?.mimeType || "image/jpeg",
          mediaType: message.media?.photo
            ? "photo"
            : message.media?.document?.mimeType?.startsWith("video/")
              ? "video"
              : "document",
          thumbnail: null,
          hash: message.message?.match(/\[hash:([a-f0-9]+)\]/)?.[1] || null,
        };
      });

    res.json({ media });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/cloud-media/:id/download", async (req, res) => {
  try {
    const messageId = parseInt(req.params.id, 10);
    const message: any = await telegramService.getMessageById("me", messageId);

    if (!message) {
      return res.status(404).json({ error: "Media item not found" });
    }

    const payload = await telegramService.downloadMessageMedia(message);
    if (!payload) {
      return res.status(404).json({ error: "Media payload is unavailable" });
    }

    const filename =
      message.media?.document?.attributes?.find(
        (attribute: any) => attribute.fileName,
      )?.fileName || `cloud-${messageId}`;
    const mimeType =
      message.media?.document?.mimeType || "application/octet-stream";
    const buffer =
      typeof payload === "string"
        ? Buffer.from(payload)
        : Buffer.isBuffer(payload)
          ? payload
          : Buffer.from(payload as any);

    res.setHeader("Content-Type", mimeType);
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${path.basename(filename)}"`,
    );
    res.send(buffer);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/restore", async (_req, res) => {
  try {
    const hashes = new Set<string>();
    let lastId = 0;
    let total = 0;

    while (total < 1000) {
      const messages = await telegramService.getHistory("me", {
        limit: 100,
        offsetId: lastId,
      });
      if (messages.length === 0) break;

      for (const message of messages) {
        const match = (message as any).message?.match(/\[hash:([a-f0-9]+)\]/);
        if (match) hashes.add(match[1]);
        lastId = (message as any).id;
      }

      total += messages.length;
    }

    res.json({ hashes: Array.from(hashes) });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
