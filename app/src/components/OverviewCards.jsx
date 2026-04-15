import { fmt, pct, cls } from '../utils/fmt'

const riskMeta = {
  '低': { color: 'var(--down)', label: '低风险', desc: '仓位分散均衡' },
  '中': { color: '#c9a84c',    label: '中风险', desc: '局部集中，注意分散' },
  '高': { color: 'var(--up)',  label: '高风险', desc: '集中度过高，建议分散' },
}

export default function OverviewCards({ data, market }) {
  const { totalAsset, totalReturn, todayChange, todayChangePct, riskLevel, latestQuoteDate, hasQuotes } = data
  const retAbs = totalAsset - totalAsset / (1 + totalReturn / 100)
  const rm = riskMeta[riskLevel] || { color: 'var(--text2)', label: riskLevel + '风险', desc: '' }

  const tradingDate = latestQuoteDate || market?.tradingDate
  const changeLabel = market?.isMarketClosed
    ? (tradingDate ? tradingDate.slice(5) + ' 收盘' : '上个交易日')
    : '今日预估'
  const totalAssetSub = hasQuotes && tradingDate ? `含 ${tradingDate.slice(5)} 涨跌` : '持仓总市值'

  const cards = [
    {
      label: '总资产',
      sub: totalAssetSub,
      value: <><span style={{ fontSize: 13, opacity: 0.6, marginRight: 2 }}>¥</span>{fmt(totalAsset)}</>,
      valueColor: 'var(--text1)',
      delay: 'fade-up-1',
    },
    {
      label: '累计收益率',
      sub: (retAbs >= 0 ? '+' : '') + '¥' + fmt(retAbs),
      value: pct(totalReturn),
      valueColor: totalReturn >= 0 ? 'var(--up)' : 'var(--down)',
      delay: 'fade-up-2',
    },
    {
      label: changeLabel + ' 涨跌',
      sub: pct(todayChangePct),
      value: (todayChange >= 0 ? '+¥' : '-¥') + fmt(Math.abs(todayChange)),
      valueColor: todayChange >= 0 ? 'var(--up)' : 'var(--down)',
      delay: 'fade-up-3',
    },
    {
      label: '仓位风险',
      sub: rm.desc,
      value: rm.label,
      valueColor: rm.color,
      delay: 'fade-up-4',
    },
  ]

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px', marginBottom: '16px' }}
         className="md:grid-cols-4">
      {cards.map((c, i) => (
        <div key={i} className={`card ${c.delay}`} style={{ padding: '18px 20px' }}>
          <p style={{ fontSize: 10, color: 'var(--text3)', letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 10, fontFamily: 'var(--font-ui)', fontWeight: 600 }}>
            {c.label}
          </p>
          <p className="num" style={{ fontSize: 24, fontWeight: 500, color: c.valueColor, lineHeight: 1.1, marginBottom: 6 }}>
            {c.value}
          </p>
          <p style={{ fontSize: 11, color: 'var(--text3)', fontFamily: 'var(--font-num)' }}>
            {c.sub}
          </p>
        </div>
      ))}
    </div>
  )
}
