export const fmt   = n => Number(n).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const pct   = n => (n >= 0 ? '+' : '') + Number(n).toFixed(2) + '%';
export const cls   = n => n >= 0 ? 'up' : 'down';

export const poolMeta = {
  hold:   { label: '持有池',    desc: '适合继续持有',        color: '#4ade80', bg: '#0f2a1a' },
  t:      { label: '做T观察池', desc: '波动大，可高抛低吸',  color: '#60a5fa', bg: '#0f1a2a' },
  reduce: { label: '减仓池',    desc: '盈利高或风险上升',    color: '#fb923c', bg: '#2a1a0f' },
  risk:   { label: '风险池',    desc: '趋势走弱/回撤较大',   color: '#f87171', bg: '#2a0f0f' },
};

export const tagClass = {
  hold:   'tag-hold',
  t:      'tag-t',
  reduce: 'tag-reduce',
  risk:   'tag-risk',
};

export const subTagClass = {
  '趋势强':  'tag-trend',
  '波动大':  'tag-vol',
  '回撤扩大': 'tag-dd',
  '板块承压': 'tag-press',
  '涨幅过快': 'tag-press',
};
