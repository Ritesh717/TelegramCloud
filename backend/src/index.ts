import app from './app';
import dotenv from 'dotenv';
import { BACKEND_CONSTANTS } from './constants/BackendConstants';

dotenv.config();

// Global Error Handlers for process
process.on('unhandledRejection', (reason, promise) => {
    console.error('[Backend] Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (error) => {
    console.error('[Backend] Uncaught Exception:', error);
});

const PORT = BACKEND_CONSTANTS.SERVER.PORT;

if (!process.env.VERCEL) {
    const server = app.listen(Number(PORT), '0.0.0.0', () => {
        console.log(`[Backend] Service started successfully on port ${PORT}`);
    });

    server.on('error', (e: any) => {
        if (e.code === 'EADDRINUSE') {
            console.error(`[Backend] ERROR: ${BACKEND_CONSTANTS.ERRORS.PORT_IN_USE} (${PORT}).`);
            setTimeout(() => process.exit(1), 5000);
        } else {
            console.error('[Backend] Server error:', e);
        }
    });
}

export default app;
