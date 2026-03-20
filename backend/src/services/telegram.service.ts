import { Api, TelegramClient } from 'telegram';
import { StringSession } from 'telegram/sessions';
import bigInt from 'big-integer';
import { computeCheck } from 'telegram/Password';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config();

const apiId = parseInt(process.env.API_ID || '0', 10);
const apiHash = process.env.API_HASH || '';
const sessionSecret = process.env.TG_SESSION_SECRET || process.env.SESSION_SECRET || '';
const sessionFile = path.join(process.cwd(), '.data', 'telegram-session.enc');

const deriveKey = (secret: string) =>
  crypto.createHash('sha256').update(secret).digest();

const encryptSession = (session: string, secret: string) => {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', deriveKey(secret), iv);
  const encrypted = Buffer.concat([cipher.update(session, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, encrypted]).toString('base64');
};

const decryptSession = (payload: string, secret: string) => {
  const raw = Buffer.from(payload, 'base64');
  const iv = raw.subarray(0, 12);
  const tag = raw.subarray(12, 28);
  const encrypted = raw.subarray(28);
  const decipher = crypto.createDecipheriv('aes-256-gcm', deriveKey(secret), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8');
};

class TelegramService {
  private client: TelegramClient;
  private sessionString: string;

  constructor() {
    console.log('[TelegramService] Initializing client...');
    this.sessionString = this.loadSession();
    this.client = new TelegramClient(new StringSession(this.sessionString), apiId, apiHash, {
      connectionRetries: 5,
    });
  }

  private loadSession(): string {
    if (process.env.TG_SESSION) {
      console.log('[TelegramService] Using session from environment variable');
      return process.env.TG_SESSION.trim();
    }

    if (!sessionSecret) {
        console.warn('[TelegramService] No SESSION_SECRET provided, cannot load local session file');
        return '';
    }

    if (!fs.existsSync(sessionFile)) {
      console.log('[TelegramService] No local session file found');
      return '';
    }

    try {
      const encrypted = fs.readFileSync(sessionFile, 'utf8').trim();
      const session = decryptSession(encrypted, sessionSecret);
      console.log('[TelegramService] Session loaded and decrypted from local storage');
      return session;
    } catch (e: any) {
      console.error('[TelegramService] Failed to decrypt session file:', e);
      return '';
    }
  }

  public saveSession() {
    if (!sessionSecret) {
        console.warn('[TelegramService] No SESSION_SECRET provided, skipping session persistence');
        return;
    }

    try {
      const newSession = this.client.session.save() as unknown as string;
      fs.mkdirSync(path.dirname(sessionFile), { recursive: true });
      fs.writeFileSync(sessionFile, encryptSession(newSession, sessionSecret), 'utf8');
      console.log('[TelegramService] Session encrypted and saved to local storage');
    } catch (e: any) {
      console.warn('[TelegramService] Could not save session (likely serverless env):', e.message);
    }
  }

  async ensureConnected() {
    if (!this.client.connected) {
      console.log('[TelegramService] Connecting to Telegram...');
      try {
          await this.client.connect();
          console.log('[TelegramService] Connection established successfully');
      } catch (e: any) {
          console.error('[TelegramService] Connection failed:', e);
          throw e;
      }
    }
  }

  getClient() {
    return this.client;
  }

  async sendCode(phoneNumber: string) {
    console.log(`[TelegramService] Sending code to: ${phoneNumber}`);
    await this.ensureConnected();
    try {
        const result = await this.client.sendCode({ apiId, apiHash }, phoneNumber);
        console.log('[TelegramService] Code sent successfully');
        return result;
    } catch (e: any) {
        console.error('[TelegramService] Failed to send code:', e);
        throw e;
    }
  }

  async signIn(phoneNumber: string, phoneCodeHash: string, code: string) {
    console.log(`[TelegramService] Attempting sign-in for: ${phoneNumber}`);
    await this.ensureConnected();
    try {
        const result = await this.client.invoke(
          new Api.auth.SignIn({
            phoneNumber,
            phoneCodeHash,
            phoneCode: code,
          })
        );
        console.log('[TelegramService] Sign-in successful');
        this.saveSession();
        return result;
    } catch (e: any) {
        console.error('[TelegramService] Sign-in failed:', e);
        throw e;
    }
  }

  async checkPassword(password: string) {
    console.log('[TelegramService] Verifying 2FA password...');
    await this.ensureConnected();
    try {
        const passwordInfo = await this.client.invoke(new Api.account.GetPassword());
        const result = await this.client.invoke(
          new Api.auth.CheckPassword({
            password: await computeCheck(passwordInfo as any, password),
          })
        );
        console.log('[TelegramService] 2FA password verified');
        this.saveSession();
        return result;
    } catch (e: any) {
        console.error('[TelegramService] 2FA verification failed:', e);
        throw e;
    }
  }

  async isAuthenticated(): Promise<boolean> {
    try {
      await this.ensureConnected();
      const isAuth = await this.client.checkAuthorization();
      console.log(`[TelegramService] Authorization check: ${isAuth ? 'AUTHORIZED' : 'NOT AUTHORIZED'}`);
      return isAuth;
    } catch (e: any) {
      console.error('[TelegramService] Authorization check failed:', e.message);
      return false;
    }
  }

  async sendFile(
    peer: any,
    options: {
      file: any;
      caption?: string;
      forceDocument?: boolean;
      workers?: number;
    }
  ) {
    await this.ensureConnected();
    return this.client.sendFile(peer, options);
  }

  async uploadPart(
    isLarge: boolean,
    options: {
      fileId: bigInt.BigInteger;
      filePart: number;
      fileTotalParts?: number;
      bytes: Buffer;
    }
  ) {
    await this.ensureConnected();
    if (isLarge) {
      return this.client.invoke(new Api.upload.SaveBigFilePart(options as any));
    }
    return this.client.invoke(new Api.upload.SaveFilePart(options as any));
  }

  async getHistory(peer: any, options: { limit: number; offsetId?: number }) {
    await this.ensureConnected();
    return this.client.getMessages(peer, options);
  }

  async getMessageById(peer: any, messageId: number) {
    await this.ensureConnected();
    const result = await this.client.getMessages(peer, { ids: [messageId] as any });
    return Array.isArray(result) ? result[0] : result;
  }

  async downloadMessageMedia(message: any) {
    await this.ensureConnected();
    return this.client.downloadMedia(message, {}) as Promise<Buffer | string | undefined>;
  }
}

export const telegramService = new TelegramService();
