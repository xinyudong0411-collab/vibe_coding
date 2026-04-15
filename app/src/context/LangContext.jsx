import { createContext, useContext } from 'react'

const LangContext = createContext(null)

export const TRANSLATIONS = {
  zh: {
    // Navbar
    appName:      '基金智能助手',
    navDashboard: '📊 总览',
    navImport:    '📷 导入持仓',
    navAgent:     '🤖 AI助手',

    // Dashboard
    pageTitle:       '持仓总览',
    marketRefresh:   '↻ 刷新',
    marketLoading:   '市场数据加载中…',
    marketError:     '⚠ 市场数据加载失败，点击重试',
    clearData:       '清除数据',
    clearConfirm:    '确定清除所有持仓数据？',
    noData:          '暂无持仓数据',
    noDataDesc:      '请先导入你的基金持仓截图，系统将自动识别并分析你的投资组合',
    importBtn:       '📷 导入持仓截图',

    // Overview cards
    totalAsset:      '总资产',
    totalReturn:     '总收益率',
    todayEstimate:   '今日预估变化',
    riskLevel:       '仓位风险等级',
    riskLow:         '低风险',
    riskMid:         '中风险',
    riskHigh:        '高风险',
    riskDescLow:     '仓位分散均衡',
    riskDescMid:     '局部集中，注意分散',
    riskDescHigh:    '集中度过高，建议分散',

    // Market panel
    marketEnv:       '市场环境',
    realtime:        '实时',
    marketStatus:    '大盘状态',
    marketStyle:     '市场风格',
    sentiment:       '市场情绪',
    sentimentFear:   '恐慌',
    sentimentGreed:  '贪婪',
    hotSectors:      '热门板块',
    riskSectors:     '风险板块',
    marketNews:      '市场资讯',
    newsLoading:     '加载中…',
    newsError:       '资讯加载失败',
    noNews:          '暂无资讯',
    aiAnalysis:      '✨ AI 分析',
    aiAnalyzing:     '分析中…',
    aiError:         '分析失败，请重试',
    originalSummary: '原文摘要',
    readMore:        '阅读原文 →',
    holdingRelated:  '持仓相关',

    // Suggestions
    suggestions:     '操作建议',

    // Agent
    agentContext:    '持仓上下文：',
    agentFunds:      '只基金',
    agentMarket:     '市场：',
    agentRisk:       '只风险',
    agentReduce:     '只减仓',
    agentPlaceholder:'问我关于你持仓的任何问题…',
    agentSend:       '发送',
    agentStop:       '■ 停止',
    agentDisclaimer: 'AI仅供参考，不构成投资建议，投资有风险',
    agentGreeting:   '你好！我是你的基金持仓助手。\n\n我已经分析了你当前的持仓情况，可以帮你解答关于做T时机、仓位风险、板块分析等问题。\n\n你想了解什么？',
    quickQuestions:  ['今天该不该做T？', '哪些基金风险最高？', '我的仓位集中度怎么样？', '新能源板块还能继续持有吗？', '现在市场是什么状态？', '盈利超过15%的基金要不要减仓？'],
    noApiKey:        '⚠ 未配置 API Key',
    noApiKeyDesc:    '请在 app/.env 中设置 ANTHROPIC_API_KEY，然后重启服务器。',
    quickQLabel:     '快速提问',
    me:              '我',
    errorPrefix:     '错误：',
  },
}

export function LangProvider({ children }) {
  const t = key => TRANSLATIONS.zh[key] ?? key
  return (
    <LangContext.Provider value={{ t }}>
      {children}
    </LangContext.Provider>
  )
}

export function useLang() {
  return useContext(LangContext)
}
