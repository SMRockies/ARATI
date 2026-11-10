'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import {
  apiGet,
  apiSend,
  errorMessage,
  fetchSession,
  isApiError,
  logout,
  storefrontProductUrl,
  type CatalogMaster,
  type MarketProduct,
  type Membership,
  type Paged,
  type Product,
  type Session,
  type Specification,
} from '../../lib/api';
import { DERIVED_NOTES, FIELD_HINTS, PERMISSIONS } from '../../lib/catalog-hints';
import { getRuntimeConfig } from '../../lib/runtime-config';
import { ReadOnlyGrid } from './readonly-grid';

type Draft = {
  name: string;
  summary: string;
  description: string;
  brandId: string;
  categoryId: string;
  specifications: Specification[];
  imageUrl: string;
  imageAlt: string;
  isEnquiryAllowed: boolean;
};

type CreateDraft = Draft & { code: string; sku: string };

type Notice = { tone: 'ok' | 'error'; text: string };

const hintFor = (field: string) => FIELD_HINTS.find((hint) => hint.field === field)?.effect ?? '';

function draftFrom(product: Product): Draft {
  return {
    name: product.name,
    summary: product.summary ?? '',
    description: product.description ?? '',
    brandId: product.brandId ?? '',
    categoryId: product.categoryId,
    specifications: product.specifications.map((spec) => ({ ...spec })),
    imageUrl: product.imageUrl ?? '',
    imageAlt: product.imageAlt ?? '',
    isEnquiryAllowed: product.isEnquiryAllowed,
  };
}

const emptyCreate = (): CreateDraft => ({
  code: '',
  sku: '',
  name: '',
  summary: '',
  description: '',
  brandId: '',
  categoryId: '',
  specifications: [],
  imageUrl: '',
  imageAlt: '',
  isEnquiryAllowed: true,
});

/** Human sentences describing what the draft changes versus the saved product. */
function describeChanges(draft: Draft, product: Product): string[] {
  const changes: string[] = [];
  if (draft.name !== product.name) changes.push(`Card title: "${product.name}" → "${draft.name}"`);
  if ((draft.summary ?? '') !== (product.summary ?? '')) changes.push('Card blurb / detail intro updated');
  if ((draft.description ?? '') !== (product.description ?? '')) changes.push('Detail-page description updated');
  if ((draft.brandId || '') !== (product.brandId ?? '')) {
    changes.push(`Brand filter: ${product.brand?.name ?? 'none'} → ${draft.brandId ? 'selected brand' : 'none'}`);
  }
  if (draft.categoryId !== product.categoryId) changes.push('Category filter chip updated');
  if (draft.specifications.length !== product.specifications.length) {
    changes.push(`Specifications: ${product.specifications.length} → ${draft.specifications.length} rows`);
  } else if (draft.specifications.some((row, index) => row.name !== product.specifications[index]?.name || row.value !== product.specifications[index]?.value)) {
    changes.push('Specification table contents updated');
  }
  if ((draft.imageUrl ?? '') !== (product.imageUrl ?? '')) changes.push('Product photo source updated');
  if (draft.isEnquiryAllowed !== product.isEnquiryAllowed) {
    changes.push(`Out-of-stock badge: ${draft.isEnquiryAllowed ? '"Enquire"' : '"Unavailable"'}`);
  }
  return changes;
}

function friendlyActionError(caught: unknown): string {
  if (isApiError(caught)) {
    if (caught.code === 'PRODUCT_REQUIRES_ACTIVE_VARIANT' || caught.code === 'PUBLISHED_PRODUCT_REQUIRES_ACTIVE_VARIANT') {
      return 'Add at least one SKU (variant) before publishing — the storefront sells variants, not bare products.';
    }
    if (caught.code === 'PRODUCT_NOT_ACTIVE') {
      return 'Activate the product first — only ACTIVE products can be published.';
    }
    if (caught.status === 403) {
      return 'Your role does not allow this action (catalog.publish / catalog.write).';
    }
  }
  return errorMessage(caught);
}

