import { useState, useEffect } from 'react'
import { fmt, pct, cls, poolMeta, tagClass, subTagClass } from '../utils/fmt'
import { usePortfolio } from '../context/PortfolioContext'

const poolColors = {
  hold:   'var(--down)',
  t:      'var(--teal)',
  reduce: 'var(--gold)',
  risk:   'var(--up)',
}

// ── Tabs ─────────────────────────────────────────────────────────────────────
const TABS = [
  { key: 'overview', label: '持仓概览' },
  { key: 'decision', label: '决策分析' },
  { key: 'ai',       label: '✨ AI深度分析' },
]

// ── Mini stat box ─────────────────────────────────────────────────────────────
function Stat({ label, value, color }) {
  return (
    <div style={{ background: 'var(--surface3)', borderRadius: 'var(--radius-sm)', padding: '10px 12px' }}>
      <p style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4, fontFamily: 'var(--font-ui)' }}>{label}</p>
      <p className="num" style={{ fontSize: 15, fontWeight: 600, color: color || 'var(--text1)' }}>{value}</p>
    </div>
  )
}

// ── AI analysis panel ─────────────────────────────────────────────────────────
function AiPanel({ fund, market }) {
  const [state,  setState]  = useState('idle')
  const [result, setResult] = useState(null)
  const [err,    setErr]    = useState(null)

  async function analyze() {
    setState('loading')
    setResult(null)
    setErr(null)
    try {
      const res  = await fetch('/api/analyze', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ fund, market }),
      })
      const data = await res.json()
      if (!data.ok) throw new Error(data.error || 'AI分析失败')
      setResult(data.decision)
      setState('done')
    } catch (e) {
      setErr(e.message)
      setState('error')
    }
  }

  if (state === 'idle') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 0', gap: 16 }}>
        <div style={{ fontSize: 40 }}>🤖</div>
        <p style={{ fontSize: 13, color: 'var(--text3)', textAlign: 'center', maxWidth: 260, fontFamily: 'var(--font-ui)', lineHeight: 1.6 }}>
          使用 Claude AI 对该基金进行深度分析，综合市场环境、板块走势和持仓状态
        </p>
        <button onClick={analyze} className="btn-primary" style={{ padding: '10px 24px' }}>开始 AI 分析</button>
        {!market && <p style={{ fontSize: 11, color: 'var(--gold)', fontFamily: 'var(--font-ui)' }}>注：市场数据未就绪，分析将使用基础信息</p>}
      </div>
    )
  }

  if (state === 'loading') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '48px 0', gap: 12 }}>
        <div style={{ width: 28, height: 28, border: '2px solid var(--teal)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
        <p style={{ fontSize: 13, color: 'var(--text3)', fontFamily: 'var(--font-ui)', animation: 'pulse 1.5s ease infinite' }}>Claude AI 分析中…</p>
      </div>
    )
  }

  if (state === 'error') {
    return (
      <div style={{ padding: '24px 0' }}>
        <div style={{ padding: '10px 14px', borderRadius: 'var(--radius-sm)', background: 'rgba(224,92,92,0.07)', border: '1px solid rgba(224,92,92,0.18)', fontSize: 13, color: 'var(--up)', marginBottom: 14 }}>{err}</div>
        <button onClick={analyze} style={{ fontSize: 13, color: 'var(--gold)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-ui)' }}>↻ 重试</button>
      </div>
    )
  }

  if (state === 'done' && result) {
    const meta = poolMeta[result.pool] || poolMeta.hold
    const poolColor = poolColors[result.pool] || 'var(--text2)'
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span className="tag" style={{ background: poolColor + '20', color: poolColor, border: `1px solid ${poolColor}30` }}>{result.label}</span>
          <span style={{ fontSize: 10, background: 'rgba(61,214,192,0.1)', color: 'var(--teal)', padding: '2px 6px', borderRadius: 999, border: '1px solid rgba(61,214,192,0.2)', fontFamily: 'var(--font-ui)', fontWeight: 600 }}>AI</span>
        </div>
        <div style={{ borderRadius: 'var(--radius-sm)', padding: '12px 14px', background: `${poolColor}12`, border: `1px solid ${poolColor}22` }}>
          <p style={{ fontSize: 11, fontWeight: 600, marginBottom: 6, color: poolColor, fontFamily: 'var(--font-ui)' }}>AI 建议</p>
          <p style={{ fontSize: 13, color: 'var(--text1)', fontWeight: 500, fontFamily: 'var(--font-ui)' }}>{result.suggestion}</p>
        </div>
        <div style={{ borderRadius: 'var(--radius-sm)', padding: '12px 14px', background: 'var(--surface3)' }}>
          <p style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 6, fontFamily: 'var(--font-ui)' }}>分析原因</p>
          <p style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.65, fontFamily: 'var(--font-ui)' }}>{result.reason}</p>
        </div>
        <div style={{ borderRadius: 'var(--radius-sm)', padding: '12px 14px', background: 'rgba(224,92,92,0.07)', border: '1px solid rgba(224,92,92,0.15)' }}>
          <p style={{ fontSize: 11, color: 'var(--up)', marginBottom: 6, fontFamily: 'var(--font-ui)' }}>⚠ 风险提示</p>
          <p style={{ fontSize: 13, color: 'var(--text2)', fontFamily: 'var(--font-ui)' }}>{result.riskNote}</p>
        </div>
        <button onClick={analyze} style={{ fontSize: 11, color: 'var(--text3)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-ui)', alignSelf: 'flex-start', transition: 'color 0.15s' }}
          onMouseEnter={e => e.currentTarget.style.color = 'var(--text2)'}
          onMouseLeave={e => e.currentTarget.style.color = 'var(--text3)'}
        >↻ 重新分析</button>
      </div>
    )
  }

  return null
}

