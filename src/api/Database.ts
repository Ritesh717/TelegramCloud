import * as SQLite from 'expo-sqlite';
import { APP_CONSTANTS } from '../constants/AppConstants';

export interface UploadedFile {
  id?: number;
  assetId: string | null;
  hash: string;
  telegramMessageId: number;
  chatId: string;
  uploadedAt: number;
}

export interface MediaIndexRecord {
  telegramMessageId: number;
  assetId?: string | null;
  hash?: string | null;
  filename: string;
  mediaType: 'photo' | 'video' | 'document';
  mimeType?: string | null;
  size: number;
  caption?: string | null;
  thumbnailUri?: string | null;
  createdAt: number;
  syncedAt: number;
  metadataJson?: string | null;
}

export type QueueStatus =
  | 'queued'
  | 'uploading'
  | 'retrying'
  | 'completed'
  | 'failed'
  | 'cancelled'
  | 'duplicate';

export interface UploadQueueItem {
  id?: number;
  assetId: string;
  uri: string;
  filename: string;
  fileSize: number;
  mediaType: string;
  creationTime: number;
  hash?: string | null;
  status: QueueStatus;
  progress: number;
  attempts: number;
  maxAttempts: number;
  nextRetryAt: number;
  errorMessage?: string | null;
  createdAt: number;
  updatedAt: number;
}

export interface SyncCheckpoint {
  scope: string;
  lastMessageId: number;
  lastSyncedAt: number;
}

export interface LocalDataSummary {
  uploadedCount: number;
  indexedCount: number;
  queuedCount: number;
}

const now = () => Date.now();

class DBService {
  private db: SQLite.SQLiteDatabase | null = null;

  async initialize() {
    if (this.db) return;

    this.db = await SQLite.openDatabaseAsync(APP_CONSTANTS.DATABASE.NAME);
    await this.db.execAsync(`
      PRAGMA journal_mode = WAL;

      CREATE TABLE IF NOT EXISTS uploaded_files (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        assetId TEXT,
        hash TEXT NOT NULL,
        telegramMessageId INTEGER NOT NULL DEFAULT 0,
        chatId TEXT NOT NULL,
        uploadedAt INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS media_index (
        telegramMessageId INTEGER PRIMARY KEY NOT NULL,
        assetId TEXT,
        hash TEXT,
        filename TEXT NOT NULL,
        mediaType TEXT NOT NULL,
        mimeType TEXT,
        size INTEGER NOT NULL DEFAULT 0,
        caption TEXT,
        thumbnailUri TEXT,
        createdAt INTEGER NOT NULL,
        syncedAt INTEGER NOT NULL,
        metadataJson TEXT
      );

      CREATE TABLE IF NOT EXISTS sync_state (
        scope TEXT PRIMARY KEY NOT NULL,
        lastMessageId INTEGER NOT NULL DEFAULT 0,
        lastSyncedAt INTEGER NOT NULL DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS upload_queue (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        assetId TEXT NOT NULL UNIQUE,
        uri TEXT NOT NULL,
        filename TEXT NOT NULL,
        fileSize INTEGER NOT NULL,
        mediaType TEXT NOT NULL,
        creationTime INTEGER NOT NULL,
        hash TEXT,
        status TEXT NOT NULL,
        progress REAL NOT NULL DEFAULT 0,
        attempts INTEGER NOT NULL DEFAULT 0,
        maxAttempts INTEGER NOT NULL DEFAULT 3,
        nextRetryAt INTEGER NOT NULL DEFAULT 0,
        errorMessage TEXT,
        createdAt INTEGER NOT NULL,
        updatedAt INTEGER NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_uploaded_hash ON uploaded_files(hash);
      CREATE INDEX IF NOT EXISTS idx_uploaded_asset_id ON uploaded_files(assetId);
      CREATE INDEX IF NOT EXISTS idx_media_index_hash ON media_index(hash);
      CREATE INDEX IF NOT EXISTS idx_media_index_created_at ON media_index(createdAt DESC);
      CREATE INDEX IF NOT EXISTS idx_upload_queue_status ON upload_queue(status, nextRetryAt, updatedAt);
    `);
  }

