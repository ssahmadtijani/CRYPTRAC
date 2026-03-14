import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import NotificationBell from './NotificationBell';

export default function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className={`app-layout${sidebarOpen ? ' sidebar-open' : ''}`}>
      <button
        className="hamburger"
        onClick={() => setSidebarOpen((o) => !o)}
        aria-label="Toggle sidebar"
      >
        ☰
      </button>

      {/* Overlay for mobile */}
      {sidebarOpen && (
        <div
          className="sidebar-overlay"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <Sidebar />

      <main className="main-content">
        {/* Top bar with notification bell */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            padding: '8px 20px',
            borderBottom: '1px solid var(--border)',
            background: 'var(--bg-surface)',
          }}
        >
          <NotificationBell />
        </div>
        <Outlet />
      </main>
    </div>
  );
}
