import { Request, Response, NextFunction } from 'express';
import dotenv from 'dotenv';
import { BACKEND_CONSTANTS } from '../constants/BackendConstants';

dotenv.config();

const API_KEY = process.env.API_KEY || 'default_secret_key_123';

export const authMiddleware = (req: Request, res: Response, next: NextFunction) => {
    // Health check and root don't need auth. 
    // req.path is relative to the mount point (/api).
    if (req.path === '/health' || req.path === '/' || req.originalUrl.endsWith('/health')) {
        return next();
    }

    const providedKey = req.headers[BACKEND_CONSTANTS.AUTH.API_KEY_HEADER];

    if (!providedKey || providedKey !== API_KEY) {
        console.warn(`[Auth] Unauthorized: Provided: "${providedKey}", Expected: "${API_KEY}", Path: ${req.path}`);
        return res.status(401).json({ error: BACKEND_CONSTANTS.ERRORS.INVALID_API_KEY });
    }

    next();
};