  async isFileUploaded(hash: string): Promise<boolean> {
    await this.initialize();
    const uploaded = await this.db!.getFirstAsync<{ count: number }>(
      'SELECT COUNT(*) as count FROM uploaded_files WHERE hash = ?',
      [hash]
    );
    if ((uploaded?.count ?? 0) > 0) return true;

    const indexed = await this.db!.getFirstAsync<{ count: number }>(
      'SELECT COUNT(*) as count FROM media_index WHERE hash = ?',
      [hash]
    );
    return (indexed?.count ?? 0) > 0;
  }

  async recordUpload(assetId: string | null, hash: string, messageId: number, chatId: string) {
    await this.initialize();
    const timestamp = now();

    await this.db!.runAsync(
      `
        INSERT INTO uploaded_files (assetId, hash, telegramMessageId, chatId, uploadedAt)
        VALUES (?, ?, ?, ?, ?)
      `,
      [assetId, hash, messageId, chatId, timestamp]
    );

    if (assetId) {
      await this.db!.runAsync(
        `
          UPDATE upload_queue
          SET hash = COALESCE(hash, ?),
              status = CASE WHEN status = 'cancelled' THEN status ELSE 'completed' END,
              progress = CASE WHEN status = 'cancelled' THEN progress ELSE 1 END,
              errorMessage = NULL,
              updatedAt = ?
          WHERE assetId = ?
        `,
        [hash, timestamp, assetId]
      );
    }
  }

  async getUploadByAssetId(assetId: string): Promise<UploadedFile | null> {
    await this.initialize();
    return this.db!.getFirstAsync<UploadedFile>(
      'SELECT * FROM uploaded_files WHERE assetId = ? ORDER BY uploadedAt DESC LIMIT 1',
      [assetId]
    );
  }

  async batchCheckUploads(assetIds: string[]): Promise<Set<string>> {
    if (assetIds.length === 0) return new Set();
    await this.initialize();

    const uploadedAssetIds = new Set<string>();
    const chunkSize = 900;

    for (let i = 0; i < assetIds.length; i += chunkSize) {
      const chunk = assetIds.slice(i, i + chunkSize);
      const placeholders = chunk.map(() => '?').join(',');
      const query = `SELECT assetId FROM uploaded_files WHERE assetId IN (${placeholders})`;
      const results = await this.db!.getAllAsync<{ assetId: string | null }>(query, chunk);

      results.forEach((row) => {
        if (row.assetId) uploadedAssetIds.add(row.assetId);
      });
    }

    return uploadedAssetIds;
  }

  async getSyncedCount(): Promise<number> {
    await this.initialize();
    const result = await this.db!.getFirstAsync<{ count: number }>(
      'SELECT COUNT(*) as count FROM uploaded_files'
    );
    return result?.count ?? 0;
  }

  async getSuccessfulSyncCount(): Promise<number> {
    await this.initialize();
    const result = await this.db!.getFirstAsync<{ count: number }>(
      'SELECT COUNT(*) as count FROM uploaded_files WHERE telegramMessageId > 0'
    );
    return result?.count ?? 0;
  }

  async getAllSyncs(): Promise<UploadedFile[]> {
    await this.initialize();
    return this.db!.getAllAsync<UploadedFile>(
      'SELECT * FROM uploaded_files ORDER BY uploadedAt DESC LIMIT 100'
    );
  }

  async upsertMediaIndex(records: MediaIndexRecord[]) {
    if (records.length === 0) return;
    await this.initialize();

    for (const record of records) {
      await this.db!.runAsync(
        `
          INSERT INTO media_index (
            telegramMessageId, assetId, hash, filename, mediaType, mimeType, size,
            caption, thumbnailUri, createdAt, syncedAt, metadataJson
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(telegramMessageId) DO UPDATE SET
            assetId = COALESCE(excluded.assetId, media_index.assetId),
            hash = COALESCE(excluded.hash, media_index.hash),
            filename = excluded.filename,
            mediaType = excluded.mediaType,
            mimeType = excluded.mimeType,
            size = excluded.size,
            caption = excluded.caption,
            thumbnailUri = COALESCE(excluded.thumbnailUri, media_index.thumbnailUri),
            createdAt = excluded.createdAt,
            syncedAt = excluded.syncedAt,
            metadataJson = COALESCE(excluded.metadataJson, media_index.metadataJson)
        `,
        [
          record.telegramMessageId,
          record.assetId ?? null,
          record.hash ?? null,
          record.filename,
          record.mediaType,
          record.mimeType ?? null,
          record.size,
          record.caption ?? null,
          record.thumbnailUri ?? null,
          record.createdAt,
          record.syncedAt,
          record.metadataJson ?? null,
        ]
      );
    }
  }

