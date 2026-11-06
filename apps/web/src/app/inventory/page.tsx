'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { DataGrid, type GridColumn } from '../../components/data-grid';
import {
  apiGet,
  apiUpload,
  errorMessage,
  fetchSession,
  logout,
  type InventoryMovement,
  type Membership,
  type Paged,
  type Session,
  type StockBalance,
} from '../../lib/api';
import { getRuntimeConfig } from '../../lib/runtime-config';

/**
 * Internal inventory console.
 *
 * This is company data: on-hand, reserved and damaged quantities, warehouse
 * names and the full movement ledger. Nothing here is reachable from the
 * storefront — the public API emits a single coarse `availability` label per
 * product and never a count, a warehouse or a reservation figure.
 *
 * Read-only (X1): balances are derived from the ledger, so the only way a number
 * changes is by posting a receipt / issue / adjustment / damage document, which
 * needs `inventory.write` or `inventory.adjust`.
 */

const PAGE_LIMIT = 100;
const READ = 'inventory.read';
const WRITE = 'inventory.write';
const MAX_PROOF_SIZE_BYTES = 10 * 1024 * 1024;
const ACCEPTED_PROOF_TYPES = ['image/jpeg', 'image/png', 'application/pdf'];

type ReceiptWarehouse = { id: string; code: string; name: string };
type ReceiptVariant = { id: string; sku: string; name: string; product: { name: string } };

