import { fmt, pct, cls, tagClass, subTagClass } from '../utils/fmt'

export default function FundCard({ fund, onClick, onEdit }) {
  return (
    <div className="fund-card" onClick={() => onClick(fund)}
      style={{ position: 'relative' }}>

      {/* Edit button */}
      <button
        onClick={e => { e.stopPropagation(); onEdit(fund) }}
        title="编辑"
        style={{
          position: 'absolute', top: 10, right: 10,
          width: 24, height: 24,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          borderRadius: 4,
          background: 'transparent',
          border: 'none',
          color: 'var(--text3)',
          fontSize: 12,
          cursor: 'pointer',
          opacity: 0,
          transition: 'opacity 0.15s, color 0.15s',
        }}
        className="edit-btn"
        onMouseEnter={e => e.currentTarget.style.color = 'var(--gold)'}
        onMouseLeave={e => e.currentTarget.style.color = 'var(--text3)'}
      >✎</button>

      {/* Name + return */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10, paddingRight: 20 }}>
        <div style={{ minWidth: 0 }}>
          <p style={{ fontSize: 13, fontWeight: 500, color: 'var(--text1)', fontFamily: 'var(--font-ui)', marginBottom: 2, lineHeight: 1.3 }}>
            {fund.name}
          </p>
          <p className="num" style={{ fontSize: 10, color: 'var(--text3)', letterSpacing: '0.04em' }}>
            {fund.code || '—'} · {fund.sector}
          </p>
        </div>
        <div style={{ textAlign: 'right', flexShrink: 0, marginLeft: 8 }}>
          <p className={`num ${cls(fund.return)}`} style={{ fontSize: 13, fontWeight: 500 }}>
            {pct(fund.return)}
          </p>
          <p className={`num ${cls(fund.returnAbs)}`} style={{ fontSize: 10 }}>
            {fund.returnAbs >= 0 ? '+' : ''}¥{fmt(fund.returnAbs)}
          </p>
        </div>
      </div>

      {/* Tags + amount */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 0 }}>
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          <span className={`tag ${tagClass[fund.pool]}`}>{fund.label}</span>
          {fund.subLabel && (
            <span className={`tag ${subTagClass[fund.subLabel] || ''}`}>{fund.subLabel}</span>
          )}
        </div>
        <p className="num" style={{ fontSize: 10, color: 'var(--text3)' }}>
          ¥{fmt(fund.amount)}
        </p>
      </div>

      {/* Today's change */}
      {fund.todayChangePct !== undefined && (
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          marginTop: 10,
          paddingTop: 8,
          borderTop: '1px solid var(--border)',
        }}>
          <span style={{ fontSize: 10, color: 'var(--text3)', fontFamily: 'var(--font-num)' }}>
            {fund.gztime ? fund.gztime.slice(5, 10) + ' 涨跌' : '预估涨跌'}
          </span>
          <span className={`num ${cls(fund.todayChangePct)}`} style={{ fontSize: 11, fontWeight: 500 }}>
            {fund.todayChangePct >= 0 ? '+' : ''}{fund.todayChangePct.toFixed(2)}%
            <span style={{ color: 'var(--text3)', margin: '0 3px' }}>·</span>
            {fund.todayChangeAbs >= 0 ? '+' : ''}¥{fmt(fund.todayChangeAbs)}
          </span>
        </div>
      )}

      {/* Suggestion */}
      <p style={{
        fontSize: 11, color: 'var(--text3)', fontFamily: 'var(--font-ui)',
        marginTop: 8, paddingTop: 8,
        borderTop: '1px solid var(--border)',
        lineHeight: 1.5,
      }}>
        {fund.suggestion}
      </p>

      <style>{`
        .fund-card:hover .edit-btn { opacity: 1 !important; }
      `}</style>
    </div>
  )
}
