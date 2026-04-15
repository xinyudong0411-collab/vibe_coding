import { useState } from 'react'
import { usePortfolio } from '../context/PortfolioContext'

const SECTORS = ['科技', '新能源', '消费', '医疗', '金融', '其他']

export default function FundEditModal({ fund, onClose }) {
  const { updateFund, deleteFund } = usePortfolio()

  const [form, setForm] = useState({
    name:      fund.name      || '',
    code:      fund.code      || '',
    sector:    fund.sector    || '其他',
    amount:    String(parseFloat(fund.amount)    || 0),
    returnPct: String(parseFloat(fund.returnPct) || parseFloat(fund.return) || 0),
    returnAbs: String(parseFloat(fund.returnAbs) || 0),
  })
  const [confirmDelete, setConfirmDelete] = useState(false)

  function set(key, val) { setForm(f => ({ ...f, [key]: val })) }

  function handleSave() {
    if (!form.name.trim()) return
    updateFund(fund._id, {
      name:      form.name.trim(),
      code:      form.code.trim(),
      sector:    form.sector,
      amount:    parseFloat(form.amount)    || 0,
      returnPct: parseFloat(form.returnPct) || 0,
      returnAbs: parseFloat(form.returnAbs) || 0,
    })
    onClose()
  }

  function handleDelete() {
    deleteFund(fund._id)
    onClose()
  }

  const inpStyle = {
    width: '100%', background: 'var(--surface3)', border: '1px solid var(--border)',
    borderRadius: 'var(--radius-sm)', padding: '8px 12px', fontSize: 13,
    fontFamily: 'var(--font-ui)', color: 'var(--text1)', outline: 'none',
    transition: 'border-color 0.2s, box-shadow 0.2s',
  }
  const lbl = { fontSize: 11, color: 'var(--text3)', marginBottom: 4, fontFamily: 'var(--font-ui)' }
  const onFocus = e => { e.currentTarget.style.borderColor = 'var(--gold)'; e.currentTarget.style.boxShadow = '0 0 0 2px rgba(201,168,76,0.12)' }
  const onBlur  = e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.boxShadow = 'none' }

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(7,10,18,0.88)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', zIndex: 50, padding: '0 0 0 0' }}
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div className="card" style={{ width: '100%', maxWidth: 480, borderRadius: '14px 14px 0 0', overflow: 'hidden' }}>
        {/* Gold top accent */}
        <div style={{ height: 2, background: 'linear-gradient(90deg, transparent, var(--gold) 40%, transparent)', flexShrink: 0 }} />

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px', borderBottom: '1px solid var(--border)' }}>
          <h2 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text1)', fontFamily: 'var(--font-ui)' }}>编辑持仓</h2>
          <button onClick={onClose} style={{
            width: 26, height: 26, display: 'flex', alignItems: 'center', justifyContent: 'center',
            borderRadius: '50%', background: 'var(--surface2)', border: '1px solid var(--border)',
            color: 'var(--text3)', cursor: 'pointer', fontSize: 13, transition: 'color 0.15s',
          }}
            onMouseEnter={e => e.currentTarget.style.color = 'var(--text1)'}
            onMouseLeave={e => e.currentTarget.style.color = 'var(--text3)'}
          >✕</button>
        </div>

        {/* Form */}
        <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div style={{ gridColumn: '1 / -1' }}>
              <p style={lbl}>基金名称</p>
              <input style={inpStyle} value={form.name} onChange={e => set('name', e.target.value)} placeholder="基金名称" onFocus={onFocus} onBlur={onBlur} />
            </div>
            <div>
              <p style={lbl}>基金代码</p>
              <input style={inpStyle} value={form.code} onChange={e => set('code', e.target.value)} placeholder="000001" onFocus={onFocus} onBlur={onBlur} />
            </div>
            <div>
              <p style={lbl}>板块</p>
              <select style={inpStyle} value={form.sector} onChange={e => set('sector', e.target.value)} onFocus={onFocus} onBlur={onBlur}>
                {SECTORS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <p style={lbl}>持有金额（元）</p>
              <input style={inpStyle} type="number" value={form.amount} onChange={e => set('amount', e.target.value)} placeholder="10000" onFocus={onFocus} onBlur={onBlur} />
            </div>
            <div>
              <p style={lbl}>收益率（%）</p>
              <input style={inpStyle} type="number" step="0.01" value={form.returnPct} onChange={e => set('returnPct', e.target.value)} placeholder="5.23" onFocus={onFocus} onBlur={onBlur} />
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <p style={lbl}>收益额（元，亏损填负数）</p>
              <input style={inpStyle} type="number" step="0.01" value={form.returnAbs} onChange={e => set('returnAbs', e.target.value)} placeholder="520.00" onFocus={onFocus} onBlur={onBlur} />
            </div>
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 4 }}>
            {!confirmDelete
              ? <button onClick={() => setConfirmDelete(true)} style={{ fontSize: 12, color: 'var(--up)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-ui)', transition: 'opacity 0.15s' }}
                  onMouseEnter={e => e.currentTarget.style.opacity = '0.7'}
                  onMouseLeave={e => e.currentTarget.style.opacity = '1'}
                >删除这只基金</button>
              : (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 12, color: 'var(--up)', fontFamily: 'var(--font-ui)' }}>确认删除？</span>
                  <button onClick={handleDelete} style={{
                    fontSize: 12, padding: '4px 10px', borderRadius: 'var(--radius-sm)',
                    background: 'rgba(224,92,92,0.12)', border: '1px solid rgba(224,92,92,0.3)',
                    color: 'var(--up)', cursor: 'pointer', fontFamily: 'var(--font-ui)',
                  }}>确认</button>
                  <button onClick={() => setConfirmDelete(false)} style={{ fontSize: 12, color: 'var(--text3)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-ui)' }}>取消</button>
                </div>
              )
            }
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={onClose} className="btn-ghost" style={{ padding: '8px 16px', fontSize: 13 }}>取消</button>
              <button
                onClick={handleSave}
                disabled={!form.name.trim()}
                className="btn-primary"
                style={{ padding: '8px 18px' }}
              >保存</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