  async getIndexedMedia(limit = 100): Promise<MediaIndexRecord[]> {
    await this.initialize();
    return this.db!.getAllAsync<MediaIndexRecord>(
      `
        SELECT telegramMessageId, assetId, hash, filename, mediaType, mimeType, size,
               caption, thumbnailUri, createdAt, syncedAt, metadataJson
        FROM media_index
        ORDER BY createdAt DESC, telegramMessageId DESC
        LIMIT ?
      `,
      [limit]
    );
  }

  async getIndexedHashes(): Promise<Set<string>> {
    await this.initialize();
    const rows = await this.db!.getAllAsync<{ hash: string | null }>(
      'SELECT DISTINCT hash FROM media_index WHERE hash IS NOT NULL AND hash != ""'
    );
    return new Set(rows.map((row) => row.hash).filter(Boolean) as string[]);
  }

  async getSyncCheckpoint(scope: string): Promise<SyncCheckpoint> {
    await this.initialize();
    const row = await this.db!.getFirstAsync<SyncCheckpoint>(
      'SELECT scope, lastMessageId, lastSyncedAt FROM sync_state WHERE scope = ?',
      [scope]
    );
    return row ?? { scope, lastMessageId: 0, lastSyncedAt: 0 };
  }

  async setSyncCheckpoint(scope: string, lastMessageId: number) {
    await this.initialize();
    await this.db!.runAsync(
      `
        INSERT INTO sync_state (scope, lastMessageId, lastSyncedAt)
        VALUES (?, ?, ?)
        ON CONFLICT(scope) DO UPDATE SET
          lastMessageId = excluded.lastMessageId,
          lastSyncedAt = excluded.lastSyncedAt
      `,
      [scope, lastMessageId, now()]
    );
  }

  async enqueueUploads(
    items: Array<
      Pick<
        UploadQueueItem,
        'assetId' | 'uri' | 'filename' | 'fileSize' | 'mediaType' | 'creationTime'
      > & { maxAttempts?: number }
    >
  ) {
    await this.initialize();
    const timestamp = now();

    for (const item of items) {
      await this.db!.runAsync(
        `
          INSERT INTO upload_queue (
            assetId, uri, filename, fileSize, mediaType, creationTime, hash,
            status, progress, attempts, maxAttempts, nextRetryAt, errorMessage,
            createdAt, updatedAt
          )
          VALUES (?, ?, ?, ?, ?, ?, NULL, 'queued', 0, 0, ?, 0, NULL, ?, ?)
          ON CONFLICT(assetId) DO UPDATE SET
            uri = excluded.uri,
            filename = excluded.filename,
            fileSize = excluded.fileSize,
            mediaType = excluded.mediaType,
            creationTime = excluded.creationTime,
            maxAttempts = excluded.maxAttempts,
            status = CASE
              WHEN upload_queue.status IN ('uploading', 'completed') THEN upload_queue.status
              ELSE 'queued'
            END,
            nextRetryAt = CASE
              WHEN upload_queue.status IN ('uploading', 'completed') THEN upload_queue.nextRetryAt
              ELSE 0
            END,
            errorMessage = CASE
              WHEN upload_queue.status IN ('uploading', 'completed') THEN upload_queue.errorMessage
              ELSE NULL
            END,
            updatedAt = excluded.updatedAt
        `,
        [
          item.assetId,
          item.uri,
          item.filename,
          item.fileSize,
          item.mediaType,
          item.creationTime,
          item.maxAttempts ?? APP_CONSTANTS.SYNC.RETRY_MAX_ATTEMPTS,
          timestamp,
          timestamp,
        ]
      );
    }
  }

