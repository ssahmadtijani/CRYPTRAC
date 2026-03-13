import { NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const navItems = [
  { to: '/', label: 'Dashboard', icon: '⬛' },
  { to: '/transactions', label: 'Transactions', icon: '↔' },
  { to: '/wallets', label: 'Wallets', icon: '🔑' },
  { to: '/compliance', label: 'Compliance', icon: '📋' },
];

export default function Sidebar() {
  const { user, logout } = useAuth();

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
