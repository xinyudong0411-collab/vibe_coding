import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react'
import { useAuth } from './AuthContext'

const PortfolioContext = createContext(null)

// ── Derived data helpers ──────────────────────────────────────────────────────
export function computeOverview(funds, sectorChanges = {}, fundNavs = {}) {
  if (!funds.length) return null
  const totalAsset     = funds.reduce((s, f) => s + (parseFloat(f.amount)    || 0), 0)
  const totalReturnAbs = funds.reduce((s, f) => s + (parseFloat(f.returnAbs) || 0), 0)
  const totalCost      = totalAsset - totalReturnAbs
  const losses         = funds.filter(f => (parseFloat(f.returnPct) || 0) < -10).length
  const riskLevel      = losses >= 2 ? '高' : losses >= 1 ? '中' : '低'

  let todayChange   = 0
  let coveredAmount = 0
  for (const f of funds) {
    const amt = parseFloat(f.amount) || 0
    const nav = fundNavs[f._id]
    if (nav && amt > 0) {
      todayChange   += amt * (nav.dailyChangePct / 100)
      coveredAmount += amt
    } else {
      const sector = f.sector || '其他'
      const chgPct = sectorChanges[sector] ?? null
      if (chgPct !== null && amt > 0) {
        todayChange   += amt * (chgPct / 100)
        coveredAmount += amt
      }
    }
  }
  if (coveredAmount < totalAsset && Object.keys(sectorChanges).length > 0) {
    const avgChg = Object.values(sectorChanges).reduce((a, b) => a + b, 0) / Object.values(sectorChanges).length
    todayChange += (totalAsset - coveredAmount) * (avgChg / 100)
  }
  const todayChangePct     = totalAsset > 0 ? (todayChange / totalAsset * 100) : 0
  const adjustedTotalAsset = totalAsset + todayChange
  const adjustedReturnAbs  = totalReturnAbs + todayChange
  const adjustedReturn     = totalCost > 0 ? (adjustedReturnAbs / totalCost * 100) : 0

  const navDates       = Object.values(fundNavs).map(n => n.navDate).filter(Boolean)
  const latestQuoteDate = navDates.length > 0 ? navDates[0] : null

  return {
    totalAsset:     parseFloat(adjustedTotalAsset.toFixed(2)),
    totalReturn:    parseFloat(adjustedReturn.toFixed(2)),
    todayChange:    parseFloat(todayChange.toFixed(2)),
    todayChangePct: parseFloat(todayChangePct.toFixed(3)),
    riskLevel,
    latestQuoteDate,
    hasQuotes: coveredAmount > 0,
  }
}

export function computeSectors(funds) {
  if (!funds.length) return []
  const map   = {}
  const total = funds.reduce((s, f) => s + (parseFloat(f.amount) || 0), 0)
  for (const f of funds) {
    const s = f.sector || '其他'
    map[s]  = (map[s] || 0) + (parseFloat(f.amount) || 0)
  }
  const riskMap = { '科技': '中', '新能源': '中', '消费': '低', '医疗': '低', '金融': '低', '其他': '低' }
  return Object.entries(map)
    .map(([name, amt]) => ({
      name,
      pct:  total > 0 ? Math.round(amt / total * 100) : 0,
      risk: riskMap[name] || '中',
    }))
    .sort((a, b) => b.pct - a.pct)
}

export function computeRadar(funds) {
  if (!funds.length) return { concentration: 0, volatility: 0, drawdown: 0, liquidity: 50, correlation: 0 }
  const total   = funds.reduce((s, f) => s + (parseFloat(f.amount) || 0), 0)
  const sectors = new Set(funds.map(f => f.sector || '其他'))
  const top     = Math.max(...funds.map(f => parseFloat(f.amount) || 0))
  const concentration = total > 0 ? Math.round(top / total * 100) : 0
  const volatile  = funds.filter(f => { const r = parseFloat(f.returnPct) || 0; return Math.abs(r) > 5 })
  const volatility = Math.round(volatile.length / funds.length * 100)
  const lossPct   = funds.filter(f => (parseFloat(f.returnPct) || 0) < 0).length / funds.length
  const drawdown  = Math.round(lossPct * 100)
  const correlation = Math.max(0, 100 - sectors.size * 15)
  return { concentration, volatility, drawdown, liquidity: 80, correlation }
}

