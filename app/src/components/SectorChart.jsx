import { Doughnut } from 'react-chartjs-2'
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js'
ChartJS.register(ArcElement, Tooltip, Legend)

const COLORS = ['#c9a84c', '#3dd6c0', '#e05c5c', '#3dbf82', '#7b88a8', '#8a6c28']
const riskTagClass = { '高': 'tag-risk', '中': 'tag-t', '低': 'tag-hold' }

export default function SectorChart({ data }) {
  const chartData = {
    labels: data.map(s => s.name),
    datasets: [{
      data: data.map(s => s.pct),
      backgroundColor: COLORS,
      borderWidth: 0,
    }],
  }

  return (
    <div className="card fade-up-5" style={{ padding: '20px' }}>
      <p className="section-title">板块分布</p>
      <div style={{ display: 'flex', gap: 20, alignItems: 'center' }}>
        <div style={{ width: 136, height: 136, flexShrink: 0 }}>
          <Doughnut
            data={chartData}
            options={{
              cutout: '65%',
              plugins: {
                legend: { display: false },
                tooltip: { callbacks: { label: ctx => ` ${ctx.label}  ${ctx.parsed}%` } },
              },
            }}
          />
        </div>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {data.map((s, i) => (
            <div key={s.name} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', flexShrink: 0, background: COLORS[i] }} />
                <span style={{ color: 'var(--text2)', fontFamily: 'var(--font-ui)' }}>{s.name}</span>
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <span className="num" style={{ color: 'var(--text3)' }}>{s.pct}%</span>
                <span className={`tag ${riskTagClass[s.risk] || 'tag-hold'}`}>{s.risk}险</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
