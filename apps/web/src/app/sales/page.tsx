'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  apiGet,
  errorMessage,
  fetchSession,
  logout,
  type Membership,
  type Paged,
  type Product,
  type Session,
  type StockBalance,
} from '../../lib/api';
import { getRuntimeConfig } from '../../lib/runtime-config';

/**
 * Counter sales console.
 *
 * The till is deliberately closed. A sale has to price a line, add tax and print
 * an invoice, and none of that exists yet: `Product` carries no price, currency,
 * effective date, GST rate or HSN code, so a basket cannot be totalled and an
 * invoice could only be invented. The project roadmap lists sales, POS, invoices,
 * payments and receivables as absent, gated behind the money-and-tax slice (C1).
 *
 * So this page proves what the counter *will* stand on — the live catalogue and the
 * live stock ledger, both reading from the real API — and states plainly what is
 * missing, instead of rendering a checkout that quietly writes nothing.
 *
 * Read-only: there is no write path anywhere on this page.
 */

const READ_CATALOG = 'catalog.read';
const READ_INVENTORY = 'inventory.read';

type CatalogueFacts = { total: number; active: number; published: number };
type StockFacts = { sellable: number; warehouses: number };

type Requirement = { need: string; blockedBy: string; ready?: boolean };

const REQUIREMENTS: Requirement[] = [
  { need: 'A price on every SKU', blockedBy: 'Money & tax (C1). Product has no price, currency or effective date.' },
  { need: 'Tax rate and HSN code', blockedBy: 'Money & tax (C1). No GST or HSN field exists to compute a tax invoice.' },
  { need: 'Basket and order capture', blockedBy: 'Sales (C4). Needs the price list above before a line can be totalled.' },
  { need: 'Tax invoice', blockedBy: 'Sales (C4). Nothing issues a numbered, priced document today.' },
  { need: 'Stock issued by the sale', blockedBy: 'Sales (C4). The ISSUE movement exists in the ledger; nothing posts it on a sale.' },
  { need: 'Payment and receivables', blockedBy: 'Payments (C5). Needs invoices first to receive against.' },
  { need: 'Stock check at the counter', blockedBy: 'Live now — inventory availability and balances.', ready: true },
  { need: 'Product detail and availability', blockedBy: 'Live now — catalogue and the public market feed.', ready: true },
];

function can(permissions: string[] | undefined, code: string): boolean {
  return Boolean(permissions?.some((permission) => permission === '*' || permission === code));
}

