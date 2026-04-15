import { Radar } from 'react-chartjs-2'
import {
  Chart as ChartJS, RadialLinearScale, PointElement,
  LineElement, Filler, Tooltip, Legend,
} from 'chart.js'
ChartJS.register(RadialLinearScale, PointElement, LineElement, Filler, Tooltip, Legend)

export default function RadarChart({ data }) {
  const chartData = {
    labels: ['仓位集中度', '波动资产占比', '回撤风险', '流动性', '板块相关性'],
    datasets: [{
      data: [data.concentration, data.volatility, data.drawdown, data.liquidity, data.correlation],
      backgroundColor: 'rgba(61,214,192,0.12)',
      borderColor: '#3dd6c0',
      pointBackgroundColor: '#c9a84c',
      borderWidth: 1.5,
      pointRadius: 3,
    }],
  }

  return (
    <div className="card fade-up-6" style={{ padding: '20px' }}>
      <p className="section-title">风险雷达</p>
      <Radar
        data={chartData}
        options={{
          scales: {
            r: {
              min: 0, max: 100,
              grid:        { color: 'rgba(28,34,56,0.8)' },
              angleLines:  { color: 'rgba(28,34,56,0.8)' },
              pointLabels: { color: '#7b88a8', font: { size: 11, family: 'Outfit, sans-serif' } },
              ticks:       { display: false },
            },
          },
          plugins: { legend: { display: false } },
        }}
      />
    </div>
  )
}
