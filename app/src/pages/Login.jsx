import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function Login() {
  const { login }   = useAuth()
  const navigate    = useNavigate()
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [error,    setError]    = useState(null)
  const [loading,  setLoading]  = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      await login(email, password)
      navigate('/', { replace: true })
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const inpStyle = {
    width: '100%', background: 'var(--surface2)', border: '1px solid var(--border)',
    borderRadius: 'var(--radius-sm)', padding: '11px 14px', fontSize: 14,
    fontFamily: 'var(--font-ui)', color: 'var(--text1)', outline: 'none',
    transition: 'border-color 0.2s, box-shadow 0.2s', boxSizing: 'border-box',
  }
  const focus = e => { e.currentTarget.style.borderColor = 'var(--gold)'; e.currentTarget.style.boxShadow = '0 0 0 2px rgba(201,168,76,0.12)' }
  const blur  = e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.boxShadow = 'none' }
  const lbl   = { fontSize: 12, color: 'var(--text3)', marginBottom: 6, display: 'block', fontFamily: 'var(--font-ui)' }

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'var(--bg)', padding: '20px',
    }}>
      <div style={{ width: '100%', maxWidth: 380 }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 36 }}>
          <div style={{ fontFamily: 'var(--font-num)', fontSize: 13, color: 'var(--gold)', letterSpacing: '0.1em', marginBottom: 8 }}>
            <span style={{ opacity: 0.45, fontSize: 10 }}>▸</span> 持仓追踪
          </div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text1)', fontFamily: 'var(--font-ui)', margin: 0 }}>登录账户</h1>
          <p style={{ fontSize: 13, color: 'var(--text3)', marginTop: 6, fontFamily: 'var(--font-ui)' }}>登录后查看您的基金持仓</p>
        </div>

        {/* Card */}
        <div className="card" style={{ padding: 28 }}>
          {/* Gold top accent */}
          <div style={{ height: 2, background: 'linear-gradient(90deg, transparent, var(--gold) 40%, transparent)', margin: '-28px -28px 24px' }} />

          {error && (
            <div style={{ marginBottom: 18, padding: '10px 14px', borderRadius: 'var(--radius-sm)', background: 'rgba(224,92,92,0.08)', border: '1px solid rgba(224,92,92,0.2)', fontSize: 13, color: 'var(--up)', fontFamily: 'var(--font-ui)' }}>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <label style={lbl}>邮箱</label>
              <input
                style={inpStyle} type="email" value={email} placeholder="you@example.com"
                onChange={e => setEmail(e.target.value)}
                onFocus={focus} onBlur={blur}
                required autoFocus
              />
            </div>
            <div>
              <label style={lbl}>密码</label>
              <input
                style={inpStyle} type="password" value={password} placeholder="••••••••"
                onChange={e => setPassword(e.target.value)}
                onFocus={focus} onBlur={blur}
                required
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="btn-primary"
              style={{ width: '100%', justifyContent: 'center', padding: '11px 0', marginTop: 4, opacity: loading ? 0.6 : 1 }}
            >
              {loading ? '登录中…' : '登录'}
            </button>
          </form>
        </div>

        <p style={{ textAlign: 'center', marginTop: 20, fontSize: 13, color: 'var(--text3)', fontFamily: 'var(--font-ui)' }}>
          还没有账户？{' '}
          <Link to="/register" style={{ color: 'var(--gold)', textDecoration: 'none' }}>
            立即注册
          </Link>
        </p>
      </div>
    </div>
  )
}