// ── Main modal ─────────────────────────────────────────────────────────────────
export default function FundDetailModal({ fund, onClose }) {
  const { funds: allFunds, market } = usePortfolio()
  const [tab, setTab] = useState('overview')

  useEffect(() => { setTab('overview') }, [fund?.code, fund?.name])

  if (!fund) return null

  const poolColor = poolColors[fund.pool] || 'var(--text2)'
  const totalAsset = allFunds.reduce((s, f) => s + (parseFloat(f.amount) || 0), 0)
  const weight     = totalAsset > 0 ? (fund.amount / totalAsset * 100) : 0
  const cost    = fund.cost ?? (fund.amount - (fund.returnAbs || 0))
  const costStr = cost > 0 ? `¥${fmt(cost)}` : '—'

  const weightColor = weight > 30 ? 'var(--up)' : weight > 20 ? 'var(--gold)' : 'var(--down)'

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(7,10,18,0.88)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', zIndex: 50 }}
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div className="card" style={{ width: '100%', maxWidth: 520, maxHeight: '92vh', display: 'flex', flexDirection: 'column', borderRadius: '14px 14px 0 0', overflow: 'hidden' }}>
        {/* Gold top accent */}
        <div style={{ height: 2, background: 'linear-gradient(90deg, transparent, var(--gold) 40%, transparent)', flexShrink: 0 }} />

        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div style={{ padding: '16px 20px 12px', borderBottom: '1px solid var(--border)', flexShrink: 0, position: 'relative' }}>
          <button onClick={onClose} style={{
            position: 'absolute', top: 14, right: 16,
            width: 26, height: 26, display: 'flex', alignItems: 'center', justifyContent: 'center',
            borderRadius: '50%', background: 'var(--surface2)', border: '1px solid var(--border)',
            color: 'var(--text3)', cursor: 'pointer', fontSize: 13, transition: 'color 0.15s',
          }}
            onMouseEnter={e => e.currentTarget.style.color = 'var(--text1)'}
            onMouseLeave={e => e.currentTarget.style.color = 'var(--text3)'}
          >✕</button>

          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', paddingRight: 36 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6, flexWrap: 'wrap' }}>
                <span className="tag" style={{ background: `${poolColor}18`, color: poolColor, border: `1px solid ${poolColor}28` }}>{fund.label}</span>
                {fund.subLabel && (
                  <span className={`tag ${subTagClass[fund.subLabel] || ''}`}>{fund.subLabel}</span>
                )}
              </div>
              <h2 style={{ fontSize: 17, fontWeight: 700, color: 'var(--text1)', fontFamily: 'var(--font-ui)', lineHeight: 1.3, marginBottom: 4 }}>{fund.name}</h2>
              <p style={{ fontSize: 11, color: 'var(--text3)', fontFamily: 'var(--font-ui)' }}>
                {fund.code && <span style={{ marginRight: 8 }}>{fund.code}</span>}
                <span>{fund.sector || '未分类'}</span>
              </p>
            </div>
            <div style={{ textAlign: 'right', flexShrink: 0 }}>
              <p className={`num ${cls(fund.return)}`} style={{ fontSize: 20, fontWeight: 700 }}>{pct(fund.return)}</p>
              <p className={`num ${cls(fund.returnAbs)}`} style={{ fontSize: 13 }}>
                {(fund.returnAbs ?? 0) >= 0 ? '+' : ''}¥{fmt(fund.returnAbs ?? 0)}
              </p>
            </div>
          </div>
        </div>

        {/* ── Tabs ───────────────────────────────────────────────────────── */}
        <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', flexShrink: 0, padding: '0 20px' }}>
          {TABS.map(t => (
            <button key={t.key} onClick={() => setTab(t.key)} style={{
              padding: '10px 12px', fontSize: 12, fontWeight: 500, fontFamily: 'var(--font-ui)',
              background: 'none', border: 'none', cursor: 'pointer',
              borderBottom: `2px solid ${tab === t.key ? 'var(--gold)' : 'transparent'}`,
              color: tab === t.key ? 'var(--gold)' : 'var(--text3)',
              marginBottom: -1, transition: 'color 0.15s',
            }}>{t.label}</button>
          ))}
        </div>

        {/* ── Body ───────────────────────────────────────────────────────── */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 20 }}>

          {/* ── Overview tab ─────────────────────────────────────────────── */}
          {tab === 'overview' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <Stat label="持有金额"   value={`¥${fmt(fund.amount)}`} />
                <Stat label="仓位权重"   value={`${weight.toFixed(1)}%`} color={weightColor} />
                <Stat label="成本金额"   value={costStr} />
                <Stat label="收益率"     value={pct(fund.return)} color={fund.return >= 0 ? 'var(--up)' : 'var(--down)'} />
              </div>

              {/* Weight bar */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text3)', marginBottom: 6, fontFamily: 'var(--font-ui)' }}>
                  <span>仓位占比</span>
                  <span>{weight.toFixed(1)}%</span>
                </div>
                <div style={{ height: 4, borderRadius: 4, background: 'var(--border)' }}>
                  <div style={{
                    height: '100%', borderRadius: 4, transition: 'width 0.6s ease',
                    width: `${Math.min(100, weight)}%`,
                    background: weightColor,
                  }} />
                </div>
                {weight > 30 && (
                  <p style={{ fontSize: 11, color: 'var(--up)', marginTop: 6, fontFamily: 'var(--font-ui)' }}>⚠ 单只基金仓位超过 30%，集中度偏高</p>
                )}
              </div>

              {/* P&L summary */}
              <div style={{
                borderRadius: 'var(--radius-sm)', padding: '14px 16px', border: '1px solid',
                background: fund.return >= 0 ? 'rgba(224,92,92,0.07)' : 'rgba(61,191,130,0.07)',
                borderColor: fund.return >= 0 ? 'rgba(224,92,92,0.15)' : 'rgba(61,191,130,0.15)',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <p style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4, fontFamily: 'var(--font-ui)' }}>浮动盈亏</p>
                    <p className={`num ${cls(fund.returnAbs ?? 0)}`} style={{ fontSize: 18, fontWeight: 700 }}>
                      {(fund.returnAbs ?? 0) >= 0 ? '+' : ''}¥{fmt(fund.returnAbs ?? 0)}
                    </p>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <p style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4, fontFamily: 'var(--font-ui)' }}>回本还需</p>
                    {(fund.return ?? 0) >= 0
                      ? <p className="num" style={{ fontSize: 13, fontWeight: 700, color: 'var(--down)' }}>已盈利</p>
                      : <p className="num" style={{ fontSize: 13, fontWeight: 700, color: 'var(--up)' }}>
                          ¥{fmt(Math.abs(fund.returnAbs ?? 0))}
                        </p>
                    }
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── Decision tab ─────────────────────────────────────────────── */}
          {tab === 'decision' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ borderRadius: 'var(--radius-sm)', padding: '12px 14px', background: `${poolColor}12`, border: `1px solid ${poolColor}22` }}>
                <p style={{ fontSize: 11, fontWeight: 600, marginBottom: 6, color: poolColor, fontFamily: 'var(--font-ui)' }}>决策建议</p>
                <p style={{ fontSize: 13, color: 'var(--text1)', fontWeight: 500, fontFamily: 'var(--font-ui)' }}>{fund.suggestion || '—'}</p>
              </div>
              <div style={{ borderRadius: 'var(--radius-sm)', padding: '12px 14px', background: 'var(--surface3)' }}>
                <p style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 6, fontFamily: 'var(--font-ui)' }}>分析原因</p>
                <p style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.65, fontFamily: 'var(--font-ui)' }}>{fund.reason || '—'}</p>
              </div>
              <div style={{ borderRadius: 'var(--radius-sm)', padding: '12px 14px', background: 'rgba(224,92,92,0.07)', border: '1px solid rgba(224,92,92,0.15)' }}>
                <p style={{ fontSize: 11, color: 'var(--up)', marginBottom: 6, fontFamily: 'var(--font-ui)' }}>⚠ 风险提示</p>
                <p style={{ fontSize: 13, color: 'var(--text2)', fontFamily: 'var(--font-ui)' }}>{fund.riskNote || '—'}</p>
              </div>

              <button
                onClick={() => setTab('ai')}
                style={{
                  width: '100%', padding: '10px', borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--gold-dim)', color: 'var(--gold)', background: 'none',
                  cursor: 'pointer', fontSize: 13, fontFamily: 'var(--font-ui)',
                  transition: 'background 0.15s',
                }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--gold-glow)'}
                onMouseLeave={e => e.currentTarget.style.background = 'none'}
              >
                ✨ 获取 AI 深度分析 →
              </button>
            </div>
          )}

          {/* ── AI tab ───────────────────────────────────────────────────── */}
          {tab === 'ai' && (
            <AiPanel fund={fund} market={market} />
          )}
        </div>
      </div>
    </div>
  )
}
