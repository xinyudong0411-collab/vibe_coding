import { useNavigate } from 'react-router-dom'
import { usePortfolio, computeOverview, computeSectors, computeRadar } from '../context/PortfolioContext'
import { runDecisionEngine } from '../engine/decisionEngine'
import OverviewCards    from '../components/OverviewCards'
import MarketPanel      from '../components/MarketPanel'
import SuggestionsPanel from '../components/SuggestionsPanel'
import SectorChart      from '../components/SectorChart'
import RadarChart       from '../components/RadarChart'
import FundPools        from '../components/FundPools'

// Normalise imported fund shape → decision engine shape
function normaliseFund(f) {
  return {
    ...f,
    return:    parseFloat(f.returnPct)  || 0,
    returnAbs: parseFloat(f.returnAbs)  || 0,
    amount:    parseFloat(f.amount)     || 0,
    cost:      (parseFloat(f.amount) || 0) - (parseFloat(f.returnAbs) || 0),
  }
}

// Derive suggestion list from decisions
function deriveSuggestions(decisions) {
  const typeMap = { risk: 'risk', reduce: 'reduce', t: 't', hold: 'hold' }
  return decisions.slice(0, 4).map(d => ({
    type: typeMap[d.pool] || 'hold',
    text: `${d.name}：${d.suggestion}`,
  }))
}

// ── Empty state ───────────────────────────────────────────────────────────────
function EmptyState() {
  const navigate = useNavigate()
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', gap: 24 }}>
      <div style={{ fontSize: 64 }}>📊</div>
      <div style={{ textAlign: 'center' }}>
        <h2 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text1)', marginBottom: 8, fontFamily: 'var(--font-ui)' }}>暂无持仓数据</h2>
        <p style={{ fontSize: 13, color: 'var(--text3)', maxWidth: 280, fontFamily: 'var(--font-ui)' }}>
          请先导入你的基金持仓截图，系统将自动识别并分析你的投资组合
        </p>
      </div>
      <button
        onClick={() => navigate('/import')}
        className="btn-primary"
        style={{ padding: '10px 24px' }}
      >
        📷 导入持仓截图
      </button>
    </div>
  )
}

// ── Market loading / error state ──────────────────────────────────────────────
function MarketBadge({ loading, error, market, onRefresh }) {
  if (loading) return <span style={{ fontSize: 11, color: 'var(--text3)', fontFamily: 'var(--font-ui)' }}>市场数据加载中…</span>
  if (error)   return (
    <button onClick={onRefresh} style={{ fontSize: 11, color: 'var(--up)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-ui)' }}>
      ⚠ 市场数据加载失败，点击重试
    </button>
  )
  if (!market) return null
  const dateLabel = market.isMarketClosed
    ? `${market.tradingDate} 收盘数据（今日休市）`
    : market.tradingDate
  return (
    <span style={{ fontSize: 11, color: 'var(--text3)', fontFamily: 'var(--font-ui)' }}>
      {market.status} · {dateLabel} ·
      <button onClick={onRefresh} style={{ marginLeft: 4, fontSize: 11, color: 'var(--text3)', background: 'none', border: 'none', cursor: 'pointer', transition: 'color 0.15s' }}
        onMouseEnter={e => e.currentTarget.style.color = 'var(--text2)'}
        onMouseLeave={e => e.currentTarget.style.color = 'var(--text3)'}
      >↻ 刷新</button>
    </span>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function Dashboard() {
  const { funds, market, marketLoading, marketError, refreshMarket, clearFunds, fundNavs } = usePortfolio()

  if (funds.length === 0) return <EmptyState />

  // Normalise + run decision engine
  const normFunds = funds.map(normaliseFund)
  const fallbackMarket = market || {
    status: '数据加载中', statusCode: 'mid', style: '—',
    hotSectors: [], riskSectors: [], sentiment: 50,
  }
  const decisionsRaw = runDecisionEngine(normFunds, fallbackMarket)
  // Enrich each fund with settled NAV change
  const decisions = decisionsRaw.map(f => {
    const nav = fundNavs[f._id]
    if (!nav) return f
    const todayChangePct = nav.dailyChangePct
    const todayChangeAbs = parseFloat(((f.amount || 0) * nav.dailyChangePct / 100).toFixed(2))
    return { ...f, todayChangePct, todayChangeAbs, gztime: nav.navDate }
  })
  const overview     = computeOverview(funds, market?.sectorChanges, fundNavs)
  const sectors      = computeSectors(funds)
  const radar        = computeRadar(funds)
  const suggestions  = deriveSuggestions(decisions)

  return (
    <div className="fade-up-1" style={{ padding: '16px', maxWidth: 1400, margin: '0 auto' }}>
      {/* header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 16, fontWeight: 600, color: 'var(--text1)', fontFamily: 'var(--font-ui)', marginBottom: 2 }}>持仓总览</h1>
          <p style={{ marginTop: 2 }}>
            <MarketBadge
              loading={marketLoading}
              error={marketError}
              market={market}
              onRefresh={refreshMarket}
            />
          </p>
        </div>
        <button
          onClick={() => { if (window.confirm('确定清除所有持仓数据？')) clearFunds() }}
          style={{
            fontSize: 12, color: 'var(--text3)', background: 'none', border: '1px solid transparent',
            borderRadius: 6, padding: '4px 8px', cursor: 'pointer', transition: 'color 0.15s, border-color 0.15s',
            fontFamily: 'var(--font-ui)',
          }}
          onMouseEnter={e => { e.currentTarget.style.color = 'var(--up)'; e.currentTarget.style.borderColor = 'rgba(224,92,92,0.3)' }}
          onMouseLeave={e => { e.currentTarget.style.color = 'var(--text3)'; e.currentTarget.style.borderColor = 'transparent' }}
        >
          清除数据
        </button>
      </div>

      <OverviewCards    data={overview} market={fallbackMarket} />

      <div className="grid-2col" style={{ gap: 16, marginBottom: 16 }}>
        <MarketPanel      data={fallbackMarket} />
        <SuggestionsPanel data={suggestions} />
      </div>

      <div className="grid-2col" style={{ gap: 16, marginBottom: 16 }}>
        <SectorChart data={sectors} />
        <RadarChart  data={radar} />
      </div>

      <FundPools funds={decisions} />
    </div>
  )
}
