import { useState, useEffect, useMemo } from 'react'
import { usePortfolio } from '../context/PortfolioContext'
import { useLang } from '../context/LangContext'

const statusStyle = {
  strong: { border: 'rgba(224,92,92,0.2)',   bg: 'rgba(224,92,92,0.07)',   text: 'var(--up)' },
  mid:    { border: 'rgba(201,168,76,0.2)',  bg: 'rgba(201,168,76,0.07)',  text: 'var(--gold)' },
  weak:   { border: 'rgba(123,136,168,0.2)', bg: 'rgba(123,136,168,0.06)', text: 'var(--text2)' },
}

function dualTime(ts) {
  const d = ts ? new Date(ts) : new Date()
  const fmt = (tz) => d.toLocaleTimeString('zh-CN', {
    hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone: tz,
  })
  return { berlin: fmt('Europe/Berlin'), beijing: fmt('Asia/Shanghai') }
}

function NewsItem({ item, sectors = [] }) {
  const { t } = useLang()
  const [open, setOpen]         = useState(false)
  const [aiState, setAiState]   = useState('idle')
  const [analysis, setAnalysis] = useState('')

  async function loadAnalysis() {
    if (aiState !== 'idle') return
    setAiState('loading')
    try {
      const res  = await fetch('/api/news/analyze', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: item.title, summary: item.summary, sectors }),
      })
      const data = await res.json()
      if (data.ok) { setAnalysis(data.analysis); setAiState('done') }
      else throw new Error(data.error)
    } catch { setAiState('error') }
  }

  function toggle() { setOpen(v => { if (!v) loadAnalysis(); return !v }) }

  return (
    <div style={{ borderBottom: '1px solid var(--border)' }}>
      <button onClick={toggle} style={{
        width: '100%', textAlign: 'left', padding: '8px 0',
        background: 'none', border: 'none', cursor: 'pointer',
        display: 'flex', alignItems: 'flex-start', gap: 8,
      }}>
        <span style={{ fontSize: 8, color: 'var(--text3)', marginTop: 5, flexShrink: 0 }}>
          {open ? '▼' : '▶'}
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6, flexWrap: 'wrap' }}>
            {item.relevant && (
              <span style={{
                fontSize: 9, background: 'var(--teal-dim)', color: 'var(--teal)',
                border: '1px solid rgba(61,214,192,0.2)', borderRadius: 999,
                padding: '1px 6px', fontWeight: 600, flexShrink: 0, fontFamily: 'var(--font-ui)',
              }}>{t('holdingRelated')}</span>
            )}
            <p style={{ fontSize: 12, color: 'var(--text2)', lineHeight: 1.5, margin: 0 }}>{item.title}</p>
          </div>
          {item.time && (
            <p className="num" style={{ fontSize: 10, color: 'var(--text3)', marginTop: 2 }}>{item.time}</p>
          )}
        </div>
      </button>

      {open && (
        <div style={{ paddingLeft: 16, paddingBottom: 10 }}>
          <div style={{ borderRadius: 6, padding: '10px 12px', marginBottom: 8, background: 'var(--surface3)', borderLeft: '2px solid var(--teal)' }}>
            <p style={{ fontSize: 10, color: 'var(--teal)', fontWeight: 600, marginBottom: 6, letterSpacing: '0.08em', textTransform: 'uppercase', fontFamily: 'var(--font-ui)' }}>
              {t('aiAnalysis')}
            </p>
            {aiState === 'loading' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ width: 12, height: 12, border: '1.5px solid var(--teal)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
                <span style={{ fontSize: 11, color: 'var(--text3)' }}>{t('aiAnalyzing')}</span>
              </div>
            )}
            {aiState === 'done'  && <p style={{ fontSize: 12, color: 'var(--text2)', lineHeight: 1.7 }}>{analysis}</p>}
            {aiState === 'error' && <p style={{ fontSize: 11, color: 'var(--up)' }}>{t('aiError')}</p>}
          </div>
          {item.summary && item.summary !== item.title && (
            <p style={{ fontSize: 11, color: 'var(--text3)', lineHeight: 1.6, marginBottom: 6 }}>{item.summary}</p>
          )}
          {item.url && (
            <a href={item.url} target="_blank" rel="noopener noreferrer"
              onClick={e => e.stopPropagation()}
              style={{ fontSize: 10, color: 'var(--gold)', textDecoration: 'none' }}>
              阅读原文 →
            </a>
          )}
        </div>
      )}
    </div>
  )
}

