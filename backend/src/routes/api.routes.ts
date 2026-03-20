import { Router, Request, Response } from 'express';
import { telegramService } from '../services/telegram.service';
import busboy from 'busboy';
import bigInt from 'big-integer';
import { generateRandomBytes } from 'telegram/Helpers';
import { Api } from 'telegram';
import { BACKEND_CONSTANTS } from '../constants/BackendConstants';

const router = Router();

router.get('/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ... (helpers like handleTelegramStream will be here or imported)
async function handleTelegramStream(stream: any, filename: string, fileSize: number, metadata: any, res: Response) {
    console.log(`[Backend] Streaming started for: ${filename}, size: ${fileSize}`);
    try {
        const isLarge = fileSize > 10 * 1024 * 1024;
        const fileId = bigInt(generateRandomBytes(8).toString('hex'), 16);
        const partSize = isLarge ? BACKEND_CONSTANTS.TELEGRAM.UPLOAD_CHUNK_SIZE : 128 * 1024; 
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
                    bytes: partBytes
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
                bytes: finalBytes
            });
            partIndex++;
        }

        const finalInputFile = isLarge
            ? new Api.InputFileBig({ id: fileId, parts: partIndex, name: filename })
            : new Api.InputFile({ id: fileId, parts: partIndex, name: filename, md5Checksum: '' });

        const dateStr = metadata.creationTime 
            ? new Date(metadata.creationTime).toLocaleString()
            : new Date().toLocaleString();

        let caption = `${filename}\n📅 Date: ${dateStr}`;
        if (metadata.location) {
            caption += `\n📍 Location: ${metadata.location.latitude}, ${metadata.location.longitude}`;
        }
        if (metadata.hash) {
            caption += `\n[hash:${metadata.hash}]`;
        }

        const result = await telegramService.sendFile('me', {
            file: finalInputFile,
            caption: caption,
            forceDocument: true,
            workers: 1,
        });

        if (!res.headersSent) res.json(result);
    } catch (error: any) {
        console.error('[Backend] Upload error:', error);
        if (!res.headersSent) res.status(500).json({ error: error.message });
    }
}

router.get('/health', (_req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));

