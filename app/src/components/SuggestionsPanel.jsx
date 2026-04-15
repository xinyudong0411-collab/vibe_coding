const poolColors = {
  hold:   'var(--down)',
  t:      'var(--teal)',
  reduce: 'var(--gold)',
  risk:   'var(--up)',
}

export default function SuggestionsPanel({ data }) {
  return (
    <div className="card fade-up-5" style={{ padding: '20px' }}>
      <p className="section-title">今日建议</p>
      <div>
        {data.map((s, i) => {
          const color = poolColors[s.type] || 'var(--text3)'
          return (
            <div key={i} style={{
              display: 'flex', alignItems: 'flex-start', gap: 10,
              padding: '10px 0',
              borderBottom: i < data.length - 1 ? '1px solid var(--border)' : 'none',
            }}>
              {/* Pool color dot */}
              <span style={{
                width: 6, height: 6, borderRadius: '50%',
                background: color,
                flexShrink: 0, marginTop: 6,
              }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <span className="tag" style={{
                  background: color + '18',
                  color,
                  border: `1px solid ${color}30`,
                  marginRight: 6,
                }}>
                  {{ hold: '持有', t: '做T', reduce: '减仓', risk: '风险' }[s.type] || s.type}
                </span>
                <span style={{ fontSize: 13, color: 'var(--text1)', fontFamily: 'var(--font-ui)', lineHeight: 1.5 }}>
                  {s.text}
                </span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