function IndexCard({ idx }) {
  const up     = idx.changePct >= 0
  const clr    = up ? 'var(--up)' : 'var(--down)'
  const bg     = up ? 'rgba(224,92,92,0.07)' : 'rgba(61,191,130,0.07)'
  const border = up ? 'rgba(224,92,92,0.18)' : 'rgba(61,191,130,0.18)'
  return (
    <div style={{ borderRadius: 6, padding: '10px 12px', background: bg, border: `1px solid ${border}` }}>
      <p style={{ fontSize: 10, color: 'var(--text3)', marginBottom: 4, fontFamily: 'var(--font-ui)' }}>{idx.label}</p>
      <p className="num" style={{ fontSize: 15, fontWeight: 500, color: clr, marginBottom: 2, lineHeight: 1 }}>
        {idx.price != null ? idx.price.toFixed(2) : '—'}
      </p>
      <div className="num" style={{ fontSize: 10, color: clr, display: 'flex', gap: 4 }}>
        <span>{up ? '+' : ''}{idx.changePct?.toFixed(2)}%</span>
        <span style={{ color: 'var(--text3)' }}>|</span>
        <span>{up ? '+' : ''}{idx.changeAmt?.toFixed(2)}</span>
      </div>
    </div>
  )
}

export default function MarketPanel({ data }) {
  const { t } = useLang()
  const { status, statusCode, style, hotSectors, riskSectors, sentiment, indices = [], updatedAt } = data
  const ss = statusStyle[statusCode] || statusStyle.mid

  const { funds } = usePortfolio()
  const sectors = useMemo(() => [...new Set(funds.map(f => f.sector).filter(Boolean))], [funds])

  const [clock, setClock] = useState(() => dualTime(updatedAt))
  useEffect(() => {
    const id = setInterval(() => setClock(dualTime()), 1000)
    return () => clearInterval(id)
  }, [])

  const [news, setNews]               = useState([])
  const [newsLoading, setNewsLoading] = useState(true)
  const [newsError, setNewsError]     = useState(false)

  useEffect(() => {
    let cancelled = false
    setNewsLoading(true); setNewsError(false)
    const params = sectors.length ? `?sectors=${encodeURIComponent(sectors.join(','))}` : ''
    fetch(`/api/news${params}`)
      .then(r => r.json())
      .then(d => { if (!cancelled) { setNews(d.news || []); setNewsLoading(false) } })
      .catch(() => { if (!cancelled) { setNewsError(true); setNewsLoading(false) } })
    return () => { cancelled = true }
  }, [sectors.join(',')])

  return (
    <div className="card fade-up-5" style={{ padding: '20px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16 }}>
        <p className="section-title" style={{ marginBottom: 0 }}>{t('marketEnv')}</p>
        <div style={{ textAlign: 'right' }}>
          <p className="num" style={{ fontSize: 10, color: 'var(--text3)', lineHeight: 2 }}>
            🇩🇪 <span style={{ color: 'var(--text2)' }}>{clock.berlin}</span>
          </p>
          <p className="num" style={{ fontSize: 10, color: 'var(--text3)', lineHeight: 2 }}>
            🇨🇳 <span style={{ color: 'var(--gold)' }}>{clock.beijing}</span>
          </p>
        </div>
      </div>

      {/* Indices */}
      {indices.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
          {indices.map(idx => <IndexCard key={idx.code} idx={idx} />)}
        </div>
      )}

      {/* Status + Style */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
        <div style={{ borderRadius: 6, padding: '10px 12px', textAlign: 'center', background: ss.bg, border: `1px solid ${ss.border}` }}>
          <p style={{ fontSize: 10, color: 'var(--text3)', marginBottom: 4, fontFamily: 'var(--font-ui)' }}>{t('marketStatus')}</p>
          <p style={{ fontSize: 17, fontWeight: 600, color: ss.text, fontFamily: 'var(--font-ui)' }}>{status}</p>
        </div>
        <div style={{ borderRadius: 6, padding: '10px 12px', textAlign: 'center', background: 'rgba(201,168,76,0.07)', border: '1px solid rgba(201,168,76,0.18)' }}>
          <p style={{ fontSize: 10, color: 'var(--text3)', marginBottom: 4, fontFamily: 'var(--font-ui)' }}>{t('marketStyle')}</p>
          <p style={{ fontSize: 17, fontWeight: 600, color: 'var(--gold)', fontFamily: 'var(--font-ui)' }}>{style}</p>
        </div>
      </div>

      {/* Sentiment */}
      <div style={{ marginBottom: 14 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
          <span style={{ fontSize: 10, color: 'var(--text3)', fontFamily: 'var(--font-ui)' }}>{t('sentiment')}</span>
          <span className="num" style={{ fontSize: 10, color: 'var(--text2)' }}>{sentiment} / 100</span>
        </div>
        <div style={{ height: 4, borderRadius: 4, background: 'var(--surface3)', overflow: 'hidden' }}>
          <div style={{
            height: '100%', width: `${sentiment}%`,
            background: 'linear-gradient(90deg, var(--down), var(--gold) 50%, var(--up))',
            borderRadius: 4, transition: 'width 0.6s ease',
          }} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
          <span style={{ fontSize: 9, color: 'var(--text3)' }}>{t('sentimentFear')}</span>
          <span style={{ fontSize: 9, color: 'var(--text3)' }}>{t('sentimentGreed')}</span>
        </div>
      </div>

      {/* Sectors */}
      <div style={{ display: 'flex', gap: 24, marginBottom: 16 }}>
        <div>
          <p style={{ fontSize: 10, color: 'var(--text3)', marginBottom: 6, fontFamily: 'var(--font-ui)' }}>{t('hotSectors')}</p>
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            {hotSectors.map(s => (
              <span key={s} className="tag" style={{ background: 'rgba(61,191,130,0.1)', color: 'var(--down)', border: '1px solid rgba(61,191,130,0.22)' }}>{s}</span>
            ))}
          </div>
        </div>
        <div>
          <p style={{ fontSize: 10, color: 'var(--text3)', marginBottom: 6, fontFamily: 'var(--font-ui)' }}>{t('riskSectors')}</p>
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            {riskSectors.map(s => (
              <span key={s} className="tag" style={{ background: 'rgba(224,92,92,0.1)', color: 'var(--up)', border: '1px solid rgba(224,92,92,0.22)' }}>{s}</span>
            ))}
          </div>
        </div>
      </div>

      {/* News */}
      <div style={{ borderTop: '1px solid var(--border)', paddingTop: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <p style={{ fontSize: 10, color: 'var(--gold-dim)', fontWeight: 600, letterSpacing: '0.14em', textTransform: 'uppercase', fontFamily: 'var(--font-ui)' }}>
            {t('marketNews')}
          </p>
          {newsLoading && (
            <span style={{ fontSize: 10, color: 'var(--text3)', animation: 'pulse 1.5s ease infinite' }}>{t('newsLoading')}</span>
          )}
        </div>
        {newsError && <p style={{ fontSize: 11, color: 'var(--up)', opacity: 0.7, padding: '8px 0' }}>{t('newsError')}</p>}
        {!newsLoading && !newsError && news.length === 0 && (
          <p style={{ fontSize: 11, color: 'var(--text3)', padding: '8px 0' }}>{t('noNews')}</p>
        )}
        <div>
          {news.map(item => <NewsItem key={item.id} item={item} sectors={sectors} />)}
        </div>
      </div>
    </div>
  )
}