function formatWhen(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

const BALANCE_COLUMNS: GridColumn<StockBalance>[] = [
  { key: 'warehouse', label: 'Warehouse', cell: (row) => ({ text: row.warehouse.code, mono: true }) },
  {
    key: 'market',
    label: 'Counts for storefront',
    cell: (row) => ({
      text: row.warehouse.countsForMarket ? 'Yes' : 'No',
      sortValue: row.warehouse.countsForMarket ? 1 : 0,
      badge: row.warehouse.countsForMarket ? 'badge badge-blue' : 'badge badge-grey',
    }),
  },
  { key: 'sku', label: 'SKU', cell: (row) => ({ text: row.variant.sku, mono: true }) },
  { key: 'product', label: 'Product', cell: (row) => ({ text: row.variant.product.name }) },
  { key: 'variant', label: 'Variant', cell: (row) => ({ text: row.variant.name }) },
  {
    key: 'onHand',
    label: 'On hand',
    numeric: true,
    cell: (row) => ({ text: String(row.onHand), sortValue: row.onHand }),
  },
  {
    key: 'reserved',
    label: 'Reserved',
    numeric: true,
    cell: (row) => ({ text: String(row.reserved), sortValue: row.reserved }),
  },
  {
    key: 'damaged',
    label: 'Damaged',
    numeric: true,
    cell: (row) => ({ text: String(row.damaged), sortValue: row.damaged }),
  },
  {
    key: 'sellable',
    label: 'Sellable',
    numeric: true,
    cell: (row) => ({
      text: String(row.sellable),
      sortValue: row.sellable,
      badge: row.sellable > 0 ? 'badge badge-green' : 'badge badge-amber',
    }),
  },
  { key: 'updatedAt', label: 'Updated', cell: (row) => ({ text: formatWhen(row.updatedAt), mono: true }) },
];

const MOVEMENT_COLUMNS: GridColumn<InventoryMovement>[] = [
  {
    key: 'occurredAt',
    label: 'When',
    cell: (row) => ({ text: formatWhen(row.occurredAt), mono: true, sortValue: new Date(row.occurredAt).getTime() }),
  },
  { key: 'warehouse', label: 'Warehouse', cell: (row) => ({ text: row.warehouse.code, mono: true }) },
  { key: 'sku', label: 'SKU', cell: (row) => ({ text: row.variant.sku, mono: true }) },
  { key: 'variant', label: 'Variant', cell: (row) => ({ text: row.variant.name }) },
  {
    key: 'type',
    label: 'Movement',
    cell: (row) => ({
      text: row.type,
      badge: row.type.startsWith('ADJUSTMENT') ? 'badge badge-amber' : 'badge badge-grey',
    }),
  },
  { key: 'bucket', label: 'Bucket', cell: (row) => ({ text: row.bucket }) },
  {
    key: 'quantity',
    label: 'Qty',
    numeric: true,
    cell: (row) => ({ text: String(row.quantity), sortValue: row.quantity }),
  },
  { key: 'reason', label: 'Reference / reason', cell: (row) => ({ text: row.reason ?? row.referenceType ?? '—' }) },
  { key: 'proof', label: 'Receipt proof', cell: (row) => ({
    text: row.proofUrl ? `View ${row.posting?.proofAttachment?.fileName ?? 'proof'}` : '—',
    href: row.proofUrl,
    badge: row.proofUrl ? 'badge badge-green' : null,
  }) },
];

export default function InventoryPage() {
  const router = useRouter();
  const { apiBaseUrl } = getRuntimeConfig();

  const [session, setSession] = useState<Session | null>(null);
  const [membership, setMembership] = useState<Membership | null>(null);
  const [balances, setBalances] = useState<StockBalance[]>([]);
  const [movements, setMovements] = useState<InventoryMovement[]>([]);
  const [totals, setTotals] = useState({ balances: 0, movements: 0 });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [receiptNotice, setReceiptNotice] = useState<string | null>(null);
  const [receiptOpen, setReceiptOpen] = useState(false);
  const [receiptBusy, setReceiptBusy] = useState(false);
  const [receiptError, setReceiptError] = useState<string | null>(null);
  const [warehouses, setWarehouses] = useState<ReceiptWarehouse[]>([]);
  const [variants, setVariants] = useState<ReceiptVariant[]>([]);
  const [variantSearch, setVariantSearch] = useState('');
  const [selectedWarehouse, setSelectedWarehouse] = useState('');
  const [selectedVariant, setSelectedVariant] = useState('');
  const [receiptQuantity, setReceiptQuantity] = useState('');
  const [receiptReference, setReceiptReference] = useState('');
  const [proofFile, setProofFile] = useState<File | null>(null);

  const canRead = Boolean(membership?.permissions.some((permission) => permission === '*' || permission === READ));
  const canWrite = Boolean(membership?.permissions.some((permission) => permission === '*' || permission === WRITE));

  const load = useCallback(async (orgId: string) => {
    const base = `/api/v1/organizations/${orgId}/inventory`;
    const [balancePage, movementPage] = await Promise.all([
      apiGet<Paged<StockBalance>>(`${base}/balances?limit=${PAGE_LIMIT}`),
      apiGet<Paged<InventoryMovement>>(`${base}/movements?limit=${PAGE_LIMIT}`),
    ]);
    setBalances(balancePage.items);
    setMovements(movementPage.items.map((movement) => ({
      ...movement,
      proofUrl: movement.posting?.proofAttachment
        ? `${apiBaseUrl}/api/v1/organizations/${orgId}/inventory/proofs/${movement.postingId}`
        : null,
    })));
    setTotals({ balances: balancePage.page.total, movements: movementPage.page.total });
  }, [apiBaseUrl]);

  useEffect(() => {
    if (!receiptOpen || !membership) return;
    let cancelled = false;
    void apiGet<ReceiptWarehouse[]>(`/api/v1/organizations/${membership.organizationId}/inventory/warehouses`)
      .then((items) => {
        if (cancelled) return;
        setWarehouses(items);
        setSelectedWarehouse((current) => current || items[0]?.id || '');
      })
      .catch((caught) => {
        if (!cancelled) setReceiptError(errorMessage(caught));
      });
    return () => {
      cancelled = true;
    };
  }, [membership, receiptOpen]);

  useEffect(() => {
    if (!receiptOpen || !membership) return;
    let cancelled = false;
    const timer = window.setTimeout(() => {
      const params = new URLSearchParams({ limit: '100' });
      if (variantSearch.trim()) params.set('q', variantSearch.trim());
      void apiGet<ReceiptVariant[]>(
        `/api/v1/organizations/${membership.organizationId}/inventory/receipt-variants?${params}`,
      )
        .then((items) => {
          if (!cancelled) setVariants(items);
        })
        .catch((caught) => {
          if (!cancelled) setReceiptError(errorMessage(caught));
        });
    }, variantSearch.trim() ? 200 : 0);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [membership, receiptOpen, variantSearch]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const current = await fetchSession();
        if (cancelled) return;
        if (!current) {
          router.replace('/login');
          return;
        }
        if (!current.memberships.length) {
          setSession(current);
          setLoadError('This account has no organization membership, so there is no stock to show.');
          setLoading(false);
          return;
        }
        const nextMembership = current.memberships[0];
        setSession(current);
        setMembership(nextMembership);
        if (nextMembership.permissions.some((permission) => permission === '*' || permission === READ)) {
          await load(nextMembership.organizationId);
        }
        if (!cancelled) setLoading(false);
      } catch (caught) {
        if (!cancelled) {
          setLoadError(errorMessage(caught));
          setLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [load, router]);

  async function refresh() {
    if (!membership) return;
    setRefreshing(true);
    try {
      await load(membership.organizationId);
      setLoadError(null);
    } catch (caught) {
      setLoadError(errorMessage(caught));
    } finally {
      setRefreshing(false);
    }
  }

  function openReceiptForm() {
    setReceiptError(null);
    setReceiptNotice(null);
    setSelectedWarehouse('');
    setSelectedVariant('');
    setReceiptQuantity('');
    setReceiptReference('');
    setVariantSearch('');
    setProofFile(null);
    setReceiptOpen(true);
  }

  async function submitReceipt(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!membership || !proofFile) return;
    setReceiptBusy(true);
    setReceiptError(null);
    const formData = new FormData();
    formData.set('warehouseId', selectedWarehouse);
    formData.set('variantId', selectedVariant);
    formData.set('quantity', receiptQuantity);
    formData.set('reference', receiptReference);
    formData.set('idempotencyKey', `receipt-${crypto.randomUUID()}`);
    formData.set('proof_file', proofFile);
    try {
      await apiUpload(
        `/api/v1/organizations/${membership.organizationId}/inventory/receipts`,
        formData,
      );
      setReceiptOpen(false);
      setReceiptNotice(`Receipt recorded with proof "${proofFile.name}".`);
      try {
        await load(membership.organizationId);
        setLoadError(null);
      } catch (caught) {
        setLoadError(`Receipt was recorded, but inventory could not be refreshed: ${errorMessage(caught)}`);
      }
    } catch (caught) {
      setReceiptError(errorMessage(caught));
    } finally {
      setReceiptBusy(false);
    }
  }

  async function handleLogout() {
    try {
      await logout();
    } finally {
      router.replace('/login');
    }
  }

  if (loading) {
    return (
      <main className="auth-page">
        <p>Loading inventory…</p>
      </main>
    );
  }

  return (
    <main className="shell">
      <aside className="sidebar">
        <div className="brand-block">
          <span className="brand-mark">A</span>
          <div>
            <p className="brand-name">ARATI</p>
            <p className="brand-caption">Business ERP</p>
          </div>
        </div>

        <div className="workspace-switcher">
          <span className="switcher-label">Workspace</span>
          <strong>{membership ? 'Demo Distribution Co.' : '—'}</strong>
          <span className="switcher-meta">Inventory console</span>
        </div>

        <nav aria-label="Primary navigation">
          <p className="nav-heading">Workspace</p>
          <a className="nav-item" href="/"><span className="nav-icon">01</span>Overview</a>
          <a className="nav-item" href="/catalog"><span className="nav-icon">02</span>Catalogue</a>
          <a className="nav-item nav-item-active" href="/inventory"><span className="nav-icon">03</span>Inventory</a>
          <span className="nav-item nav-item-disabled"><span className="nav-icon">04</span>Sales &amp; POS</span>
          <span className="nav-item nav-item-disabled"><span className="nav-icon">05</span>Procurement</span>
        </nav>

        <div className="sidebar-footer">
          <div className="user-chip">
            <span className="avatar">{(session?.user.displayName ?? '??').slice(0, 2).toUpperCase()}</span>
            <span>
              <strong>{session?.user.displayName}</strong>
              <small>{session?.user.email}</small>
            </span>
          </div>
          <button className="logout-button" onClick={() => void handleLogout()}>Sign out</button>
        </div>
      </aside>

      <section className="content">
        <header className="topbar">
          <div className="breadcrumb"><span>Workspace</span><b>/</b><strong>Inventory</strong></div>
          <div className="topbar-actions">
            <span className="system-status"><span className="status-dot" /> API {apiBaseUrl}</span>
          </div>
        </header>

        <div className="page-body">
          <div className="welcome-row">
            <div>
              <p className="eyebrow">Internal only → never on the storefront</p>
              <h1>Inventory</h1>
              <p className="lead">
                Stock positions and the movement ledger behind them. Customers only ever see
                In stock, Enquire or Unavailable — no counts, no warehouses, no reservations.
              </p>
            </div>
            <div className="inventory-actions">
              {canWrite ? (
                <button className="primary-button" onClick={openReceiptForm}>
                  <span aria-hidden>＋</span>Add inventory
                </button>
              ) : null}
              <button className="secondary-button" onClick={() => void refresh()} disabled={refreshing || !canRead}>
                {refreshing ? 'Refreshing…' : 'Refresh'}
              </button>
            </div>
          </div>

          {receiptNotice ? <p className="notice notice-ok" role="status">{receiptNotice}</p> : null}
          {loadError ? <p className="notice notice-error" role="alert">{loadError}</p> : null}

          {receiptOpen ? (
            <div className="dialog-backdrop">
              <section className="receipt-dialog" role="dialog" aria-modal="true" aria-labelledby="receipt-title">
                <div className="panel-heading">
                  <div>
                    <p className="eyebrow">Ledger receipt</p>
                    <h2 id="receipt-title">Add inventory</h2>
                  </div>
                  <button className="text-button" type="button" onClick={() => setReceiptOpen(false)} disabled={receiptBusy}>
                    Close
                  </button>
                </div>
                <p className="preview-note">
                  Receipts add units to the ON_HAND bucket. Select an existing active SKU; add new products and SKUs in Catalogue first.
                  The attached proof is stored privately and becomes part of the immutable receipt audit trail.
                </p>
                {receiptError ? <p className="notice notice-error" role="alert">{receiptError}</p> : null}
                <form className="receipt-form" onSubmit={(event) => void submitReceipt(event)}>
                  <label>
                    Warehouse
                    <select value={selectedWarehouse} onChange={(event) => setSelectedWarehouse(event.target.value)} required>
                      <option value="">Select a warehouse</option>
                      {warehouses.map((warehouse) => (
                        <option key={warehouse.id} value={warehouse.id}>{warehouse.code} — {warehouse.name}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Search SKU / product
                    <input
                      value={variantSearch}
                      onChange={(event) => {
                        setVariantSearch(event.target.value);
                        setSelectedVariant('');
                      }}
                      placeholder="Type an SKU or product name"
                    />
                    <select
                      value={selectedVariant}
                      onChange={(event) => setSelectedVariant(event.target.value)}
                      required
                      aria-label="Select SKU"
                    >
                      <option value="">Select a SKU</option>
                      {variants.map((variant) => (
                        <option key={variant.id} value={variant.id}>
                          {variant.sku} — {variant.product.name} / {variant.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Quantity received
                    <input
                      type="number"
                      min="1"
                      max="1000000"
                      step="1"
                      required
                      value={receiptQuantity}
                      onChange={(event) => setReceiptQuantity(event.target.value)}
                    />
                  </label>
                  <label>
                    Reference / reason
                    <input
                      maxLength={255}
                      value={receiptReference}
                      onChange={(event) => setReceiptReference(event.target.value)}
                      placeholder="Supplier restock, PO number…"
                    />
                  </label>
                  <label className="receipt-proof-field">
                    Receipt / invoice proof <span className="required-mark">Required</span>
                    <input
                      type="file"
                      accept=".jpg,.jpeg,.png,.pdf,image/jpeg,image/png,application/pdf"
                      required
                      onChange={(event) => {
                        const nextFile = event.target.files?.[0] ?? null;
                        if (nextFile && !ACCEPTED_PROOF_TYPES.includes(nextFile.type)) {
                          setProofFile(null);
                          setReceiptError('Choose a JPEG, PNG, or PDF proof document.');
                          event.target.value = '';
                        } else if (nextFile && nextFile.size > MAX_PROOF_SIZE_BYTES) {
                          setProofFile(null);
                          setReceiptError('The proof document must not exceed 10 MB.');
                          event.target.value = '';
                        } else {
                          setProofFile(nextFile);
                          setReceiptError(null);
                        }
                      }}
                    />
                    <small>JPEG, PNG or PDF · maximum 10 MB. File content is validated by the API.</small>
                  </label>
                  <div className="form-actions receipt-actions">
                    <button
                      className="primary-button"
                      type="submit"
                      disabled={
                        receiptBusy ||
                        !selectedWarehouse ||
                        !selectedVariant ||
                        !Number.isInteger(Number(receiptQuantity)) ||
                        Number(receiptQuantity) <= 0 ||
                        !proofFile
                      }
                    >
                      {receiptBusy ? 'Recording receipt…' : 'Record receipt'}
                    </button>
                    <button className="secondary-button" type="button" onClick={() => setReceiptOpen(false)} disabled={receiptBusy}>
                      Cancel
                    </button>
                  </div>
                </form>
              </section>
            </div>
          ) : null}

          {!canRead ? (
            <section className="panel" aria-label="Access restricted">
              <div className="panel-heading">
                <div>
                  <p className="eyebrow">Restricted</p>
                  <h2>Your role cannot see stock</h2>
                </div>
              </div>
              <p className="preview-note">
                Inventory requires the <code>inventory.read</code> permission. Ask an administrator to
                grant it if you need this view — the API refuses the request regardless of the UI.
              </p>
            </section>
          ) : (
            <>
              <section className="panel" aria-label="Stock balances">
                <div className="panel-heading">
                  <div>
                    <p className="eyebrow">{totals.balances} balance rows</p>
                    <h2>Stock by warehouse</h2>
                  </div>
                </div>
                <DataGrid
                  rows={balances}
                  columns={BALANCE_COLUMNS}
                  rowKey={(row) => row.id}
                  searchText={(row) =>
                    [
                      row.warehouse.code,
                      row.warehouse.name,
                      row.variant.sku,
                      row.variant.name,
                      row.variant.product.name,
                    ].join(' ')
                  }
                  filterLabel="Filter stock"
                  filterPlaceholder="SKU, product, variant or warehouse…"
                  emptyMessage="No stock recorded yet — post a receipt to create the first balance."
                  filteredMessage="No stock matches that filter."
                />
              </section>

              <section className="panel" aria-label="Movement ledger">
                <div className="panel-heading">
                  <div>
                    <p className="eyebrow">{totals.movements} ledger entries, newest first</p>
                    <h2>Movement ledger</h2>
                  </div>
                </div>
                <DataGrid
                  rows={movements}
                  columns={MOVEMENT_COLUMNS}
                  rowKey={(row) => row.id}
                  searchText={(row) =>
                    [row.variant.sku, row.variant.name, row.warehouse.code, row.type, row.bucket, row.reason ?? ''].join(' ')
                  }
                  filterLabel="Filter movements"
                  filterPlaceholder="SKU, warehouse, movement type…"
                  emptyMessage="No movements yet."
                  filteredMessage="No movements match that filter."
                />
                <p className="preview-note">
                  Balances are derived from these movements. They cannot be edited directly — a
                  correction is a new adjustment or damage document, so the audit trail stays intact.
                </p>
              </section>
            </>
          )}
        </div>
      </section>
    </main>
  );
}
