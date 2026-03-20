/**
 * Global Frontend Constants
 * Objective: Remove all hardcoded values from UI and hooks.
 */

export const APP_CONSTANTS = {
  UI: {
    GALLERY: {
      DEFAULT_COLUMN_COUNT: 3,
      MIN_COLUMN_COUNT: 3,
      MAX_COLUMN_COUNT: 4,
      ITEM_SPACING: 2,
    },
    CLOUD: {
      COLUMN_COUNT: 3,
      ASPECT_RATIO: 0.8,
    },
    LISTS: {
      PAGE_SIZE: 20,
      ESTIMATED_ITEM_SIZE: 80,
      ON_END_REACHED_THRESHOLD: 0.5,
    },
    ANIMATIONS: {
      FADE_DURATION: 300,
    }
  },
  SYNC: {
    SCAN_BATCH_SIZE: 100,
    CONCURRENCY: 3,
    MAX_BATCH_FILES: 10,
    LARGE_FILE_THRESHOLD: 500 * 1024 * 1024,
    RETRY_MAX_ATTEMPTS: 3,
    RETRY_DELAY: 1000,
  },
  NETWORK: {
    DEFAULT_BACKEND_URL: 'http://192.168.29.222:3000',
    API_KEY_HEADER: 'x-api-key',
    API: {
      SEND_CODE: '/api/send-code',
      SIGN_IN: '/api/sign-in',
      CHECK_PASSWORD: '/api/check-password',
      AUTH_STATUS: '/api/auth-status',
      UPLOAD: '/api/upload',
      UPLOAD_BATCH: '/api/upload-batch',
      CLOUD_MEDIA: '/api/cloud-media',
      CLOUD_MEDIA_DOWNLOAD: '/api/cloud-media',
      RESTORE: '/api/restore',
      HEALTH: '/api/health',
    }
  },
  AUTH: {
    SESSION_STORAGE_KEY: 'tg_session',
    DEFAULT_API_KEY: '',
  },
  DATABASE: {
    NAME: 'telegram_cloud.db',
    VERSION: 1,
  },
  ERRORS: {
    DEFAULT_FETCH: 'Failed to fetch data from server',
    AUTH_REQUIRED: 'Authentication required to access this feature',
  }
};
