import { getRuntimeConfig } from '../lib/runtime-config';

const navigation: Array<{ label: string; icon: string; active?: boolean; href?: string }> = [
  { label: 'Overview', icon: '01', active: true },
  { label: 'Catalogue', icon: '02', href: '/catalog' },
  { label: 'Inventory', icon: '03' },
  { label: 'Sales & POS', icon: '04' },
  { label: 'Procurement', icon: '05' },
  { label: 'Parties', icon: '06' }
];

const metrics = [
  { label: 'Stock on hand', value: '12,480', delta: '+4.8%', tone: 'positive' },
  { label: 'Open orders', value: '184', delta: '+12 today', tone: 'neutral' },
  { label: 'Receivables', value: '₹8.42L', delta: '14 accounts due', tone: 'warning' }
];

export default function HomePage() {
  const { apiBaseUrl } = getRuntimeConfig();

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
          <span className="switcher-meta">Main Branch <span>⌄</span></span>
        </div>

        <nav aria-label="Primary navigation">
          <p className="nav-heading">Workspace</p>
          {navigation.map((item) => (
            <a className={`nav-item ${item.active ? 'nav-item-active' : ''}`} href={item.href ?? '#'} key={item.label}>
              <span className="nav-icon">{item.icon}</span>
              {item.label}
            </a>
          ))}
        </nav>

        <div className="sidebar-footer">
          <a className="nav-item" href="#"><span className="nav-icon">06</span>Reports</a>
          <a className="nav-item" href="#"><span className="nav-icon">07</span>Settings</a>
          <div className="user-chip">
            <span className="avatar">AK</span>
            <span><strong>Arjun Kumar</strong><small>Administrator</small></span>
            <span className="user-menu">•••</span>
          </div>
        </div>
      </aside>

      <section className="content">
        <header className="topbar">
          <div className="breadcrumb"><span>Workspace</span><b>/</b><strong>Overview</strong></div>
          <div className="topbar-actions">
            <span className="system-status"><span className="status-dot" /> All systems operational</span>
            <button className="icon-button" aria-label="Notifications">◌<span className="notification-dot" /></button>
            <button className="help-button">?</button>
          </div>
        </header>

        <div className="page-body">
          <div className="welcome-row">
            <div>
              <p className="eyebrow">Monday, 06 September 2026</p>
              <h1>Good morning, Arjun.</h1>
              <p className="lead">Here is the operational pulse for your business today.</p>
            </div>
            <button className="primary-button"><span>+</span> New transaction</button>
          </div>

          <section className="metric-grid" aria-label="Business summary">
            {metrics.map((metric) => (
              <article className="metric-card" key={metric.label}>
                <div className="metric-top"><span>{metric.label}</span><span className={`metric-delta ${metric.tone}`}>{metric.delta}</span></div>
                <strong>{metric.value}</strong>
                <div className="metric-line"><span style={{ width: metric.tone === 'warning' ? '58%' : metric.tone === 'neutral' ? '72%' : '84%' }} /></div>
              </article>
            ))}
          </section>

          <section className="dashboard-grid">
            <article className="panel activity-panel">
              <div className="panel-heading"><div><p className="eyebrow">Live feed</p><h2>Recent activity</h2></div><button className="text-button">View all <span>→</span></button></div>
              <div className="activity-list">
                <ActivityItem marker="SO" color="amber" title="Sales order SO-10482 confirmed" detail="Rajesh Electricals · 14 items" time="8 min ago" />
                <ActivityItem marker="GR" color="blue" title="Goods receipt GR-00219 posted" detail="Main Warehouse · 126 units" time="24 min ago" />
                <ActivityItem marker="PY" color="green" title="Payment received from Metro Home" detail="₹42,500 · UPI collection" time="41 min ago" />
                <ActivityItem marker="TR" color="red" title="Stock transfer awaiting approval" detail="Main → North Branch · 18 items" time="1 hr ago" />
              </div>
            </article>

            <article className="panel quick-panel">
              <div className="panel-heading"><div><p className="eyebrow">Shortcuts</p><h2>Quick actions</h2></div></div>
              <div className="action-grid">
                <QuickAction icon="IN" label="New invoice" />
                <QuickAction icon="PO" label="Purchase order" />
                <QuickAction icon="ST" label="Stock transfer" />
                <QuickAction icon="PY" label="Record payment" />
              </div>
              <div className="connection-note"><span className="status-dot" /><span>API connected to <strong>{apiBaseUrl}</strong></span></div>
            </article>
          </section>
        </div>
      </section>
    </main>
  );
}

function ActivityItem({ marker, color, title, detail, time }: { marker: string; color: string; title: string; detail: string; time: string }) {
  return <div className="activity-item"><span className={`activity-marker ${color}`}>{marker}</span><div className="activity-copy"><strong>{title}</strong><span>{detail}</span></div><time>{time}</time></div>;
}

function QuickAction({ icon, label }: { icon: string; label: string }) {
  return <button className="quick-action"><span>{icon}</span><strong>{label}</strong><b>↗</b></button>;
}