export default function CatalogPage() {
  const router = useRouter();
  const { apiBaseUrl, storefrontBaseUrl } = getRuntimeConfig();

  const [session, setSession] = useState<Session | null>(null);
  const [membership, setMembership] = useState<Membership | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<CatalogMaster[]>([]);
  const [brands, setBrands] = useState<CatalogMaster[]>([]);
  const [previewBySlug, setPreviewBySlug] = useState<Record<string, MarketProduct>>({});

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [busy, setBusy] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [creating, setCreating] = useState<CreateDraft | null>(null);

  const [showReadOnlyGrid, setShowReadOnlyGrid] = useState(false);

  const catalogPath = useCallback(
    (rest: string) => `/api/v1/organizations/${membership?.organizationId}/catalog/${rest}`,
    [membership],
  );

  const reload = useCallback(
    async (orgId: string) => {
      const base = `/api/v1/organizations/${orgId}/catalog/`;
      const [productPage, categoryPage, brandPage, previewPage] = await Promise.all([
        apiGet<Paged<Product>>(`${base}products?limit=100`),
        apiGet<Paged<CatalogMaster>>(`${base}categories?limit=100`),
        apiGet<Paged<CatalogMaster>>(`${base}brands?limit=100`),
        apiGet<Paged<MarketProduct>>(`${base}market-preview?limit=100`),
      ]);
      setProducts(productPage.items);
      setCategories(categoryPage.items);
      setBrands(brandPage.items);
      setPreviewBySlug(Object.fromEntries(previewPage.items.map((item) => [item.slug, item])));
    },
    [],
  );

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
          setLoadError('This account has no organization membership, so there is no catalogue to manage.');
          setLoading(false);
          return;
        }
        setSession(current);
        setMembership(current.memberships[0]);
        await reload(current.memberships[0].organizationId);
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
  }, [reload, router]);

  function startEdit(product: Product) {
    setCreating(null);
    setNotice(null);
    setEditingId(product.id);
    setDraft(draftFrom(product));
  }

  function cancelEdit() {
    setEditingId(null);
    setDraft(null);
  }

  async function withBusy(action: () => Promise<void>, failureTone: Notice['tone'] = 'error') {
    setBusy(true);
    try {
      await action();
    } catch (caught) {
      setNotice({ tone: failureTone, text: friendlyActionError(caught) });
    } finally {
      setBusy(false);
    }
  }

  async function refreshData() {
    if (membership) await reload(membership.organizationId);
  }

  async function saveEdit(product: Product) {
    if (!draft) return;
    await withBusy(async () => {
      await apiSend('PATCH', catalogPath(`products/${product.id}`), {
        name: draft.name,
        summary: draft.summary,
        description: draft.description,
        brandId: draft.brandId || null,
        categoryId: draft.categoryId,
        specifications: draft.specifications,
        imageUrl: draft.imageUrl,
        imageAlt: draft.imageAlt,
        isEnquiryAllowed: draft.isEnquiryAllowed,
      });
      await refreshData();
      setEditingId(null);
      setDraft(null);
      setNotice({
        tone: 'ok',
        text: `Saved "${draft.name}". The storefront refreshes within about a minute — ${product.slug} on ${storefrontBaseUrl}.`,
      });
    });
  }

  async function togglePublish(product: Product) {
    await withBusy(async () => {
      const action = product.isPublished ? 'unpublish' : 'publish';
      await apiSend('POST', catalogPath(`products/${product.id}/${action}`));
      await refreshData();
      setNotice({
        tone: 'ok',
        text: product.isPublished
          ? `"${product.name}" is off the storefront (refresh ≈ 60 s). It stays in the ERP.`
          : `"${product.name}" is now live on the storefront (refresh ≈ 60 s).`,
      });
    });
  }

  async function toggleLifecycle(product: Product) {
    await withBusy(async () => {
      const action = product.lifecycleStatus === 'ACTIVE' ? 'deactivate' : 'activate';
      await apiSend('POST', catalogPath(`products/${product.id}/${action}`));
      await refreshData();
      setNotice({
        tone: 'ok',
        text:
          action === 'deactivate'
            ? `"${product.name}" deactivated — it is hidden from the storefront until reactivated.`
            : `"${product.name}" activated. Publish it to put it back on the storefront.`,
      });
    });
  }

  async function createProduct(event: FormEvent) {
    event.preventDefault();
    if (!creating) return;
    await withBusy(async () => {
      const created = await apiSend<Product>('POST', catalogPath('products'), {
        code: creating.code,
        name: creating.name,
        categoryId: creating.categoryId,
        brandId: creating.brandId || null,
        summary: creating.summary || null,
        description: creating.description || null,
        imageUrl: creating.imageUrl || null,
        imageAlt: creating.imageAlt || null,
        isEnquiryAllowed: creating.isEnquiryAllowed,
        specifications: creating.specifications,
      });
      if (creating.sku.trim()) {
        await apiSend('POST', catalogPath(`products/${created.id}/variants`), {
          sku: creating.sku.trim(),
          name: creating.name,
        });
      }
      await refreshData();
      setCreating(null);
      setNotice({
        tone: 'ok',
        text: `"${created.name}" created as a draft. Publish it to show it on the storefront.`,
      });
    });
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
      <main className="console-screen">
        <p className="screen-status">Loading catalogue…</p>
      </main>
    );
  }

  if (loadError) {
    return (
      <main className="console-screen">
        <p className="form-error" role="alert">{loadError}</p>
        <button className="text-button" onClick={() => router.replace('/login')}>Back to sign in</button>
      </main>
    );
  }

  const canWrite = !!membership?.permissions.includes(PERMISSIONS.write);
  const canPublish = !!membership?.permissions.includes(PERMISSIONS.publish);
  const editingProduct = products.find((product) => product.id === editingId) ?? null;
  const availabilityBySlug: Record<string, string> = Object.fromEntries(
    Object.entries(previewBySlug).map(([slug, product]) => [slug, product.availability]),
  );

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
          <strong>Demo Distribution Co.</strong>
          <span className="switcher-meta">Catalogue console</span>
        </div>

        <nav aria-label="Primary navigation">
          <p className="nav-heading">Workspace</p>
          <a className="nav-item" href="/"><span className="nav-icon">01</span>Overview</a>
          <a className="nav-item nav-item-active" href="/catalog"><span className="nav-icon">02</span>Catalogue</a>
          <a className="nav-item" href="/inventory"><span className="nav-icon">03</span>Inventory</a>
          <a className="nav-item" href="/sales"><span className="nav-icon">04</span>Sales &amp; POS</a>
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
          <div className="breadcrumb"><span>Workspace</span><b>/</b><strong>Catalogue</strong></div>
          <div className="topbar-actions">
            <a className="storefront-link" href={storefrontBaseUrl} target="_blank" rel="noreferrer">
              Storefront ↗
            </a>
            <span className="system-status"><span className="status-dot" /> API {apiBaseUrl}</span>
          </div>
        </header>

        <div className="page-body">
          <div className="welcome-row">
            <div>
              <p className="eyebrow">Source of truth → storefront</p>
              <h1>Catalogue</h1>
              <p className="lead">
                What you save here reaches the Arati Refrigeration storefront within about a minute. Every field says where it shows up there.
              </p>
            </div>
            {canWrite ? (
              <button
                className="primary-button"
                onClick={() => {
                  setEditingId(null);
                  setDraft(null);
                  setNotice(null);
                  setCreating((current) => current ?? emptyCreate());
                  setShowReadOnlyGrid(false);
                }}
              >
                <span>+</span> New product
              </button>
            ) : null}
          </div>

          {notice ? (
            <p className={`notice notice-${notice.tone}`} role="status">{notice.text}</p>
          ) : null}

          <section className="panel legend-panel" aria-label="Field to storefront mapping">
            <div className="panel-heading">
              <div>
                <p className="eyebrow">Suggestive mapping</p>
                <h2>Where each input shows up on the storefront</h2>
              </div>
            </div>
            <table className="legend-table">
              <tbody>
                {FIELD_HINTS.map((hint) => (
                  <tr key={hint.field}>
                    <th scope="row">{hint.input}</th>
                    <td>{hint.effect}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <ul className="derived-notes">
              {DERIVED_NOTES.map((note) => (
                <li key={note}>{note}</li>
              ))}
            </ul>
          </section>

          {creating ? (
            <section className="panel create-panel" aria-label="New product">
              <div className="panel-heading">
                <div>
                  <p className="eyebrow">New record</p>
                  <h2>Create product</h2>
                </div>
                <button className="text-button" onClick={() => setCreating(null)}>Cancel</button>
              </div>
              <form className="edit-grid" onSubmit={createProduct}>
                <label>
                  Product code <span className="field-hint">Internal SKU-style code, uppercase (ERP only)</span>
                  <input required value={creating.code} onChange={(event) => setCreating({ ...creating, code: event.target.value })} placeholder="COOLER-001" />
                </label>
                <label>
                  Product name <span className="field-hint">{hintFor('name')}</span>
                  <input required value={creating.name} onChange={(event) => setCreating({ ...creating, name: event.target.value })} />
                </label>
                <label>
                  Category <span className="field-hint">{hintFor('category')}</span>
                  <select required value={creating.categoryId} onChange={(event) => setCreating({ ...creating, categoryId: event.target.value })}>
                    <option value="">Choose…</option>
                    {categories.map((category) => (
                      <option key={category.id} value={category.id}>{category.name}</option>
                    ))}
                  </select>
                </label>
                <label>
                  Brand <span className="field-hint">{hintFor('brand')}</span>
                  <select value={creating.brandId} onChange={(event) => setCreating({ ...creating, brandId: event.target.value })}>
                    <option value="">No brand</option>
                    {brands.map((brand) => (
                      <option key={brand.id} value={brand.id}>{brand.name}</option>
                    ))}
                  </select>
                </label>
                <label className="span-2">
                  Summary <span className="field-hint">{hintFor('summary')}</span>
                  <input value={creating.summary} onChange={(event) => setCreating({ ...creating, summary: event.target.value })} maxLength={400} />
                </label>
                <label className="span-2">
                  Description <span className="field-hint">{hintFor('description')}</span>
                  <textarea rows={4} value={creating.description} onChange={(event) => setCreating({ ...creating, description: event.target.value })} />
                </label>
                <label>
                  First SKU <span className="field-hint">Required before publishing — the storefront sells variants</span>
                  <input value={creating.sku} onChange={(event) => setCreating({ ...creating, sku: event.target.value })} placeholder="COOLER-001-STD" />
                </label>
                <div className="form-actions">
                  <button className="primary-button" type="submit" disabled={busy}>
                    {busy ? 'Saving…' : 'Create draft'}
                  </button>
                </div>
              </form>
            </section>
          ) : null}

          <section className="panel" aria-label="Products">
            <div className="panel-heading">
              <div>
                <p className="eyebrow">Tabular input</p>
                <h2>Products ({products.length})</h2>
              </div>
              <button
                className="text-button"
                onClick={() => setShowReadOnlyGrid((current) => !current)}
              >
                {showReadOnlyGrid ? 'Table view' : 'Grid view'}
              </button>
            </div>

            {showReadOnlyGrid ? (
              <ReadOnlyGrid
                products={products}
                availabilityBySlug={availabilityBySlug}
                onSelect={(product) => {
                  setShowReadOnlyGrid(false);
                  startEdit(product);
                }}
              />
            ) : (
            <div className="table-scroll">
              <table className="catalog-table">
                <thead>
                  <tr>
                    <th>Code</th>
                    <th>Product</th>
                    <th>Brand</th>
                    <th>Category</th>
                    <th>Summary</th>
                    <th>State</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {products.map((product) => (
                    <ProductRows
                      key={product.id}
                      product={product}
                      draft={draft}
                      setDraft={setDraft}
                      editing={editingId === product.id}
                      categories={categories}
                      brands={brands}
                      availability={previewBySlug[product.slug]?.availability ?? null}
                      busy={busy}
                      canWrite={canWrite}
                      canPublish={canPublish}
                      onEdit={() => startEdit(product)}
                      onCancel={cancelEdit}
                      onSave={() => void saveEdit(product)}
                      onPublish={() => void togglePublish(product)}
                      onLifecycle={() => void toggleLifecycle(product)}
                    />
                  ))}
                  {products.length === 0 && (
                    <tr>
                      <td className="empty-cell" colSpan={7}>
                        No products yet — use "New product" to create the first one.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            )}
          </section>
        </div>
      </section>
    </main>
  );
}
function ProductRows({
  product,
  draft,
  setDraft,
  editing,
  categories,
  brands,
  availability,
  busy,
  canWrite,
  canPublish,
  onEdit,
  onCancel,
  onSave,
  onPublish,
  onLifecycle,
}: {
  product: Product;
  draft: Draft | null;
  setDraft: (draft: Draft) => void;
  editing: boolean;
  categories: CatalogMaster[];
  brands: CatalogMaster[];
  availability: MarketProduct['availability'] | null;
  busy: boolean;
  canWrite: boolean;
  canPublish: boolean;
  onEdit: () => void;
  onCancel: () => void;
  onSave: () => void;
  onPublish: () => void;
  onLifecycle: () => void;
}) {
  const stateBadges = [
    { label: product.lifecycleStatus, cls: product.lifecycleStatus === 'ACTIVE' ? 'badge-green' : 'badge-grey' },
    product.isPublished
      ? { label: 'Published', cls: 'badge-blue' }
      : { label: 'Not on storefront', cls: 'badge-grey' },
  ];
  const changes = draft ? describeChanges(draft, product) : [];

  return (
    <>
      <tr className={editing ? 'row-editing' : ''}>
        <td className="mono">{product.code}</td>
        <td>
          <strong>{product.name}</strong>
          <span className="cell-sub">/products/{product.slug}</span>
        </td>
        <td>{product.brand?.name ?? '—'}</td>
        <td>{product.category.name}</td>
        <td className="cell-summary">{product.summary ?? '—'}</td>
        <td>
          <span className="badges">
            {stateBadges.map((badge) => (
              <span className={`badge ${badge.cls}`} key={badge.label}>{badge.label}</span>
            ))}
            {availability ? <span className="badge badge-amber">{availability}</span> : null}
          </span>
        </td>
        <td className="cell-actions">
          {canWrite ? (
            <button className="text-button" onClick={onEdit} disabled={busy}>Edit</button>
          ) : null}
          {canPublish ? (
            <button className="text-button" onClick={onPublish} disabled={busy}>
              {product.isPublished ? 'Unpublish' : 'Publish'}
            </button>
          ) : null}
          {canWrite ? (
            <button className="text-button" onClick={onLifecycle} disabled={busy}>
              {product.lifecycleStatus === 'ACTIVE' ? 'Deactivate' : 'Activate'}
            </button>
          ) : null}
          {product.isPublished ? (
            <a className="text-button live-link" href={storefrontProductUrl(product.slug)} target="_blank" rel="noreferrer">
              Live ↗
            </a>
          ) : null}
        </td>
      </tr>

      {editing && draft ? (
        <tr className="edit-row">
          <td colSpan={7}>
            <div className="edit-layout">
              <form className="edit-grid" onSubmit={(event) => { event.preventDefault(); onSave(); }}>
                <label className="span-2">
                  Product name <span className="field-hint">{hintFor('name')}</span>
                  <input value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} />
                </label>
                <label className="span-2">
                  Summary <span className="field-hint">{hintFor('summary')}</span>
                  <input maxLength={400} value={draft.summary} onChange={(event) => setDraft({ ...draft, summary: event.target.value })} />
                </label>
                <label className="span-2">
                  Description <span className="field-hint">{hintFor('description')}</span>
                  <textarea rows={4} value={draft.description} onChange={(event) => setDraft({ ...draft, description: event.target.value })} />
                </label>
                <label>
                  Brand <span className="field-hint">{hintFor('brand')}</span>
                  <select value={draft.brandId} onChange={(event) => setDraft({ ...draft, brandId: event.target.value })}>
                    <option value="">No brand</option>
                    {brands.map((brand) => (
                      <option key={brand.id} value={brand.id}>{brand.name}</option>
                    ))}
                  </select>
                </label>
                <label>
                  Category <span className="field-hint">{hintFor('category')}</span>
                  <select value={draft.categoryId} onChange={(event) => setDraft({ ...draft, categoryId: event.target.value })}>
                    {categories.map((category) => (
                      <option key={category.id} value={category.id}>{category.name}</option>
                    ))}
                  </select>
                </label>
                <label className="checkbox-label span-2">
                  <input
                    type="checkbox"
                    checked={draft.isEnquiryAllowed}
                    onChange={(event) => setDraft({ ...draft, isEnquiryAllowed: event.target.checked })}
                  />
                  <span>Out of stock: invite enquiries <span className="field-hint">{hintFor('isEnquiryAllowed')}</span></span>
                </label>

                <fieldset className="span-2 spec-editor">
                  <legend>Specifications <span className="field-hint">{hintFor('specifications')}</span></legend>
                  {draft.specifications.map((row, index) => (
                    <div className="spec-row" key={index}>
                      <input
                        aria-label={`Specification ${index + 1} name`}
                        value={row.name}
                        placeholder="Capacity"
                        onChange={(event) => {
                          const specifications = draft.specifications.map((spec, i) => (i === index ? { ...spec, name: event.target.value } : spec));
                          setDraft({ ...draft, specifications });
                        }}
                      />
                      <input
                        aria-label={`Specification ${index + 1} value`}
                        value={row.value}
                        placeholder="500 L"
                        onChange={(event) => {
                          const specifications = draft.specifications.map((spec, i) => (i === index ? { ...spec, value: event.target.value } : spec));
                          setDraft({ ...draft, specifications });
                        }}
                      />
                      <button
                        type="button"
                        className="text-button"
                        onClick={() => setDraft({ ...draft, specifications: draft.specifications.filter((_, i) => i !== index) })}
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    className="text-button"
                    onClick={() => setDraft({ ...draft, specifications: [...draft.specifications, { name: '', value: '' }] })}
                  >
                    + Add specification
                  </button>
                </fieldset>

                <div className="form-actions span-2">
                  <button className="primary-button" type="submit" disabled={busy}>
                    {busy ? 'Saving…' : 'Save'}
                  </button>
                  <button className="text-button" type="button" onClick={onCancel} disabled={busy}>Cancel</button>
                </div>
              </form>

              <aside className="preview-panel">
                <p className="eyebrow">Live preview</p>
                <h3>How this row renders on ARATI_1</h3>
                <article className="preview-card">
                  <p className="preview-eyebrow">
                    {brands.find((brand) => brand.id === draft.brandId)?.name ?? 'No brand'} ·{' '}
                    {categories.find((category) => category.id === draft.categoryId)?.name ?? 'Category'}
                  </p>
                  <h4>{draft.name || 'Product name'}</h4>
                  <p>{draft.summary || 'Summary blurb appears here.'}</p>
                  <span className={`badge ${availability === 'IN_STOCK' ? 'badge-green' : 'badge-amber'}`}>
                    {availability ?? 'DRAFT'}
                  </span>
                  <span className="preview-url">/products/{product.slug}</span>
                </article>

                <p className="eyebrow">Unsaved changes</p>
                <ul className="change-list">
                  {changes.map((change) => (
                    <li key={change}>{change}</li>
                  ))}
                  {changes.length === 0 ? <li className="muted">No changes yet.</li> : null}
                </ul>
                <p className="preview-note">
                  Saved rows appear on the public storefront within ~60 seconds
                  {product.isPublished ? '' : ' once published'}.
                </p>
              </aside>
            </div>
          </td>
        </tr>
      ) : null}
    </>
  );
}
