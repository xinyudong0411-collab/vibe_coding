import { NavLink }   from 'react-router-dom'
import { useState }  from 'react'
import { useLang }   from '../context/LangContext'
import { useAuth }   from '../context/AuthContext'

export default function Navbar() {
  const { t }      = useLang()
  const { user, logout } = useAuth()
  const [menuOpen, setMenuOpen] = useState(false)

  const links = [
    { to: '/',       label: t('navDashboard') },
    { to: '/import', label: t('navImport') },
    { to: '/agent',  label: t('navAgent') },
  ]

  // Abbreviate email for display: "alice@example.com" → "alice"
  const displayName = user?.email?.split('@')[0] || ''

  return (
    <nav style={{
      position: 'sticky', top: 0, zIndex: 40,
      background: 'rgba(7,10,18,0.92)',
      backdropFilter: 'blur(16px)',
      borderBottom: '1px solid var(--border)',
      padding: '0 20px',
      height: '52px',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    }}>
      {/* Logo */}
      <span style={{
        fontFamily: 'var(--font-num)',
        fontSize: '13px',
        fontWeight: 500,
        color: 'var(--gold)',
        letterSpacing: '0.08em',
        display: 'flex', alignItems: 'center', gap: '7px',
      }}>
        <span style={{ opacity: 0.45, fontSize: '10px' }}>▸</span>
        持仓追踪
      </span>

      {/* Nav links */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
        {links.map(l => (
          <NavLink
            key={l.to}
            to={l.to}
            end
            className={({ isActive }) => isActive ? 'nav-link nav-link--active' : 'nav-link'}
          >
            {l.label}
          </NavLink>
        ))}
      </div>

      {/* User area */}
      <div style={{ position: 'relative' }}>
        <button
          onClick={() => setMenuOpen(v => !v)}
          style={{
            display: 'flex', alignItems: 'center', gap: 7,
            background: 'none', border: '1px solid var(--border)', borderRadius: 20,
            padding: '4px 12px 4px 8px', cursor: 'pointer',
            fontFamily: 'var(--font-ui)', fontSize: 12, color: 'var(--text2)',
            transition: 'border-color 0.15s, color 0.15s',
          }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--gold-dim)'; e.currentTarget.style.color = 'var(--text1)' }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)';   e.currentTarget.style.color = 'var(--text2)' }}
        >
          {/* Avatar dot */}
          <span style={{
            width: 20, height: 20, borderRadius: '50%',
            background: 'var(--gold-glow)', border: '1px solid var(--gold-dim)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 10, color: 'var(--gold)', fontWeight: 700, flexShrink: 0,
          }}>
            {displayName.charAt(0).toUpperCase()}
          </span>
          {displayName}
          <span style={{ fontSize: 8, opacity: 0.5, marginLeft: 1 }}>▾</span>
        </button>

        {/* Dropdown menu */}
        {menuOpen && (
          <>
            {/* Backdrop to close */}
            <div
              style={{ position: 'fixed', inset: 0, zIndex: 49 }}
              onClick={() => setMenuOpen(false)}
            />
            <div style={{
              position: 'absolute', right: 0, top: 'calc(100% + 8px)', zIndex: 50,
              background: 'var(--surface)', border: '1px solid var(--border)',
              borderRadius: 10, minWidth: 180, overflow: 'hidden',
              boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
            }}>
              {/* User info */}
              <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)' }}>
                <div style={{ fontSize: 11, color: 'var(--text3)', fontFamily: 'var(--font-ui)', marginBottom: 2 }}>登录账户</div>
                <div style={{ fontSize: 13, color: 'var(--text1)', fontFamily: 'var(--font-ui)', wordBreak: 'break-all' }}>{user?.email}</div>
              </div>
              {/* Logout */}
              <button
                onClick={() => { setMenuOpen(false); logout() }}
                style={{
                  width: '100%', padding: '11px 16px', background: 'none', border: 'none',
                  textAlign: 'left', cursor: 'pointer', fontSize: 13,
                  fontFamily: 'var(--font-ui)', color: 'var(--up)',
                  transition: 'background 0.12s',
                  display: 'flex', alignItems: 'center', gap: 8,
                }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(224,92,92,0.07)'}
                onMouseLeave={e => e.currentTarget.style.background = 'none'}
              >
                <span style={{ fontSize: 11, opacity: 0.8 }}>⏻</span>
                退出登录
              </button>
            </div>
          </>
        )}
      </div>

      <style>{`
        .nav-link {
          padding: 5px 14px;
          border-radius: 6px;
          font-size: 13px;
          font-weight: 400;
          font-family: var(--font-ui);
          color: var(--text2);
          text-decoration: none;
          transition: color 0.15s;
          letter-spacing: 0.01em;
          border-bottom: 1.5px solid transparent;
          position: relative;
          top: 1px;
        }
        .nav-link:hover { color: var(--text1); }
        .nav-link--active {
          color: var(--gold);
          border-bottom-color: var(--gold);
          font-weight: 500;
        }
      `}</style>
    </nav>
  )
}
