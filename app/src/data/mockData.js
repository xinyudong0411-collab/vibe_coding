// ============================================================
// MOCK DATA — replace or extend with real data
// ============================================================

export const overview = {
  totalAsset:     428650.00,   // 总资产（元）
  totalReturn:    +12.34,      // 总收益率（%）
  todayChange:    +1850.00,    // 今日预估变化（元）
  todayChangePct: +0.43,       // 今日变化%
  riskLevel:      '中',        // 低/中/高
};

export const market = {
  status:     '震荡偏强',
  statusCode: 'mid',            // strong/mid/weak
  style:      '成长',
  hotSectors:  ['科技', '新能源', '半导体'],
  riskSectors: ['地产', '消费'],
  sentiment:   68,              // 0-100
};

export const sectors = [
  { name: '科技',  pct: 35, risk: '中' },
  { name: '新能源', pct: 22, risk: '中' },
  { name: '消费',  pct: 18, risk: '低' },
  { name: '医疗',  pct: 12, risk: '低' },
  { name: '金融',  pct: 8,  risk: '低' },
  { name: '其他',  pct: 5,  risk: '低' },
];

export const radar = {
  concentration: 72,   // 仓位集中度
  volatility:    58,   // 波动资产占比
  drawdown:      45,   // 回撤风险
  liquidity:     80,   // 流动性
  correlation:   63,   // 板块相关性
};

export const suggestions = [
  { icon: '🔻', type: 'reduce', text: '优先减仓：景顺长城新兴成长，盈利已达18%，短期涨幅过快' },
  { icon: '⚠️', type: 'risk',   text: '避免操作：消费板块持仓，板块整体承压，等待信号' },
  { icon: '👁️', type: 't',      text: '观察低吸：汇添富中证新能源，回调未破趋势，可关注低点' },
  { icon: '✅', type: 'hold',  text: '继续持有：易方达蓝筹精选，趋势稳健，无需操作' },
];

export const funds = [
  {
    code: '110022', name: '易方达蓝筹精选',
    amount: 85000, cost: 78000,
    return: +8.97,  returnAbs: +7000,
    pool: 'hold', label: '持有', subLabel: '趋势强',
    sector: '消费', suggestion: '继续持有',
    reason: '基本面稳健，回撤可控，无需操作',
    riskNote: '若大盘转弱则注意止盈',
  },
  {
    code: '161725', name: '招商中证白酒',
    amount: 62000, cost: 65000,
    return: -4.62, returnAbs: -3000,
    pool: 'risk', label: '风险', subLabel: '板块承压',
    sector: '消费', suggestion: '谨慎持有',
    reason: '白酒板块整体回调，短期动能不足',
    riskNote: '跌破支撑位建议止损',
  },
  {
    code: '005827', name: '易方达消费行业',
    amount: 48000, cost: 41500,
    return: +15.66, returnAbs: +6500,
    pool: 'reduce', label: '减仓', subLabel: '趋势强',
    sector: '消费', suggestion: '可分批止盈',
    reason: '盈利已超15%，估值偏高',
    riskNote: '不建议全部卖出，保留底仓',
  },
  {
    code: '007119', name: '汇添富中证新能源',
    amount: 55000, cost: 58000,
    return: -5.17, returnAbs: -3000,
    pool: 't', label: '做T', subLabel: '波动大',
    sector: '新能源', suggestion: '观察低吸',
    reason: '短期回调未破趋势线，可高抛低吸',
    riskNote: '每次T不超过20%仓位',
  },
  {
    code: '001938', name: '中欧医疗健康',
    amount: 38000, cost: 35000,
    return: +8.57, returnAbs: +3000,
    pool: 'hold', label: '持有', subLabel: '趋势强',
    sector: '医疗', suggestion: '继续持有',
    reason: '医疗板块强势，持仓收益稳定',
    riskNote: '关注政策风险',
  },
  {
    code: '110020', name: '易方达科技先锋',
    amount: 72000, cost: 60000,
    return: +20.00, returnAbs: +12000,
    pool: 'reduce', label: '减仓', subLabel: '涨幅过快',
    sector: '科技', suggestion: '高位减仓',
    reason: '科技板块短期涨幅过大，获利了结',
    riskNote: '若减仓后继续涨可能踏空',
  },
  {
    code: '519736', name: '交银定期支付双息平衡',
    amount: 30000, cost: 29500,
    return: +1.69, returnAbs: +500,
    pool: 'hold', label: '持有', subLabel: '',
    sector: '金融', suggestion: '稳健持有',
    reason: '低波动品种，作为底仓配置',
    riskNote: '收益较低，注意机会成本',
  },
  {
    code: '001410', name: '信达澳银新能源产业',
    amount: 38650, cost: 45000,
    return: -14.11, returnAbs: -6350,
    pool: 'risk', label: '风险', subLabel: '回撤扩大',
    sector: '新能源', suggestion: '设置止损',
    reason: '持续回撤，短期趋势走弱',
    riskNote: '若继续下跌需考虑止损出局',
  },
];
