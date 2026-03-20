import * as SQLite from 'expo-sqlite';
import { APP_CONSTANTS } from '../constants/AppConstants';

export interface UploadedFile {
  id?: number;
  assetId: string;
  hash: string;
  telegramMessageId: number;
  chatId: string;
  uploadedAt: number;
}

class DBService {
  private db: SQLite.SQLiteDatabase | null = null;

  async initialize() {
    if (this.db) return;
    
    console.log(`[DB] Initializing SQLite database (${APP_CONSTANTS.DATABASE.NAME})...`);
    this.db = await SQLite.openDatabaseAsync(APP_CONSTANTS.DATABASE.NAME);
    
    await this.db.execAsync(`
      CREATE TABLE IF NOT EXISTS uploaded_files (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        assetId TEXT NOT NULL,
        hash TEXT NOT NULL,
        telegramMessageId INTEGER NOT NULL,
        chatId TEXT NOT NULL,
        uploadedAt INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_hash ON uploaded_files(hash);
      CREATE INDEX IF NOT EXISTS idx_assetId ON uploaded_files(assetId);
    `);
  }

  async isFileUploaded(hash: string): Promise<boolean> {
    await this.initialize();
    const result = await this.db!.getFirstAsync<{ count: number }>(
      'SELECT COUNT(*) as count FROM uploaded_files WHERE hash = ?',
      [hash]
    );
    const exists = (result?.count || 0) > 0;
    if (exists) console.log(`[DB] Found existing record for hash: ${hash.substring(0, 8)}...`);
    return exists;
  }

  async recordUpload(assetId: string, hash: string, messageId: number, chatId: string) {
    await this.initialize();
    console.log(`[DB] Recording upload: Asset=${assetId}, Hash=${hash.substring(0, 8)}..., MsgId=${messageId}`);
    await this.db!.runAsync(
      'INSERT INTO uploaded_files (assetId, hash, telegramMessageId, chatId, uploadedAt) VALUES (?, ?, ?, ?, ?)',
      [assetId, hash, messageId, chatId, Date.now()]
    );
  }

  async getUploadByAssetId(assetId: string): Promise<UploadedFile | null> {
    await this.initialize();
    return await this.db!.getFirstAsync<UploadedFile>(
      'SELECT * FROM uploaded_files WHERE assetId = ?',
      [assetId]
    );
  }

  /**
   * Efficiently checks multiple assets at once.
   * Prevents N+1 query patterns that cause UI jank.
   */
  async batchCheckUploads(assetIds: string[]): Promise<Set<string>> {
    if (assetIds.length === 0) return new Set();
    await this.initialize();
    
    const uploadedAssetIds = new Set<string>();
    const chunkSize = 900; // SQLite limit protection

    for (let i = 0; i < assetIds.length; i += chunkSize) {
      const chunk = assetIds.slice(i, i + chunkSize);
      const placeholders = chunk.map(() => '?').join(',');
      const query = `SELECT assetId FROM uploaded_files WHERE assetId IN (${placeholders})`;
      const results: any[] = await this.db!.getAllAsync(query, chunk);
      results.forEach(row => uploadedAssetIds.add(row.assetId));
    }

    return uploadedAssetIds;
  }

  async getSyncedCount(): Promise<number> {
    await this.initialize();
    const result = await this.db!.getFirstAsync<{ count: number }>(
      'SELECT COUNT(*) as count FROM uploaded_files'
    );
    return result?.count || 0;
  }

  async getSuccessfulSyncCount(): Promise<number> {
    await this.initialize();
    const result = await this.db!.getFirstAsync<{ count: number }>(
      'SELECT COUNT(*) as count FROM uploaded_files WHERE telegramMessageId > 0'
    );
    return result?.count || 0;
  }

  async getAllSyncs(): Promise<UploadedFile[]> {
    await this.initialize();
    return await this.db!.getAllAsync<UploadedFile>(
      'SELECT * FROM uploaded_files ORDER BY uploadedAt DESC LIMIT 100'
    );
  }

  async clearDatabase(): Promise<void> {
    await this.initialize();
    await this.db!.runAsync('DELETE FROM uploaded_files');
    console.log('[DB] Database cleared.');
  }
}

export const dbService = new DBService();
