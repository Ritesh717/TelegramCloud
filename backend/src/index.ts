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
    (async () => {
        try {
            console.log('[Backend] Booting... Checking Telegram connection');
            const { telegramService } = require('./services/telegram.service');
            await telegramService.ensureConnected();
            const isAuth = await telegramService.isAuthenticated();
            
            const server = app.listen(Number(PORT), '0.0.0.0', () => {
                const authMsg = isAuth ? 'AUTHENTICATED' : 'NOT LOGGED IN (Awaiting Auth)';
                console.log(`[Backend] 🚀 Service running on port ${PORT} | Telegram Status: ${authMsg}`);
            });

            server.on('error', (e: any) => {
                if (e.code === 'EADDRINUSE') {
                    console.error(`[Backend] ERROR: ${BACKEND_CONSTANTS.ERRORS.PORT_IN_USE} (${PORT}).`);
                    setTimeout(() => process.exit(1), 5000);
                } else {
                    console.error('[Backend] Server error:', e);
                }
            });
        } catch (err) {
            console.error('[Backend] ❌ Failed to establish Telegram connection on startup. The app will proceed but might fail requests.');
            console.error(err);
            
            // Still start the server so health checks and login flow can work
            app.listen(Number(PORT), '0.0.0.0', () => {
                console.log(`[Backend] 🚀 Service running on port ${PORT} (Standalone mode - No Telegram)`);
            });
        }
    })();
}

export default app;
