const getConfigValue = (value: string | undefined, fallback = '') => value?.trim() || fallback;

export const CONFIG = {
  SESSION_STORAGE_KEY: 'tg_session',
  BACKEND_URL: getConfigValue(
    process.env.EXPO_PUBLIC_BACKEND_URL,
    'http://192.168.29.222:3000'
  ),
  API_KEY: getConfigValue(process.env.EXPO_PUBLIC_API_KEY, ''),
};
