import { Api, TelegramClient } from 'telegram';
import { StringSession } from 'telegram/sessions';
import bigInt from 'big-integer';
import { generateRandomBytes } from 'telegram/Helpers';
import { computeCheck } from 'telegram/Password';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config();

const apiId = parseInt(process.env.API_ID || '0');
const apiHash = process.env.API_HASH || '';

class TelegramService {
    private client: TelegramClient;
    private sessionString: string;

    constructor() {
        this.sessionString = this.loadSession();
        this.client = new TelegramClient(new StringSession(this.sessionString), apiId, apiHash, {
            connectionRetries: 5,
        });
    }

    private loadSession(): string {
        if (process.env.TG_SESSION) return process.env.TG_SESSION;
        const SESSION_FILE = path.join(__dirname, '../../session.txt');
        if (fs.existsSync(SESSION_FILE)) {
            return fs.readFileSync(SESSION_FILE, 'utf8').trim();
        }
        return '';
    }

    public saveSession() {
        try {
            const newSession = this.client.session.save() as unknown as string;
            const SESSION_FILE = path.join(__dirname, '../../session.txt');
            fs.writeFileSync(SESSION_FILE, newSession);
        } catch (e) {
            console.log('[TelegramService] Could not save session to file (expected in serverless)');
        }
    }

    async ensureConnected() {
        if (!this.client.connected) {
            await this.client.connect();
        }
    }

    getClient() {
        return this.client;
    }

    async sendCode(phoneNumber: string) {
        await this.ensureConnected();
        return await this.client.sendCode({ apiId, apiHash }, phoneNumber);
    }

    async signIn(phoneNumber: string, phoneCodeHash: string, code: string) {
        await this.ensureConnected();
        const result = await this.client.invoke(
            new Api.auth.SignIn({
                phoneNumber,
                phoneCodeHash,
                phoneCode: code,
            })
        );
        this.saveSession();
        return result;
    }

    async checkPassword(password: string) {
        await this.ensureConnected();
        const passwordInfo = await this.client.invoke(new Api.account.GetPassword());
        const result = await this.client.invoke(
            new Api.auth.CheckPassword({
               password: await computeCheck(passwordInfo as any, password)
            })
        );
        this.saveSession();
        return result;
    }

    async isAuthenticated(): Promise<boolean> {
        try {
            await this.ensureConnected();
            const authorized = await this.client.checkAuthorization();
            return authorized;
        } catch (e) {
            return false;
        }
    }

    async sendFile(peer: any, options: { 
        file: any, 
        caption?: string, 
        forceDocument?: boolean,
        workers?: number
    }) {
        await this.ensureConnected();
        return await this.client.sendFile(peer, options);
    }

    async uploadPart(isLarge: boolean, options: {
        fileId: bigInt.BigInteger,
        filePart: number,
        fileTotalParts?: number,
        bytes: Buffer
    }) {
        await this.ensureConnected();
        if (isLarge) {
            return await this.client.invoke(new Api.upload.SaveBigFilePart(options as any));
        } else {
            return await this.client.invoke(new Api.upload.SaveFilePart(options as any));
        }
    }

    async getHistory(peer: any, options: { limit: number, offsetId?: number }) {
        await this.ensureConnected();
        return await this.client.getMessages(peer, options);
    }
}

export const telegramService = new TelegramService();
