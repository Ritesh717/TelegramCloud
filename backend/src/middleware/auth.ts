import { Request, Response, NextFunction } from 'express';
import dotenv from 'dotenv';
import crypto from 'crypto';
import { BACKEND_CONSTANTS } from '../constants/BackendConstants';

dotenv.config();

const API_KEY = process.env.API_KEY || '';

export const authMiddleware = (req: Request, res: Response, next: NextFunction) => {
    // Health check and root don't need auth. 
    // req.path is relative to the mount point (/api).
    if (req.path === '/health' || req.path === '/' || req.originalUrl.endsWith('/health')) {
        return next();
    }

    const providedKey = req.headers[BACKEND_CONSTANTS.AUTH.API_KEY_HEADER];

    if (!API_KEY) {
        return next();
    }

    if (!providedKey || providedKey !== API_KEY) {
        const keyFingerprint = providedKey
            ? crypto.createHash('sha256').update(String(providedKey)).digest('hex').slice(0, 8)
            : 'missing';
        console.warn(`[Auth] Unauthorized request. key=${keyFingerprint} path=${req.path}`);
        return res.status(401).json({ error: BACKEND_CONSTANTS.ERRORS.INVALID_API_KEY });
    }

    next();
};