// ── Provider ──────────────────────────────────────────────────────────────────
export function PortfolioProvider({ children }) {
  const { token } = useAuth()

  const [funds,         setFundsRaw]      = useState([])
  const [fundsLoaded,   setFundsLoaded]   = useState(false)
  const [market,        setMarket]        = useState(null)
  const [marketLoading, setMarketLoading] = useState(false)
  const [marketError,   setMarketError]   = useState(null)
  const [fundNavs,      setFundNavs]      = useState({})

  const saveTimerRef = useRef(null)

  // ── Load portfolio from server on mount ───────────────────────────────────
  useEffect(() => {
    if (!token) { setFundsRaw([]); setFundsLoaded(true); return }
    fetch('/api/portfolio', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(data => {
        if (data.ok) {
          const withIds = data.funds.map(f =>
            f._id ? f : { ...f, _id: Math.random().toString(36).slice(2) }
          )
          setFundsRaw(withIds)
        }
      })
      .catch(() => {})
      .finally(() => setFundsLoaded(true))
  }, [token])

  // ── Debounced save to server whenever funds change ────────────────────────
  useEffect(() => {
    if (!fundsLoaded || !token) return
    clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(() => {
      fetch('/api/portfolio', {
        method:  'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body:    JSON.stringify({ funds }),
      }).catch(() => {})
    }, 600)
  }, [funds, fundsLoaded, token])

  // ── Fund mutation helpers ─────────────────────────────────────────────────
  const setFunds = useCallback((newFunds) => {
    const withIds = newFunds.map(f =>
      f._id ? f : { ...f, _id: Math.random().toString(36).slice(2) }
    )
    setFundsRaw(withIds)
  }, [])

  const updateFund = useCallback((id, changes) => {
    if (!id) return
    setFundsRaw(prev => prev.map(f => f._id === id ? { ...f, ...changes } : f))
  }, [])

  const deleteFund = useCallback((id) => {
    if (!id) return
    setFundsRaw(prev => prev.filter(f => f._id !== id))
  }, [])

  const clearFunds = useCallback(() => {
    setFundsRaw([])
  }, [])

  // ── Market data ───────────────────────────────────────────────────────────
  const refreshMarket = useCallback(async () => {
    setMarketLoading(true)
    setMarketError(null)
    try {
      const res  = await fetch('/api/market')
      const data = await res.json()
      if (data.ok) setMarket(data.market)
      else         setMarketError(data.error || '市场数据获取失败')
    } catch (e) {
      setMarketError(e.message)
    } finally {
      setMarketLoading(false)
    }
  }, [])

  useEffect(() => {
    refreshMarket()
    const timer = setInterval(refreshMarket, 60_000)
    return () => clearInterval(timer)
  }, [refreshMarket])

  // ── Fund NAVs ─────────────────────────────────────────────────────────────
  const refreshFundNavs = useCallback(async (fundList) => {
    if (!fundList?.length) return
    try {
      const res  = await fetch('/api/fund-nav', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ funds: fundList.map(f => ({ _id: f._id, code: f.code, name: f.name })) }),
      })
      const data = await res.json()
      if (!data.ok) return
      setFundNavs(data.navs)
      for (const f of fundList) {
        const nav = data.navs[f._id]
        if (nav?.resolvedCode && !(/^\d{6}$/.test(f.code || ''))) {
          setFundsRaw(prev => prev.map(p =>
            p._id === f._id ? { ...p, code: nav.resolvedCode } : p
          ))
        }
      }
    } catch {}
  }, [])

  useEffect(() => {
    if (fundsLoaded) refreshFundNavs(funds)
  }, [funds, fundsLoaded, refreshFundNavs])

  return (
    <PortfolioContext.Provider value={{
      funds, setFunds, updateFund, deleteFund, clearFunds,
      fundsLoaded,
      market, marketLoading, marketError, refreshMarket,
      fundNavs, refreshFundNavs,
    }}>
      {children}
    </PortfolioContext.Provider>
  )
}

export function usePortfolio() {
  return useContext(PortfolioContext)
}
