import { useState, useMemo } from 'react'
import FundCard from './FundCard'
import FundDetailModal from './FundDetailModal'
import FundEditModal from './FundEditModal'
import { poolMeta } from '../utils/fmt'

const POOLS = ['hold', 't', 'reduce', 'risk']

const poolColors = {
  hold:   'var(--down)',
  t:      'var(--teal)',
  reduce: 'var(--gold)',
  risk:   'var(--up)',
}

export default function FundPools({ funds }) {
  const [sortBy,     setSortBy]     = useState('return')
  const [filterSec,  setFilterSec]  = useState('')
  const [filterPool, setFilterPool] = useState('')
  const [selected,   setSelected]   = useState(null)
  const [editing,    setEditing]    = useState(null)

  const sectors = useMemo(() => [...new Set(funds.map(f => f.sector))], [funds])

  const sorted = useMemo(() => {
    let list = [...funds]
    if (filterSec)  list = list.filter(f => f.sector === filterSec)
    if (filterPool) list = list.filter(f => f.pool   === filterPool)
    if (sortBy === 'return') list.sort((a, b) => b.return - a.return)
    if (sortBy === 'amount') list.sort((a, b) => b.amount - a.amount)
    if (sortBy === 'risk')   list.sort((a, b) => {
      const o = { risk: 0, reduce: 1, t: 2, hold: 3 }
      return o[a.pool] - o[b.pool]
    })
    return list
  }, [funds, sortBy, filterSec, filterPool])

  const grouped = useMemo(() => {
    const g = { hold: [], t: [], reduce: [], risk: [] }
    sorted.forEach(f => g[f.pool]?.push(f))
    return g
  }, [sorted])

  const selStyle = {
    background: 'var(--surface2)',
    border: '1px solid var(--border)',
    color: 'var(--text2)',
    borderRadius: 'var(--radius-sm)',
    padding: '5px 10px',
    fontSize: 12,
    fontFamily: 'var(--font-ui)',
    outline: 'none',
    cursor: 'pointer',
  }

  return (
    <div className="card fade-up-6" style={{ padding: '20px', marginBottom: 16 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
        <p className="section-title" style={{ marginBottom: 0 }}>持仓分类</p>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <select style={selStyle} value={sortBy} onChange={e => setSortBy(e.target.value)}>
            <option value="return">按收益率</option>
            <option value="amount">按金额</option>
            <option value="risk">按风险</option>
          </select>
          <select style={selStyle} value={filterSec} onChange={e => setFilterSec(e.target.value)}>
            <option value="">全部板块</option>
            {sectors.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <select style={selStyle} value={filterPool} onChange={e => setFilterPool(e.target.value)}>
            <option value="">全部状态</option>
            {POOLS.map(p => <option key={p} value={p}>{poolMeta[p].label}</option>)}
          </select>
        </div>
      </div>

      {/* Pool columns */}
      <div style={{ display: 'grid', gap: 16 }} className="grid-cols-1 md:grid-cols-2 lg:grid-cols-4">
        {POOLS.map((pool, pi) => {
          const meta  = poolMeta[pool]
          const color = poolColors[pool]
          const items = grouped[pool]
          return (
            <div key={pool} className={`fade-up-${Math.min(pi + 3, 6)}`}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10, paddingBottom: 8, borderBottom: '1px solid var(--border)' }}>
                <span style={{ fontSize: 13, fontWeight: 600, color, fontFamily: 'var(--font-ui)' }}>{meta.label}</span>
                <span className="num" style={{ fontSize: 10, color: 'var(--text3)' }}>{items.length} 只</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {items.length === 0
                  ? <p style={{ fontSize: 11, color: 'var(--text3)', textAlign: 'center', padding: '20px 0' }}>暂无持仓</p>
                  : items.map(f => <FundCard key={f._id || f.code} fund={f} onClick={setSelected} onEdit={setEditing} />)
                }
              </div>
            </div>
          )
        })}
      </div>

      <FundDetailModal fund={selected} onClose={() => setSelected(null)} />
      {editing && <FundEditModal fund={editing} onClose={() => setEditing(null)} />}
    </div>
  )
}