router.post('/send-code', async (req, res) => {
    try {
        const result = await telegramService.sendCode(req.body.phoneNumber);
        res.json(result);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

router.post('/sign-in', async (req, res) => {
    try {
        const { phoneNumber, phoneCodeHash, code } = req.body;
        await telegramService.signIn(phoneNumber, phoneCodeHash, code);
        res.json({ success: true });
    } catch (error: any) {
        if (error.message.includes('SESSION_PASSWORD_NEEDED')) {
            return res.status(401).json({ error: 'SESSION_PASSWORD_NEEDED' });
        }
        res.status(500).json({ error: error.message });
    }
});

router.post('/check-password', async (req, res) => {
    try {
        await telegramService.checkPassword(req.body.password);
        res.json({ success: true });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

router.get('/auth-status', async (_req, res) => {
    const authorized = await telegramService.isAuthenticated();
    res.json({ authorized });
});

router.post('/upload', (req, res) => {
    const filename = (req.query.filename as string) || 'file';
    const fileSize = parseInt(req.query.fileSize as string) || 0;
    const metadataRaw = req.query.metadata as string;
    let metadata: any = {};
    if (metadataRaw) {
        try { metadata = JSON.parse(Buffer.from(metadataRaw, 'base64').toString()); } catch (e) {}
    }

    const contentType = req.headers['content-type'] || '';
    if (contentType.includes('multipart/form-data')) {
        const bb = busboy({ headers: req.headers });
        bb.on('file', (_name, file) => handleTelegramStream(file, filename, fileSize, metadata, res));
        req.pipe(bb);
    } else {
        handleTelegramStream(req, filename, fileSize, metadata, res);
    }
});

router.post('/upload-batch', async (req: Request, res: Response) => {
    console.log('[Backend] POST /api/upload-batch');
    const bb = busboy({ headers: req.headers, limits: { fileSize: 1024 * 1024 * 1024 } });
    const uploadPromises: Promise<any>[] = [];
    const mediaResults: { [key: number]: { inputFile: any, filename: string, hash: string } } = {};
    const hashes: string[] = [];
    let fileCount = 0;

    bb.on('field', (name, val) => {
        if (name === 'hashes') hashes.push(val);
    });

    bb.on('file', (name, file, info) => {
        const index = fileCount++;
        const { filename } = info;
        
        const uploadPromise = (async () => {
            try {
                let bytes = Buffer.alloc(0);
                for await (const chunk of file) {
                    bytes = Buffer.concat([bytes, chunk]);
                }
                
                const fileSize = bytes.length;
                const isLarge = fileSize > 10 * 1024 * 1024;
                const fileId = bigInt(generateRandomBytes(8).toString('hex'), 16);
                const partSize = isLarge ? 512 * 1024 : 128 * 1024;
                const partCount = Math.ceil(fileSize / partSize);

                for (let i = 0; i < partCount; i++) {
                    const start = i * partSize;
                    const end = Math.min(start + partSize, fileSize);
                    const partBytes = bytes.slice(start, end);
                    await telegramService.uploadPart(isLarge, {
                        fileId,
                        filePart: i,
                        fileTotalParts: partCount,
                        bytes: partBytes
                    });
                }

                mediaResults[index] = {
                    inputFile: isLarge 
                        ? new Api.InputFileBig({ id: fileId, parts: partCount, name: filename })
                        : new Api.InputFile({ id: fileId, parts: partCount, name: filename, md5Checksum: '' }),
                    filename,
                    hash: '' // Will be filled from hashes array after field parsing
                };
            } catch (error) {
                console.error(`[Backend] Batch upload file error ${filename}:`, error);
                throw error;
            }
        })();
        uploadPromises.push(uploadPromise);
    });

    bb.on('finish', async () => {
        try {
            await Promise.all(uploadPromises);
            
            const results: any[] = [];
            for (let i = 0; i < fileCount; i++) {
                const res = mediaResults[i];
                if (!res) continue;
                
                const hash = hashes[i] || '';
                console.log(`[Backend] Sending file to Telegram: ${res.filename} (${hash})`);
                
                try {
                    const result = await telegramService.sendFile('me', {
                        file: res.inputFile,
                        caption: `${res.filename}\n[hash:${hash}]`,
                        forceDocument: true
                    });
                    results.push(result);
                } catch (sendErr: any) {
                    console.error(`[Backend] Failed to send ${res.filename} to Telegram:`, sendErr);
                    // Push error so the caller knows which one failed
                    results.push({ error: sendErr.message, filename: res.filename });
                }
            }

            res.json(results);
        } catch (error: any) {
            console.error('[Backend] Batch finish error:', error);
            if (!res.headersSent) res.status(500).json({ error: error.message });
        }
    });

    req.pipe(bb);
});

router.get('/cloud-media', async (req, res) => {
    try {
        const limit = parseInt(req.query.limit as string) || BACKEND_CONSTANTS.TELEGRAM.DEFAULT_LIMIT;
        const offsetId = parseInt(req.query.offsetId as string) || 0;
        const messages = await telegramService.getHistory('me', { limit, offsetId });
        
        const media = messages
            .filter((m: any) => m.media && (m.media.document || m.media.photo))
            .map((m: any) => ({
                id: m.id,
                date: m.date,
                message: m.message,
                filename: m.media.document?.attributes?.find((a: any) => a.fileName)?.fileName || 'attachment',
                size: m.media.document?.size,
                mimeType: m.media.document?.mimeType,
                // Extract hash from caption if present
                hash: m.message?.match(/\[hash:([a-f0-9]+)\]/)?.[1]
            }));

        res.json({ media });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

router.get('/restore', async (req, res) => {
    try {
        const hashes = new Set<string>();
        let lastId = 0;
        let total = 0;
        while (total < 1000) {
            const msgs = await telegramService.getHistory('me', { limit: 100, offsetId: lastId });
            console.log('[Backend] Restore messages:', msgs.length);
            if (msgs.length === 0) break;
            for (const m of msgs) {
                const match = (m as any).message?.match(/\[hash:([a-f0-9]+)\]/);
                if (match) hashes.add(match[1]);
                lastId = (m as any).id;
            }
            total += msgs.length;
        }
        res.json({ hashes: Array.from(hashes) });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

export default router;
