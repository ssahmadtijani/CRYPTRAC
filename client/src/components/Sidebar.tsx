import { NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { UserRole } from '../types';

const navItems = [
  { to: '/', label: 'Dashboard', icon: '⬛' },
  { to: '/transactions', label: 'Transactions', icon: '↔' },
  { to: '/wallets', label: 'Wallets', icon: '🔑' },
  { to: '/compliance', label: 'Compliance', icon: '📋' },
  { to: '/cases', label: 'Cases', icon: '🗂️' },
  { to: '/exchanges', label: 'Exchanges', icon: '📊' },
  { to: '/tax', label: 'Tax Summary', icon: '💰' },
];

const authorityRoles = [UserRole.ADMIN, UserRole.COMPLIANCE_OFFICER, UserRole.AUDITOR];

export default function Sidebar() {
  const { user, logout } = useAuth();

  const isAuthority = user && authorityRoles.includes(user.role as UserRole);

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <span className="sidebar-logo">CRYPTRAC</span>
        <span className="sidebar-tagline">Compliance Dashboard</span>
      </div>

      <nav className="sidebar-nav">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            className={({ isActive }) =>
              `sidebar-link${isActive ? ' active' : ''}`
            }
          >
            <span className="sidebar-icon">{item.icon}</span>
            <span>{item.label}</span>
          </NavLink>
        ))}

        {isAuthority && (
          <>
            <div
              style={{
                padding: '0.75rem 1rem 0.25rem',
                fontSize: '0.7rem',
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                color: 'var(--text-muted)',
                borderTop: '1px solid var(--border)',
                marginTop: '0.5rem',
              }}
            >
              Authority Portal
            </div>
            <NavLink
              to="/authority"
              className={({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`}
            >
              <span className="sidebar-icon">🏛️</span>
              <span>Authority Dashboard</span>
            </NavLink>
          </>
        )}
      </nav>

      <div className="sidebar-footer">
        {user && (
          <div className="sidebar-user">
            <div className="sidebar-user-name">
              {user.firstName} {user.lastName}
            </div>
            <div className="sidebar-user-role">{user.role}</div>
          </div>
        )}
        <button className="btn btn-ghost sidebar-logout" onClick={logout}>
          Sign Out
        </button>
      </div>
    </aside>
  );
}