  async getQueueItems(statuses?: QueueStatus[]): Promise<UploadQueueItem[]> {
    await this.initialize();
    if (!statuses || statuses.length === 0) {
      return this.db!.getAllAsync<UploadQueueItem>(
        'SELECT * FROM upload_queue ORDER BY updatedAt DESC, id DESC'
      );
    }

    const placeholders = statuses.map(() => '?').join(',');
    return this.db!.getAllAsync<UploadQueueItem>(
      `SELECT * FROM upload_queue WHERE status IN (${placeholders}) ORDER BY updatedAt ASC, id ASC`,
      statuses
    );
  }

  async updateQueueItem(
    assetId: string,
    updates: Partial<
      Pick<
        UploadQueueItem,
        'hash' | 'status' | 'progress' | 'attempts' | 'nextRetryAt' | 'errorMessage'
      >
    >
  ) {
    await this.initialize();
    const fields: string[] = [];
    const params: Array<string | number | null> = [];

    Object.entries(updates).forEach(([key, value]) => {
      fields.push(`${key} = ?`);
      params.push(value as string | number | null);
    });

    if (fields.length === 0) return;

    fields.push('updatedAt = ?');
    params.push(now());
    params.push(assetId);

    await this.db!.runAsync(
      `UPDATE upload_queue SET ${fields.join(', ')} WHERE assetId = ?`,
      params
    );
  }

  async markQueueCancelled(assetId: string) {
    await this.updateQueueItem(assetId, {
      status: 'cancelled',
      errorMessage: 'Cancelled by user',
    });
  }

  async retryQueueItem(assetId: string) {
    await this.updateQueueItem(assetId, {
      status: 'queued',
      progress: 0,
      nextRetryAt: 0,
      errorMessage: null,
    });
  }

  async getQueueSnapshot() {
    const items = await this.getQueueItems();
    const counts = items.reduce<Record<QueueStatus, number>>(
      (acc, item) => {
        acc[item.status] += 1;
        return acc;
      },
      {
        queued: 0,
        uploading: 0,
        retrying: 0,
        completed: 0,
        failed: 0,
        cancelled: 0,
        duplicate: 0,
      }
    );

    return { items, counts };
  }

  async getLocalDataSummary(): Promise<LocalDataSummary> {
    await this.initialize();
    const [uploaded, indexed, queued] = await Promise.all([
      this.db!.getFirstAsync<{ count: number }>('SELECT COUNT(*) as count FROM uploaded_files'),
      this.db!.getFirstAsync<{ count: number }>('SELECT COUNT(*) as count FROM media_index'),
      this.db!.getFirstAsync<{ count: number }>('SELECT COUNT(*) as count FROM upload_queue'),
    ]);

    return {
      uploadedCount: uploaded?.count ?? 0,
      indexedCount: indexed?.count ?? 0,
      queuedCount: queued?.count ?? 0,
    };
  }

  async clearCachedMediaReferences(): Promise<void> {
    await this.initialize();
    const rows = await this.db!.getAllAsync<{
      telegramMessageId: number;
      metadataJson: string | null;
    }>(
      `
        SELECT telegramMessageId, metadataJson
        FROM media_index
        WHERE metadataJson IS NOT NULL
          AND (
            metadataJson LIKE '%cachedUri%'
            OR metadataJson LIKE '%localUri%'
          )
      `
    );

    for (const row of rows) {
      let metadata: Record<string, unknown> = {};
      try {
        metadata = row.metadataJson ? JSON.parse(row.metadataJson) : {};
      } catch {
        metadata = {};
      }

      delete metadata.cachedUri;
      delete metadata.localUri;

      await this.db!.runAsync(
        'UPDATE media_index SET metadataJson = ?, syncedAt = ? WHERE telegramMessageId = ?',
        [JSON.stringify(metadata), now(), row.telegramMessageId]
      );
    }
  }

  async clearDatabase(): Promise<void> {
    await this.initialize();
    await this.db!.execAsync(`
      DELETE FROM uploaded_files;
      DELETE FROM media_index;
      DELETE FROM sync_state;
      DELETE FROM upload_queue;
    `);
  }
}

export const dbService = new DBService();
