/**
 * Global Backend Constants
 */

export const BACKEND_CONSTANTS = {
  SERVER: {
    PORT: process.env.PORT || 3000,
    API_PREFIX: '/api',
    BODY_LIMIT: '50mb',
  },
  TELEGRAM: {
    DEFAULT_LIMIT: 50,
    UPLOAD_CHUNK_SIZE: 512 * 1024, // 512KB
    SESSION_FILE: 'session.txt',
  },
  AUTH: {
    API_KEY_HEADER: 'x-api-key',
  },
  ERRORS: {
    INVALID_API_KEY: 'Unauthorized: Invalid API Key',
    PORT_IN_USE: 'Port is already in use',
  }
};
