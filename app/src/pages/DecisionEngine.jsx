import { useState, useMemo } from 'react'
import { runDecisionEngine, portfolioSummary } from '../engine/decisionEngine'
import { usePortfolio } from '../context/PortfolioContext'
import { pct, cls, fmt, poolMeta, tagClass, subTagClass } from '../utils/fmt'
import FundDetailModal from '../components/FundDetailModal'

const mktLabel = { bull: '牛市偏强', sideways: '震荡', bear: '熊市偏弱' }
const mktColor = { bull: 'text-red-400', sideways: 'text-yellow-400', bear: 'text-green-400' }

function normaliseFund(f) {
  return { ...f, return: parseFloat(f.returnPct) || 0, returnAbs: parseFloat(f.returnAbs) || 0, amount: parseFloat(f.amount) || 0 }
}

export default function DecisionEngine() {
  const { funds: rawFunds, market: liveMarket } = usePortfolio()

  const funds  = useMemo(() => rawFunds.map(normaliseFund), [rawFunds])
  const market = liveMarket || { status: '加载中', statusCode: 'mid', style: '—', hotSectors: [], riskSectors: [], sentiment: 50 }
  const [aiMode,     setAiMode]     = useState(false)
  const [loadingId,  setLoadingId]  = useState(null)
  const [selected,   setSelected]   = useState(null)
  const [overrides,  setOverrides]  = useState({})
  const [sortBy,     setSortBy]     = useState('risk')     // risk|return|amount
  const [filterSec,  setFilterSec]  = useState('')

  // Run rule-based engine
  const decisions = useMemo(() => {
    const base = runDecisionEngine(funds, market)
    return base.map(d => overrides[d.code] ? { ...d, ...overrides[d.code] } : d)
  }, [funds, market, overrides])

  const summary = useMemo(() => portfolioSummary(decisions, market), [decisions, market])

  // Filtered + sorted view (applied within each pool column)
  const sectors = useMemo(() => [...new Set(decisions.map(d => d.sector).filter(Boolean))], [decisions])

  const displayDecisions = useMemo(() => {
    let list = filterSec ? decisions.filter(d => d.sector === filterSec) : decisions
    if (sortBy === 'return') list = [...list].sort((a, b) => b.return - a.return)
    if (sortBy === 'amount') list = [...list].sort((a, b) => b.amount - a.amount)
    // 'risk' = default pool order, no extra sort needed
    return list
  }, [decisions, filterSec, sortBy])

  // ── AI re-analyze a single fund ──────────────────────────────────────────
  async function aiAnalyzeFund(fund) {
    setLoadingId(fund.code)
    try {
      const res  = await fetch('/api/analyze', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ fund, market }),
      })
      const data = await res.json()
      if (data.ok) setOverrides(prev => ({ ...prev, [fund.code]: data.decision }))
    } catch (e) {
      alert('AI分析失败：' + e.message)
    } finally {
      setLoadingId(null)
    }
  }

  const POOLS = ['risk', 'reduce', 't', 'hold']

  return (
    <div className="p-4 md:p-6 max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <div>
          <h1 className="text-lg font-bold text-white">决策引擎</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            基于三层规则分析 · 市场信号：
            <span className={`font-medium ml-1 ${mktColor[summary.mktSig]}`}>
              {mktLabel[summary.mktSig]}
            </span>
          </p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          {/* Sort */}
          <select
            value={sortBy} onChange={e => setSortBy(e.target.value)}
            className="bg-[#12152a] border border-[#2d3048] text-slate-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:border-indigo-500"
          >
            <option value="risk">按风险排序</option>
            <option value="return">按收益率</option>
            <option value="amount">按金额</option>
          </select>
          {/* Filter sector */}
          <select
            value={filterSec} onChange={e => setFilterSec(e.target.value)}
            className="bg-[#12152a] border border-[#2d3048] text-slate-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:border-indigo-500"
          >
            <option value="">全部板块</option>
            {sectors.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          {/* AI toggle */}
          <label className="flex items-center gap-2 cursor-pointer">
            <span className="text-xs text-slate-400">AI增强</span>
            <div
              onClick={() => setAiMode(v => !v)}
              className={`w-10 h-5 rounded-full transition relative ${aiMode ? 'bg-indigo-600' : 'bg-slate-700'}`}
            >
              <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${aiMode ? 'left-5' : 'left-0.5'}`} />
            </div>
          </label>
        </div>
      </div>

      {/* Summary bar */}
      <div className="card p-5 mb-4">
        <p className="section-title">整体建议</p>
        <p className="text-sm text-slate-200 mb-4">{summary.overallAdvice}</p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
          {[
            { pool: 'risk',   count: summary.counts.risk },
            { pool: 'reduce', count: summary.counts.reduce },
            { pool: 't',      count: summary.counts.t },
            { pool: 'hold',   count: summary.counts.hold },
          ].map(({ pool, count }) => {
            const meta = poolMeta[pool]
            return (
              <div key={pool} className="rounded-lg p-3 text-center" style={{ background: meta.bg + '40', border: `1px solid ${meta.color}20` }}>
                <p className="text-2xl font-bold" style={{ color: meta.color }}>{count}</p>
                <p className="text-xs text-slate-400 mt-0.5">{meta.label}</p>
              </div>
            )
          })}
        </div>
        <div className="space-y-1.5">
          {summary.actionItems.map((item, i) => (
            <p key={i} className="text-sm text-slate-300">{item}</p>
          ))}
        </div>
      </div>

      {/* Fund pools */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {POOLS.map(pool => {
          const meta  = poolMeta[pool]
          const items = displayDecisions.filter(d => d.pool === pool)
          return (
            <div key={pool}>
              <div className="flex items-center gap-2 mb-2">
                <span className="w-2 h-2 rounded-full" style={{ background: meta.color }} />
                <span className="font-semibold text-sm" style={{ color: meta.color }}>{meta.label}</span>
                <span className="text-xs text-slate-500">({items.length})</span>
              </div>
              <div className="space-y-2">
                {items.length === 0
                  ? <p className="text-xs text-slate-700 py-4 text-center border border-dashed border-[#2d3048] rounded-lg">暂无</p>
                  : items.map(fund => (
                    <DecisionCard
                      key={fund.code}
                      fund={fund}
                      aiMode={aiMode}
                      loading={loadingId === fund.code}
                      isAI={!!overrides[fund.code]}
                      onAI={() => aiAnalyzeFund(fund)}
                      onClick={() => setSelected(fund)}
                    />
                  ))
                }
              </div>
            </div>
          )
        })}
      </div>

      <FundDetailModal fund={selected} onClose={() => setSelected(null)} />
    </div>
  )
}

// ── Decision Card ─────────────────────────────────────────────────────────────
function DecisionCard({ fund, aiMode, loading, isAI, onAI, onClick }) {
  return (
    <div className="fund-card" onClick={onClick}>
      {/* Name + return */}
      <div className="flex justify-between items-start mb-2">
        <div>
          <div className="flex items-center gap-1.5 mb-0.5">
            <p className="text-sm font-semibold text-white">{fund.name}</p>
            {isAI && <span className="text-[10px] bg-indigo-900/60 text-indigo-300 px-1.5 rounded-full border border-indigo-700/40">AI</span>}
          </div>
          <p className="text-xs text-slate-500">{fund.sector}</p>
        </div>
        <div className="text-right">
          <p className={`text-sm font-bold ${cls(fund.return)}`}>{pct(fund.return)}</p>
          <p className="text-xs text-slate-500">¥{fmt(fund.amount)}</p>
        </div>
      </div>

      {/* Tags */}
      <div className="flex gap-1.5 flex-wrap mb-2">
        <span className={`tag ${tagClass[fund.pool]}`}>{fund.label}</span>
        {fund.subLabel && <span className={`tag ${subTagClass[fund.subLabel] || ''}`}>{fund.subLabel}</span>}
      </div>

      {/* Suggestion + reason */}
      <p className="text-xs text-slate-300 font-medium mb-1">{fund.suggestion}</p>
      <p className="text-xs text-slate-500 leading-relaxed">{fund.reason}</p>

      {/* Risk note */}
      <div className="mt-2 pt-2 border-t border-slate-800 flex items-start gap-1.5">
        <span className="text-[10px] text-red-400 shrink-0 mt-0.5">⚠</span>
        <p className="text-[11px] text-slate-600 leading-relaxed">{fund.riskNote}</p>
      </div>

      {/* AI button */}
      {aiMode && (
        <button
          onClick={e => { e.stopPropagation(); onAI() }}
          disabled={loading}
          className="mt-2 w-full py-1.5 rounded-md text-xs font-medium border border-indigo-800/50 text-indigo-400 hover:bg-indigo-900/30 disabled:opacity-50 transition"
        >
          {loading ? '分析中…' : isAI ? '重新AI分析' : '✨ AI增强分析'}
        </button>
      )}
    </div>
  )
}