export default function SalesPage() {
  const router = useRouter();
  const { apiBaseUrl } = getRuntimeConfig();

  const [session, setSession] = useState<Session | null>(null);
  const [membership, setMembership] = useState<Membership | null>(null);
  const [catalogue, setCatalogue] = useState<CatalogueFacts | null>(null);
  const [stock, setStock] = useState<StockFacts | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

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
          setLoadError('This account has no organization membership, so there is no counter to open.');
          setLoading(false);
          return;
        }

        const nextMembership = current.memberships[0];
        setSession(current);
        setMembership(nextMembership);

        const base = `/api/v1/organizations/${nextMembership.organizationId}`;
        const readCatalog = can(nextMembership.permissions, READ_CATALOG);
        const readStock = can(nextMembership.permissions, READ_INVENTORY);
        const failures: string[] = [];

        // The list endpoints cap `limit` at 100, so counts come from `page.total`
        // of three cheap queries rather than from a truncated sample.
        if (readCatalog) {
          try {
            const [all, active, published] = await Promise.all([
              apiGet<Paged<Product>>(`${base}/catalog/products?limit=1`),
              apiGet<Paged<Product>>(`${base}/catalog/products?limit=1&lifecycleStatus=ACTIVE`),
              apiGet<Paged<Product>>(`${base}/catalog/products?limit=1&isPublished=true`),
            ]);
            if (!cancelled) {
              setCatalogue({ total: all.page.total, active: active.page.total, published: published.page.total });
            }
          } catch (caught) {
            failures.push(`catalogue — ${errorMessage(caught)}`);
          }
        }

        if (readStock) {
          try {
            const balancePage = await apiGet<Paged<StockBalance>>(`${base}/inventory/balances?limit=100`);
            if (!cancelled) {
              setStock({
                sellable: balancePage.items.reduce((sum, balance) => sum + balance.sellable, 0),
                warehouses: new Set(balancePage.items.map((balance) => balance.warehouse.code)).size,
              });
            }
          } catch (caught) {
            failures.push(`stock — ${errorMessage(caught)}`);
          }
        }

        if (cancelled) return;
        if (failures.length) {
          setLoadError(`Could not read ${failures.join('; ')}`);
        } else if (!readCatalog && !readStock) {
          setLoadError('Your role can read neither the catalogue nor stock, so the counter has nothing to stand on.');
        }
        setLoading(false);
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
  }, [router]);

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
        <p>Loading the counter…</p>
      </main>
    );
  }

  const number = (value: number | undefined) => (value === undefined ? '—' : value.toLocaleString('en-GB'));

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
          <span className="switcher-meta">Sales console</span>
        </div>

        <nav aria-label="Primary navigation">
          <p className="nav-heading">Workspace</p>
          <a className="nav-item" href="/"><span className="nav-icon">01</span>Overview</a>
          <a className="nav-item" href="/catalog"><span className="nav-icon">02</span>Catalogue</a>
          <a className="nav-item" href="/inventory"><span className="nav-icon">03</span>Inventory</a>
          <a className="nav-item nav-item-active" href="/sales"><span className="nav-icon">04</span>Sales &amp; POS</a>
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
          <div className="breadcrumb"><span>Workspace</span><b>/</b><strong>Sales &amp; POS</strong></div>
          <div className="topbar-actions">
            <span className="system-status"><span className="status-dot" /> API {apiBaseUrl}</span>
          </div>
        </header>

        <div className="page-body">
          <div className="welcome-row">
            <div>
              <p className="eyebrow">Counter sales — not open yet</p>
              <h1>Sales &amp; POS</h1>
              <p className="lead">
                A till has to price a line, add tax and print an invoice before it can take money.
                This console has a real catalogue and a real stock ledger, and neither carries money —
                so the counter is closed on purpose rather than showing a checkout that writes nothing.
              </p>
            </div>
            <div className="inventory-actions">
              <button className="primary-button" disabled title="Needs a price list (C1) and order capture (C4)">
                <span aria-hidden>＋</span>New sale
              </button>
            </div>
          </div>

          {loadError ? <p className="notice notice-error" role="alert">{loadError}</p> : null}

          <section className="metric-grid" aria-label="What the counter would read today">
            <article className="metric-card">
              <div className="metric-top">
                <span>Catalogue</span>
                <span className="metric-delta neutral">{catalogue ? `${catalogue.active} active` : 'no access'}</span>
              </div>
              <strong>{number(catalogue?.total)}</strong>
              <div className="metric-line"><span style={{ width: catalogue?.total ? `${Math.round((catalogue.published / catalogue.total) * 100)}%` : '0%' }} /></div>
            </article>
            <article className="metric-card">
              <div className="metric-top">
                <span>Sellable units</span>
                <span className="metric-delta positive">
                  {stock ? `${stock.warehouses} ${stock.warehouses === 1 ? 'warehouse' : 'warehouses'}` : 'no access'}
                </span>
              </div>
              <strong>{number(stock?.sellable)}</strong>
              <div className="metric-line"><span style={{ width: stock?.sellable ? '72%' : '0%' }} /></div>
            </article>
            <article className="metric-card">
              <div className="metric-top">
                <span>Price list</span>
                <span className="metric-delta warning">not modelled</span>
              </div>
              <strong>None</strong>
              <div className="metric-line"><span style={{ width: '0%' }} /></div>
            </article>
          </section>

          <section className="panel legend-panel">
            <div className="panel-heading">
              <div>
                <p className="eyebrow">Counter checklist</p>
                <h2>What a sale needs</h2>
              </div>
              <span className="badge badge-amber">
                {REQUIREMENTS.filter((requirement) => requirement.ready).length} of {REQUIREMENTS.length} ready
              </span>
            </div>
            <table className="legend-table">
              <thead>
                <tr><th>A counter needs</th><th>Where it stands</th><th>Status</th></tr>
              </thead>
              <tbody>
                {REQUIREMENTS.map((requirement) => (
                  <tr key={requirement.need}>
                    <th scope="row">{requirement.need}</th>
                    <td>{requirement.blockedBy}</td>
                    <td>
                      <span className={`badge ${requirement.ready ? 'badge-green' : 'badge-amber'}`}>
                        {requirement.ready ? 'READY' : 'MISSING'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="preview-note">
              Stock and catalogue figures above are live from this API. Everything marked MISSING has no
              endpoint, table or field behind it — not a hidden button.
            </p>
          </section>

          <section className="panel">
            <div className="panel-heading">
              <div>
                <p className="eyebrow">Build order</p>
                <h2>Why it stops here</h2>
              </div>
            </div>
            <ol className="counter-steps">
              <li><strong>C1 — Money &amp; tax.</strong> Currency, MRP and dealer price with effective dates, GST rate and HSN per SKU. Nothing can be totalled without this.</li>
              <li><strong>C2 — Stock value.</strong> The ledger starts carrying worth, not just quantity.</li>
              <li><strong>C4 — Sales.</strong> Order, priced invoice, and the stock issue that follows it.</li>
              <li><strong>C5 — Payments.</strong> Receipts against invoices, outstanding and ageing.</li>
            </ol>
            <p className="preview-note">
              When C1 lands this page becomes the till: pick a SKU, see live stock, total with tax, take
              payment, print the invoice. Until then no sale can be recorded, so the action stays disabled.
            </p>
          </section>
        </div>
      </section>
    </main>
  );
}
