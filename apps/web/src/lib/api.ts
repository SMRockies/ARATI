import { getApiBaseUrl, getStorefrontBaseUrl } from './runtime-config';

/** Normalized failure shape used by every helper in this module. */
export type ApiError = { status: number; code: string; message: string };

export type SessionUser = { id: string; email: string; displayName: string };

export type Membership = {
  id: string;
  organizationId: string;
  branchId: string | null;
  roleCode: string;
  roleName: string;
  permissions: string[];
};

export type Session = { user: SessionUser; memberships: Membership[] };

export type CatalogMaster = {
  id: string;
  code: string;
  name: string;
  slug: string;
  isActive: boolean;
};

export type Specification = { name: string; value: string };

export type ProductVariant = {
  id: string;
  sku: string;
  name: string;
  isActive?: boolean;
  [key: string]: unknown;
};

export type Product = {
  id: string;
  organizationId: string;
  categoryId: string;
  brandId: string | null;
  code: string;
  name: string;
  slug: string;
  lifecycleStatus: 'DRAFT' | 'ACTIVE' | 'INACTIVE';
  isPublished: boolean;
  publishedAt: string | null;
  isEnquiryAllowed: boolean;
  trackingMode: string;
  summary: string | null;
  description: string | null;
  specifications: Specification[];
  imageUrl: string | null;
  imageAlt: string | null;
  createdAt: string;
  updatedAt: string;
  category: CatalogMaster;
  brand: CatalogMaster | null;
  variants: ProductVariant[];
};

/** The public projection — exactly what the ARATI_1 storefront renders. */
export type MarketProduct = {
  slug: string;
  name: string;
  brand: { slug: string; name: string } | null;
  category: { slug: string; name: string };
  summary: string | null;
  description: string | null;
  specifications: Specification[];
  image: { url: string; alt: string } | null;
  availability: 'IN_STOCK' | 'ENQUIRE' | 'UNAVAILABLE';
};

export type Paged<T> = { items: T[]; page: { page: number; limit: number; total: number; hasMore: boolean } };

/**
 * Internal stock position — staff only. Never part of a public projection:
 * the storefront receives the coarse `availability` label instead.
 */
export type StockBalance = {
  id: string;
  warehouseId: string;
  variantId: string;
  onHand: number;
  reserved: number;
  damaged: number;
  sellable: number;
  updatedAt: string;
  warehouse: { code: string; name: string; countsForMarket: boolean };
  variant: { sku: string; name: string; product: { name: string; slug: string } };
};

export type InventoryMovementType =
  | 'RECEIPT'
  | 'ISSUE'
  | 'TRANSFER_IN'
  | 'TRANSFER_OUT'
  | 'RESERVE'
  | 'RELEASE'
  | 'ADJUSTMENT_INCREASE'
  | 'ADJUSTMENT_DECREASE'
  | 'DAMAGE';

/** One immutable ledger line. Balances are derived from these, never edited. */
export type InventoryMovement = {
  id: string;
  postingId: string;
  warehouseId: string;
  variantId: string;
  type: InventoryMovementType;
  bucket: 'ON_HAND' | 'RESERVED' | 'DAMAGED';
  quantity: number;
  referenceType: string | null;
  referenceId: string | null;
  reason: string | null;
  occurredAt: string;
  posting: { proofAttachment: { id: string; fileName: string; mimeType: string } | null };
  proofUrl?: string | null;
  warehouse: { code: string; name: string };
  variant: { sku: string; name: string };
};

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${getApiBaseUrl()}${path}`, {
      ...init,
      credentials: 'include',
      headers: {
        ...(init.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
        ...(init.headers ?? {}),
      },
    });
  } catch {
    throw { status: 0, code: 'UNREACHABLE', message: `Could not reach the ARATI API at ${getApiBaseUrl()}.` } satisfies ApiError;
  }

  if (response.status === 204) return undefined as T;

  let body: unknown = null;
  try {
    body = await response.json();
  } catch {
    body = null;
  }

  if (!response.ok) {
    const problem = body as { error?: { code?: string; message?: string } } | null;
    throw {
      status: response.status,
      code: problem?.error?.code ?? 'REQUEST_FAILED',
      message: problem?.error?.message ?? `Request failed with status ${response.status}.`,
    } satisfies ApiError;
  }

  return body as T;
}

export function apiGet<T>(path: string): Promise<T> {
  return request<T>(path);
}

export function apiSend<T>(method: 'POST' | 'PATCH' | 'DELETE', path: string, body?: unknown): Promise<T> {
  return request<T>(path, { method, body: body === undefined ? undefined : JSON.stringify(body) });
}

export function apiUpload<T>(path: string, body: FormData): Promise<T> {
  return request<T>(path, { method: 'POST', body });
}

export function isApiError(value: unknown): value is ApiError {
  return typeof value === 'object' && value !== null && 'status' in value && 'code' in value;
}

export function errorMessage(value: unknown): string {
  return isApiError(value) ? value.message : value instanceof Error ? value.message : 'Something went wrong.';
}

/** Current session, or null when the cookie is missing/expired (401). */
export async function fetchSession(): Promise<Session | null> {
  try {
    return await apiGet<Session>('/api/v1/auth/me');
  } catch (error) {
    if (isApiError(error) && error.status === 401) return null;
    throw error;
  }
}

export async function login(email: string, password: string): Promise<Session> {
  return apiSend<Session>('POST', '/api/v1/auth/login', { email, password });
}

export function logout(): Promise<void> {
  return apiSend<void>('POST', '/api/v1/auth/logout');
}

/** Absolute storefront URL for a product slug — the "see it live" link. */
export function storefrontProductUrl(slug: string): string {
  return `${getStorefrontBaseUrl().replace(/\/$/, '')}/products/${encodeURIComponent(slug)}`;
}
