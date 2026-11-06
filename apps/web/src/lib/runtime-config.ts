const defaultApiBaseUrl = 'http://localhost:3001';
const defaultStorefrontBaseUrl = 'http://localhost:3000';

export function getApiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_BASE_URL?.trim() || defaultApiBaseUrl;
}

/** Origin of the ARATI_1 public storefront, used for "view it live" links. */
export function getStorefrontBaseUrl(): string {
  return process.env.NEXT_PUBLIC_STOREFRONT_BASE_URL?.trim() || defaultStorefrontBaseUrl;
}

export function getRuntimeConfig(): { apiBaseUrl: string; storefrontBaseUrl: string } {
  return { apiBaseUrl: getApiBaseUrl(), storefrontBaseUrl: getStorefrontBaseUrl() };
}
