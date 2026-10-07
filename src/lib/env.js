export function env(name, fallback = '') {
  const value = import.meta.env?.[name];
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

export const GOOGLE_CLIENT_ID = env('VITE_GOOGLE_CLIENT_ID');
export const API_URL = env('VITE_API_URL');

export function isBackendConfigured() {
  return Boolean(GOOGLE_CLIENT_ID && API_URL);
}
