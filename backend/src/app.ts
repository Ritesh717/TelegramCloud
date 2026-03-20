import express from 'express';
import cors from 'cors';
import { authMiddleware } from './middleware/auth';
import apiRoutes from './routes/api.routes';
import { BACKEND_CONSTANTS } from './constants/BackendConstants';

const app = express();

app.use(cors());
app.use(express.json({ limit: BACKEND_CONSTANTS.SERVER.BODY_LIMIT }));

// Global logger
app.use((req, _res, next) => {
    console.log(`[Backend] ${req.method} ${req.url}`);
    next();
});

// Authentication middleware
app.use(BACKEND_CONSTANTS.SERVER.API_PREFIX, authMiddleware);

// Routes
app.use(BACKEND_CONSTANTS.SERVER.API_PREFIX, apiRoutes);

// Generic Error Handler
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error('[Backend] Internal Error:', err);
    res.status(500).json({ error: 'Internal Server Error', message: err.message });
});

export default app;
