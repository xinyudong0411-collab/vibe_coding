// ============================================================
// Decision Engine — 3-layer rule-based analysis
// Input:  { market, funds }
// Output: funds[] with decision fields appended
// ============================================================

// ── Layer 1: Market signal ────────────────────────────────────────────────────
function marketSignal(market) {
  // statusCode: strong | mid | weak
  if (market.statusCode === 'strong') return 'bull'
  if (market.statusCode === 'weak')   return 'bear'
  return 'sideways'   // mid / default
}

// ── Layer 2: Sector signal ─────────────────────────────────────────────────
function sectorSignal(sector, market) {
  if (market.riskSectors?.includes(sector)) return 'weak'
  if (market.hotSectors?.includes(sector))  return 'strong'
  return 'neutral'
}

// ── Layer 3: Position signal ───────────────────────────────────────────────
function positionSignal(fund) {
  const ret = fund.return
  if (ret >= 15)           return 'highProfit'
  if (ret >= 8)            return 'profit'
  if (ret >= -5)           return 'flat'
  if (ret >= -12)          return 'loss'
  return 'deepLoss'
}

// ── Decision matrix ────────────────────────────────────────────────────────
//  Returns { pool, label, subLabel, suggestion, reason, riskNote }
function decide(mkt, sec, pos, fund) {
  // ── Risk pool: deep loss or bear + weak sector ──────────────────────────
  if (pos === 'deepLoss' || (mkt === 'bear' && sec === 'weak')) {
    return {
      pool:       'risk',
      label:      '风险',
      subLabel:   pos === 'deepLoss' ? '回撤扩大' : '板块承压',
      suggestion: '设置止损，控制风险',
      reason:     pos === 'deepLoss'
        ? `当前浮亏${fund.return}%，回撤较大，趋势偏弱`
        : `大盘偏弱叠加${fund.sector}板块承压，持仓风险上升`,
      riskNote:   '若跌破关键支撑位建议考虑止损出局',
    }
  }

  // ── Reduce pool: high profit, or bull + strong sector already ran ────────
  if (pos === 'highProfit' || (pos === 'profit' && sec === 'strong' && mkt === 'bull')) {
    return {
      pool:       'reduce',
      label:      '减仓',
      subLabel:   pos === 'highProfit' ? '涨幅过快' : '趋势强',
      suggestion: '可分批止盈，逢高减仓',
      reason:     `收益率已达${fund.return}%，估值偏高，短期获利了结较为合理`,
      riskNote:   '减仓后若板块继续上涨存在踏空风险，建议保留底仓',
    }
  }

  // ── T-pool: sideways market + volatile sector, or moderate loss + hot sector
  if (
    mkt === 'sideways' && sec !== 'weak' ||
    (pos === 'flat' || pos === 'loss') && sec === 'strong'
  ) {
    return {
      pool:       't',
      label:      '做T',
      subLabel:   '波动大',
      suggestion: '可高抛低吸，波段操作',
      reason:     mkt === 'sideways'
        ? `市场震荡，${fund.sector}板块波动较大，适合做T降低成本`
        : `${fund.sector}板块强势但持仓有浮亏，可低吸摊低成本`,
      riskNote:   '每次T仓位不超过20%，避免踏空主升段',
    }
  }

  // ── Hold pool: default ────────────────────────────────────────────────────
  return {
    pool:       'hold',
    label:      '持有',
    subLabel:   sec === 'strong' ? '趋势强' : '',
    suggestion: '继续持有，暂不操作',
    reason:     sec === 'strong'
      ? `${fund.sector}板块表现强势，基本面支撑，持仓安全`
      : `当前无明显风险信号，持有等待机会`,
    riskNote:   '关注板块轮动变化，若市场转弱及时调整',
  }
}

// ── Public API ────────────────────────────────────────────────────────────────
export function runDecisionEngine(funds, market) {
  const mktSig = marketSignal(market)

  return funds.map(fund => {
    const secSig = sectorSignal(fund.sector, market)
    const posSig = positionSignal(fund)
    const d      = decide(mktSig, secSig, posSig, fund)
    return { ...fund, ...d }
  })
}

// ── Portfolio-level summary ───────────────────────────────────────────────────
export function portfolioSummary(decisions, market) {
  const counts = { hold: 0, t: 0, reduce: 0, risk: 0 }
  decisions.forEach(d => counts[d.pool]++)

  const riskPct  = ((counts.risk + counts.reduce) / decisions.length * 100).toFixed(0)
  const mktSig   = marketSignal(market)

  const overallAdvice =
    mktSig === 'bear'
      ? '大盘偏弱，以风控为主，减少操作，重点关注风险池持仓'
      : mktSig === 'bull'
      ? '大盘偏强，关注盈利较高仓位的止盈机会，控制追高风险'
      : '市场震荡，优先做T降低成本，避免重仓追涨'

  const actionItems = []
  if (counts.risk   > 0) actionItems.push(`⚠️ ${counts.risk} 只基金在风险池，需关注止损`)
  if (counts.reduce > 0) actionItems.push(`🔻 ${counts.reduce} 只基金建议减仓止盈`)
  if (counts.t      > 0) actionItems.push(`🔄 ${counts.t} 只基金可考虑做T操作`)
  if (counts.hold   > 0) actionItems.push(`✅ ${counts.hold} 只基金持有即可，无需操作`)

  return { counts, riskPct, overallAdvice, actionItems, mktSig }
}
