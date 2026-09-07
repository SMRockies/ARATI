const defaultApiBaseUrl = 'http://localhost:3001';

export function getApiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_BASE_URL?.trim() || defaultApiBaseUrl;
}

export function getRuntimeConfig(): { apiBaseUrl: string } {
  return { apiBaseUrl: getApiBaseUrl() };
}
