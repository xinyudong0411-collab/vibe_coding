import 'dotenv/config'
import express   from 'express'
import cors      from 'cors'
import Anthropic from '@anthropic-ai/sdk'
import Database  from 'better-sqlite3'
import bcrypt    from 'bcryptjs'
import jwt       from 'jsonwebtoken'
import { mkdirSync } from 'fs'

const app  = express()
const port = process.env.PORT || 3001

// Allow localhost in dev; set CORS_ORIGIN env var in production (e.g. "https://yourapp.com")
const corsOrigin = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN
  : /^http:\/\/localhost/
app.use(cors({ origin: corsOrigin }))
app.use(express.json({ limit: '20mb' }))

// ── Database setup ─────────────────────────────────────────────────────────
mkdirSync('./data', { recursive: true })
const db = new Database('./data/users.db')
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    email        TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    created_at   INTEGER DEFAULT (unixepoch())
  );
  CREATE TABLE IF NOT EXISTS portfolios (
    user_id    INTEGER PRIMARY KEY,
    funds_json TEXT NOT NULL DEFAULT '[]',
    updated_at INTEGER DEFAULT (unixepoch()),
    FOREIGN KEY (user_id) REFERENCES users(id)
  );
`)

const JWT_SECRET = process.env.JWT_SECRET || 'fund-manager-secret-change-in-prod'

function authMiddleware(req, res, next) {
  const header = req.headers.authorization || ''
  const token  = header.startsWith('Bearer ') ? header.slice(7) : null
  if (!token) return res.status(401).json({ ok: false, error: '未登录' })
  try {
    req.user = jwt.verify(token, JWT_SECRET)
    next()
  } catch {
    res.status(401).json({ ok: false, error: 'Token 已过期，请重新登录' })
  }
}

// ── POST /api/auth/register ────────────────────────────────────────────────
app.post('/api/auth/register', async (req, res) => {
  const { email, password } = req.body
  if (!email || !password) return res.status(400).json({ ok: false, error: '邮箱和密码不能为空' })
  if (password.length < 6)  return res.status(400).json({ ok: false, error: '密码至少6位' })
  const emailLower = email.toLowerCase().trim()
  try {
    const hash   = await bcrypt.hash(password, 10)
    const result = db.prepare('INSERT INTO users (email, password_hash) VALUES (?, ?)').run(emailLower, hash)
    const token  = jwt.sign({ id: result.lastInsertRowid, email: emailLower }, JWT_SECRET, { expiresIn: '30d' })
    res.json({ ok: true, token, user: { id: result.lastInsertRowid, email: emailLower } })
  } catch (e) {
    if (e.message.includes('UNIQUE')) return res.status(400).json({ ok: false, error: '该邮箱已被注册' })
    res.status(500).json({ ok: false, error: e.message })
  }
})

// ── POST /api/auth/login ───────────────────────────────────────────────────
app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body
  if (!email || !password) return res.status(400).json({ ok: false, error: '邮箱和密码不能为空' })
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email.toLowerCase().trim())
  if (!user) return res.status(401).json({ ok: false, error: '邮箱或密码错误' })
  const ok = await bcrypt.compare(password, user.password_hash)
  if (!ok) return res.status(401).json({ ok: false, error: '邮箱或密码错误' })
  const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: '30d' })
  res.json({ ok: true, token, user: { id: user.id, email: user.email } })
})

// ── GET /api/auth/me ───────────────────────────────────────────────────────
app.get('/api/auth/me', authMiddleware, (req, res) => {
  res.json({ ok: true, user: { id: req.user.id, email: req.user.email } })
})

// ── GET /api/portfolio ─────────────────────────────────────────────────────
app.get('/api/portfolio', authMiddleware, (req, res) => {
  const row   = db.prepare('SELECT funds_json FROM portfolios WHERE user_id = ?').get(req.user.id)
  const funds = row ? JSON.parse(row.funds_json) : []
  res.json({ ok: true, funds })
})

// ── PUT /api/portfolio ─────────────────────────────────────────────────────
app.put('/api/portfolio', authMiddleware, (req, res) => {
  const { funds } = req.body
  if (!Array.isArray(funds)) return res.status(400).json({ ok: false, error: '无效数据' })
  db.prepare(`
    INSERT INTO portfolios (user_id, funds_json, updated_at)
    VALUES (?, ?, unixepoch())
    ON CONFLICT(user_id) DO UPDATE
      SET funds_json = excluded.funds_json,
          updated_at = excluded.updated_at
  `).run(req.user.id, JSON.stringify(funds))
  res.json({ ok: true })
})

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

// ── POST /api/chat ─────────────────────────────────────────────────────────
// body: { messages: [{role, content}], context: { funds, market, decisions } }
app.post('/api/chat', async (req, res) => {
  const { messages, context } = req.body

  // Build system prompt from portfolio context
  const systemPrompt = buildSystemPrompt(context)

  // Stream back the response
  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')

  try {
    const stream = anthropic.messages.stream({
      model:      'claude-sonnet-4-6',
      max_tokens: 1024,
      system:     systemPrompt,
      messages,
    })

    for await (const event of stream) {
      if (event.type === 'content_block_delta' && event.delta?.type === 'text_delta') {
        res.write(`data: ${JSON.stringify({ text: event.delta.text })}\n\n`)
      }
    }
    res.write('data: [DONE]\n\n')
    res.end()
  } catch (err) {
    console.error(err)
    res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`)
    res.end()
  }
})

// ── POST /api/analyze ──────────────────────────────────────────────────────
// One-shot: analyze a single fund and return structured decision
app.post('/api/analyze', async (req, res) => {
  const { fund, market } = req.body

  const prompt = `你是一个基金投资顾问助手。基于以下信息给出结构化分析。

市场状态：${market.status}（${market.statusCode}），风格：${market.style}
热门板块：${market.hotSectors?.join('、')}
风险板块：${market.riskSectors?.join('、')}

基金信息：
- 名称：${fund.name}（${fund.code}）
- 板块：${fund.sector}
- 持有金额：${fund.amount}元
- 收益率：${fund.return}%
- 收益额：${fund.returnAbs}元

请用JSON格式输出（不要有其他内容）：
{
  "pool": "hold|t|reduce|risk",
  "label": "持有|做T|减仓|风险",
  "subLabel": "趋势强|波动大|回撤扩大|板块承压|涨幅过快|",
  "suggestion": "一句话建议",
  "reason": "分析原因（1-2句）",
  "riskNote": "风险提示（1句）"
}`

  try {
    const msg = await anthropic.messages.create({
      model:      'claude-sonnet-4-6',
      max_tokens: 512,
      messages:   [{ role: 'user', content: prompt }],
    })
    const raw = msg.content[0].text.trim()
    // Extract JSON from the response
    const jsonMatch = raw.match(/\{[\s\S]*\}/)
    const json = jsonMatch ? JSON.parse(jsonMatch[0]) : {}
    res.json({ ok: true, decision: json })
  } catch (err) {
    console.error(err)
    res.status(500).json({ ok: false, error: err.message })
  }
})

// ── POST /api/ocr-image ────────────────────────────────────────────────────
// body: { base64: string, mediaType: string }
app.post('/api/ocr-image', async (req, res) => {
  const { base64, mediaType } = req.body
  if (!base64) return res.status(400).json({ ok: false, error: '缺少图片数据' })

  const prompt = `请分析这张基金持仓截图，提取所有基金持仓信息。
对于每只基金，请提取：
- 基金名称（name，中文）
- 基金代码（code，6位数字，没有则留空字符串）
- 持有金额（amount，人民币元，纯数字）
- 收益率（returnPct，百分比数字，如 5.23 或 -3.12，不含%号）
- 收益额（returnAbs，人民币元，纯数字，亏损用负数）
- 板块分类（sector，从以下选择：科技/新能源/消费/医疗/金融/其他）

请以JSON数组格式输出，不要有其他任何内容：
[{"name":"...","code":"...","amount":0,"returnPct":0,"returnAbs":0,"sector":"其他"}]

注意：
- 如果某字段无法识别，数字用null，字符串用空字符串
- amount必须是正数
- 每只基金只输出一条记录，不要重复`

  try {
    const msg = await anthropic.messages.create({
      model:      'claude-sonnet-4-6',
      max_tokens: 2048,
      messages:   [{
        role:    'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: mediaType || 'image/jpeg', data: base64 } },
          { type: 'text',  text: prompt },
        ],
      }],
    })

    const raw       = msg.content[0].text.trim()
    const jsonMatch = raw.match(/\[[\s\S]*\]/)
    const funds     = jsonMatch ? JSON.parse(jsonMatch[0]) : []
    res.json({ ok: true, funds })
  } catch (err) {
    console.error('[ocr-image]', err.message)
    res.status(500).json({ ok: false, error: err.message })
  }
})

// ── POST /api/fund-nav ─────────────────────────────────────────────────────
// Fetch settled NAV from East Money for each fund (by code or name search)
// body: { funds: [{code, name, _id}] }
// returns: { ok, navs: { code → {navDate, nav, dailyChangePct, resolvedCode, name} } }
const fundNavCache = new Map()  // code → { data, at }
const FUND_NAV_TTL = 60 * 60 * 1000  // 60 min (NAV updates once/day ~20:00)
const emFundHeaders = { Referer: 'https://fund.eastmoney.com/', 'User-Agent': 'Mozilla/5.0' }

// Detect class suffix (A/B/C) from fund name
function getClassSuffix(name) {
  const m = name.replace(/\s/g, '').match(/([ABC])$/)
  return m ? m[1] : null
}

// Build search keywords: full name, without suffix, core (strip type words), short brand+product
function buildKeywords(name) {
  const stripped = name.replace(/[（）()QDII\s]/g, '').replace(/[ABC]$/, '')
  const core = stripped.replace(/ETF联接|ETF发起联接|发起联接|联接|混合|发起/g, '')
  // Also try just the brand + product without type words
  const short = core.slice(0, Math.min(core.length, 8))
  return [...new Set([name, stripped, core, short].filter(k => k.length >= 2))]
}

// Score match quality between candidate name and query name
function nameScore(candidate, query, classSuffix) {
  const c = candidate.replace(/[（）()\s]/g, '')
  const q = query.replace(/[（）()\s]/g, '')
  let score = 0
  if (classSuffix) {
    score += c.endsWith(classSuffix) ? 10 : -8
  }
  // Count subsequence common chars
  let qi = 0
  for (let ci = 0; ci < c.length && qi < q.length; ci++) {
    if (c[ci] === q[qi]) qi++
  }
  score += qi
  return score
}

async function resolveCodeByName(name) {
  const classSuffix = getClassSuffix(name)
  const keywords    = buildKeywords(name)
  let bestCode  = null
  let bestScore = -Infinity

  for (const kw of keywords) {
    try {
      const url = `https://fundsuggest.eastmoney.com/FundSearch/api/FundSearchAPI.ashx?callback=&m=1&key=${encodeURIComponent(kw)}`
      const r = await fetch(url, { headers: emFundHeaders })
      const j = await r.json()
      for (const c of (j?.Datas || []).slice(0, 10)) {
        if (!c.CODE || !/^\d{6}$/.test(c.CODE)) continue
        const score = nameScore(c.NAME || '', name, classSuffix)
        if (score > bestScore) { bestScore = score; bestCode = c.CODE }
      }
      if (bestScore >= 15) break  // confident match, stop searching
    } catch {}
  }
  console.log(`[fund-nav] name search "${name}" → ${bestCode} (score ${bestScore})`)
  return bestCode
}

async function fetchSettledNav(code) {
  const url = `https://api.fund.eastmoney.com/f10/lsjz?fundCode=${code}&pageIndex=1&pageSize=2&callback=`
  const r = await fetch(url, { headers: emFundHeaders })
  const text = await r.text()
  const m = text.match(/\(([\s\S]*)\)/)
  const j = m ? JSON.parse(m[1]) : JSON.parse(text)
  const rec = j?.Data?.LSJZList?.[0]
  if (!rec) return null
  return {
    navDate:        rec.FSRQ,
    nav:            parseFloat(rec.DWJZ) || 0,
    dailyChangePct: parseFloat(rec.JZZZL) || 0,
  }
}

app.post('/api/fund-nav', async (req, res) => {
  const funds = req.body?.funds || []
  console.log(`[fund-nav] ${funds.length} funds requested`)
  if (!funds.length) return res.json({ ok: true, navs: {} })

  const now  = Date.now()
  const navs = {}

  await Promise.all(funds.map(async f => {
    let code = /^\d{6}$/.test(f.code || '') ? f.code : null
    let resolvedCode = null

    // Try cache first (keyed by code if known, else by name)
    const cacheKey = code || ('name:' + f.name)
    const cached = fundNavCache.get(cacheKey)
    if (cached && now - cached.at < FUND_NAV_TTL) {
      navs[f._id] = cached.data
      return
    }

    try {
      // If no valid code, search by name
      if (!code && f.name) {
        code = await resolveCodeByName(f.name)
        if (code) resolvedCode = code
      }
      if (!code) return

      const nav = await fetchSettledNav(code)
      if (!nav) return

      const data = { ...nav, resolvedCode, code }
      fundNavCache.set(cacheKey, { data, at: now })
      if (resolvedCode) fundNavCache.set(resolvedCode, { data, at: now })
      navs[f._id] = data
    } catch (e) {
      console.error(`[fund-nav] ${f.name || code}:`, e.message)
    }
  }))

  console.log(`[fund-nav] resolved ${Object.keys(navs).length}/${funds.length} funds`)
  res.json({ ok: true, navs })
})

// ── GET /api/market ────────────────────────────────────────────────────────
// Crawl East Money for live market data; cache 60 seconds (real-time)
let marketCache = null
let marketCacheAt = 0
const MARKET_TTL = 60 * 1000  // 60 s

const SECTOR_MAP = {
  '食品饮料': '消费', '白酒': '消费', '零售': '消费', '商贸零售': '消费',
  '医药': '医疗', '医疗': '医疗', '生物制药': '医疗', '医疗器械': '医疗',
  '新能源': '新能源', '光伏': '新能源', '储能': '新能源', '风电': '新能源',
  '半导体': '科技', '芯片': '科技', '软件': '科技', '人工智能': '科技', '计算机': '科技',
  '银行': '金融', '保险': '金融', '证券': '金融', '非银金融': '金融',
}
const mapSector = name => {
  for (const [key, val] of Object.entries(SECTOR_MAP)) {
    if (name.includes(key)) return val
  }
  return null
}

app.get('/api/market', async (_req, res) => {
  if (marketCache && Date.now() - marketCacheAt < MARKET_TTL) {
    return res.json({ ok: true, market: marketCache })
  }

  const emHeaders = { Referer: 'https://www.eastmoney.com/', 'User-Agent': 'Mozilla/5.0' }

  try {
    // ── 4 major indices in one batch call ──────────────────────────────────
    // secids: 上证000001, 沪深300=000300, 深证成指=399001, 创业板=399006
    const batchUrl = 'https://push2.eastmoney.com/api/qt/ulist.np/get' +
      '?secids=1.000001,1.000300,0.399001,0.399006' +
      '&ut=bd1d9ddb04089700cf9c27f6f7426281' +
      '&fields=f2,f3,f4,f12,f14&cb='
    const batchRes  = await fetch(batchUrl, { headers: emHeaders })
    const batchJson = await batchRes.json()
    const rawList   = batchJson.data?.diff || []

    const INDEX_META = {
      '000001': { label: '上证指数', short: '上证' },
      '000300': { label: '沪深300',  short: 'HS300' },
      '399001': { label: '深证成指', short: '深证' },
      '399006': { label: '创业板指', short: '创业板' },
    }
    const indices = rawList.map(d => {
      const code      = String(d.f12 || '')
      const meta      = INDEX_META[code] || { label: d.f14, short: d.f14 }
      const price     = (d.f2 || 0) / 100
      const changePct = (d.f3 || 0) / 100
      const changeAmt = (d.f4 || 0) / 100
      return { code, label: meta.label, short: meta.short, price, changePct, changeAmt }
    })

    // Use 上证 as primary signal
    const sh        = indices.find(i => i.code === '000001') || {}
    const changePct = sh.changePct || 0

    let statusCode, status
    if (changePct >= 0.5)       { statusCode = 'strong'; status = '偏强' }
    else if (changePct <= -0.5) { statusCode = 'weak';   status = '偏弱' }
    else                        { statusCode = 'mid';    status = '震荡' }

    const sentiment = Math.min(80, Math.max(20, Math.round(50 + changePct * 15)))

    // ── Sector indices ──────────────────────────────────────────────────────
    const secUrl = 'https://push2.eastmoney.com/api/qt/clist/get' +
      '?pn=1&pz=50&po=1&np=1&ut=bd1d9ddb04089700cf9c27f6f7426281' +
      '&fltt=2&invt=2&fid=f3&fs=m:90+t:2&fields=f2,f3,f4,f12,f14&cb='
    const secRes  = await fetch(secUrl, { headers: emHeaders })
    const secJson = await secRes.json()
    const secs    = (secJson.data?.diff || [])
      .map(s => ({ name: s.f14, chg: (s.f3 || 0) / 100 }))
      .filter(s => s.name)
      .sort((a, b) => b.chg - a.chg)

    const unique = arr => [...new Set(arr)]
    const hotRaw  = secs.slice(0, 8)
    const riskRaw = secs.slice(-8).reverse()
    const hotSectors  = unique(hotRaw.map(s => mapSector(s.name)).filter(Boolean)).slice(0, 3)
    const riskSectors = unique(riskRaw.map(s => mapSector(s.name)).filter(Boolean)).slice(0, 3)
    const style       = hotSectors.includes('科技') || hotSectors.includes('新能源') ? '成长' : '价值'

    // sectorChanges: map our sector labels → avg change pct today
    const sectorAcc = {}
    const sectorCnt = {}
    for (const s of secs) {
      const label = mapSector(s.name)
      if (!label) continue
      sectorAcc[label] = (sectorAcc[label] || 0) + s.chg
      sectorCnt[label] = (sectorCnt[label] || 0) + 1
    }
    const sectorChanges = {}
    for (const [k, v] of Object.entries(sectorAcc)) {
      sectorChanges[k] = parseFloat((v / sectorCnt[k]).toFixed(3))
    }

    // Detect trading day: on weekends/closed, data is from last Friday
    const nowD = new Date()
    const wday = nowD.getDay()
    const offset = wday === 0 ? 2 : wday === 6 ? 1 : 0
    const tradingDay = new Date(nowD)
    tradingDay.setDate(tradingDay.getDate() - offset)
    const tradingDate = tradingDay.toISOString().slice(0, 10)  // 'YYYY-MM-DD'
    const isMarketClosed = offset > 0  // weekend

    marketCache   = {
      status, statusCode, style, hotSectors, riskSectors, sentiment,
      indices,           // [{code, label, short, price, changePct, changeAmt}]
      sectorChanges,     // {科技: 1.2, 新能源: -0.5, ...}
      tradingDate,       // last trading day date string
      isMarketClosed,    // true on weekends
      updatedAt: Date.now(),
    }
    marketCacheAt = Date.now()
    res.json({ ok: true, market: marketCache })
  } catch (err) {
    console.error('[market]', err.message)
    res.json({
      ok: true,
      market: {
        status: '震荡', statusCode: 'mid', style: '成长',
        hotSectors: ['科技', '新能源'], riskSectors: ['消费'],
        sentiment: 50, indices: [], sectorChanges: {}, _fallback: true,
      }
    })
  }
})

// ── GET /api/news ──────────────────────────────────────────────────────────
// Crawl East Money 快讯; cache keyed by sector combination (10 min)
const newsCacheMap = new Map()  // key → { news, at }
const NEWS_TTL  = 5 * 60 * 1000   // 5 min — 财联社实时快讯更新频繁

function formatNewsTime(ts) {
  if (!ts) return ''
  const d = new Date(typeof ts === 'number' && ts < 1e12 ? ts * 1000 : ts)
  if (isNaN(d)) return String(ts)
  return d.toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
}

async function fetchRawNews() {
  const headers = {
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    Accept:       'application/json, text/plain, */*',
  }

  // ── Source 1: 财联社电报（CLS）实时快讯 ────────────────────────────────
  try {
    const now = Math.floor(Date.now() / 1000)
    const url = `https://www.cls.cn/nodeapi/updateTelegraphList?app=CLS&os=web&sv=7.7.5&rn=25&last_time=0&_=${now}`
    const r   = await fetch(url, { headers: { ...headers, Referer: 'https://www.cls.cn/telegraph' } })
    const j   = await r.json()
    const raw = j?.data?.roll_data || []
    const news = raw.slice(0, 25).map(item => ({
      id:      String(item.id || Math.random()),
      title:   (item.title || item.brief || '').trim(),
      summary: (item.content || item.brief || '').trim(),
      time:    formatNewsTime(item.ctime),
      url:     item.share_url || `https://www.cls.cn/detail/${item.id}`,
    })).filter(n => n.title)
    if (news.length >= 5) {
      console.log(`[news] CLS: ${news.length} items, latest: ${news[0]?.time}`)
      return news
    }
  } catch (e) {
    console.error('[news-cls]', e.message)
  }

  // ── Source 2: 东方财富实时快讯（新接口）────────────────────────────────
  try {
    const url = 'https://np-anotice-stock.eastmoney.com/api/security/ann' +
      '?sr=-1&page_size=25&page_index=1&ann_type=SHA%2CSZMB%2CBJA&client_source=web&f_node=0&s_node=0'
    const r   = await fetch(url, { headers: { ...headers, Referer: 'https://www.eastmoney.com/' } })
    const j   = await r.json()
    const raw = j?.data?.list || []
    const news = raw.slice(0, 25).map(item => ({
      id:      String(item.art_code || Math.random()),
      title:   (item.title || '').trim(),
      summary: (item.notice_type_name ? `[${item.notice_type_name}] ` : '') + (item.title || ''),
      time:    formatNewsTime(item.notice_date),
      url:     `https://data.eastmoney.com/notices/detail/${item.art_code}.html`,
    })).filter(n => n.title)
    if (news.length >= 5) {
      console.log(`[news] EastMoney ann: ${news.length} items`)
      return news
    }
  } catch (e) {
    console.error('[news-eastmoney-ann]', e.message)
  }

  // ── Source 3: 新浪财经滚动新闻（兜底）─────────────────────────────────
  try {
    const ts    = Date.now()
    const sinaUrl = `https://feed.mix.sina.com.cn/api/roll/get?pageid=153&lid=2514&k=&num=25&page=1&r=${ts}`
    const sr    = await fetch(sinaUrl, { headers: { ...headers, Referer: 'https://finance.sina.com.cn/' } })
    const sj    = await sr.json()
    const news  = (sj.result?.data || []).slice(0, 25).map(item => ({
      id:      String(item.id || Math.random()),
      title:   (item.title || '').trim(),
      summary: (item.intro || item.summary || '').trim(),
      time:    formatNewsTime(item.ctime),
      url:     item.url || '',
    })).filter(n => n.title)
    if (news.length >= 5) {
      console.log(`[news] Sina fallback: ${news.length} items`)
      return news
    }
  } catch (e) {
    console.error('[news-sina]', e.message)
  }

  return []
}

async function curateNews(rawNews, sectors) {
  if (!sectors || sectors.length === 0) return rawNews.slice(0, 12)

  // Step 1: score each news item for strong relevance using title + summary
  const SECTOR_KEYWORDS = {
    '科技':  ['半导体', '芯片', '人工智能', 'AI', '算力', '大模型', '软件', '互联网', '科技', '数字经济', '云计算', '信创'],
    '新能源': ['新能源', '光伏', '风电', '储能', '电池', '充电', '碳中和', '双碳', '绿电', '氢能'],
    '消费':  ['消费', '白酒', '食品', '饮料', '零售', '餐饮', '旅游', '酒店', '免税', '社零'],
    '医疗':  ['医药', '医疗', '生物', '制药', '器械', 'CXO', '创新药', '仿制药', '医保'],
    '金融':  ['银行', '保险', '证券', '基金', '利率', '信贷', '金融', '券商', '股市', '资本市场'],
    '其他':  [],
  }
  const userKeywords = [...new Set(
    sectors.flatMap(s => SECTOR_KEYWORDS[s] || [s])
  )]

  // Quick pre-filter: mark keyword-matched candidates (fast, no AI cost)
  const withHint = rawNews.map(n => {
    const text = (n.title + ' ' + n.summary).toLowerCase()
    const hit  = userKeywords.some(kw => text.includes(kw.toLowerCase()))
    return { ...n, _keywordHit: hit }
  })

  // Step 2: send title + summary excerpt to Claude for strict relevance check
  const listText = withHint.map((n, i) =>
    `[${i + 1}] 标题：${n.title}\n    摘要：${(n.summary || '').slice(0, 80)}`
  ).join('\n')

  const prompt = `用户持有以下行业的基金：${sectors.join('、')}。

判断标准（持仓相关 = relevant: true）：
- 新闻内容必须与"${sectors.join('或')}"行业有直接、明确的关联
- 仅提及"股市整体""大盘""宏观政策"等不算强相关
- 必须涉及该行业的公司、产品、政策、数据或行业趋势

以下是${withHint.length}条资讯（标题+摘要）：
${listText}

请完成两件事：
1. 逐条判断是否与用户持仓行业强相关（relevant）
2. 从全部结果中最终选出12条（约7条relevant=true，约5条relevant=false），优先选重要性高的

仅输出JSON数组，格式（必须是12条）：
[{"index": 序号, "relevant": true或false}]

不要输出其他任何内容。`

  const msg = await anthropic.messages.create({
    model:      'claude-sonnet-4-6',
    max_tokens: 400,
    messages:   [{ role: 'user', content: prompt }],
  })
  const raw       = msg.content[0].text.trim()
  const jsonMatch = raw.match(/\[[\s\S]*\]/)
  const selected  = jsonMatch ? JSON.parse(jsonMatch[0]) : []

  const result = selected
    .filter(s => s.index >= 1 && s.index <= withHint.length)
    .map(s => ({ ...withHint[s.index - 1], relevant: s.relevant, _keywordHit: undefined }))

  // Fallback: if Claude returns fewer than expected, pad with remaining items
  if (result.length < 8) return withHint.slice(0, 12).map(n => ({ ...n, relevant: n._keywordHit, _keywordHit: undefined }))
  return result
}

app.get('/api/news', async (req, res) => {
  const sectorsParam = req.query.sectors || ''
  const sectors      = sectorsParam ? sectorsParam.split(',').map(s => s.trim()).filter(Boolean) : []
  const cacheKey     = sectors.sort().join(',')

  const cached = newsCacheMap.get(cacheKey)
  if (cached && Date.now() - cached.at < NEWS_TTL) {
    return res.json({ ok: true, news: cached.news })
  }

  try {
    const rawNews = await fetchRawNews()
    const news    = await curateNews(rawNews, sectors)
    newsCacheMap.set(cacheKey, { news, at: Date.now() })
    res.json({ ok: true, news })
  } catch (err) {
    console.error('[news]', err.message)
    res.json({ ok: true, news: [], _error: err.message })
  }
})

// ── POST /api/news/analyze ─────────────────────────────────────────────────
// body: { title, summary, sectors }  →  { ok, analysis }
app.post('/api/news/analyze', async (req, res) => {
  const { title, summary, sectors } = req.body
  if (!title) return res.status(400).json({ ok: false, error: '缺少标题' })

  const sectorHint = sectors && sectors.length
    ? `用户当前持仓行业：${sectors.join('、')}。请重点分析该资讯对这些行业基金的具体影响。\n\n`
    : ''

  const prompt = `作为专业基金投资顾问，请对以下市场资讯进行简短分析：

${sectorHint}【资讯标题】${title}
【资讯内容】${summary || '（仅有标题）'}

请用2-4句话输出：
1. 该资讯的核心要点
2. 对基金/股市的可能影响方向${sectors?.length ? `（尤其是${sectors.join('、')}板块）` : ''}
3. 给持仓投资者的简短建议

直接输出分析内容，不加前缀标题。语言简洁专业。`

  try {
    const msg = await anthropic.messages.create({
      model:      'claude-sonnet-4-6',
      max_tokens: 350,
      messages:   [{ role: 'user', content: prompt }],
    })
    res.json({ ok: true, analysis: msg.content[0].text.trim() })
  } catch (err) {
    console.error('[news-analyze]', err.message)
    res.status(500).json({ ok: false, error: err.message })
  }
})

// ─────────────────────────────────────────────────────────────────────────────
function buildSystemPrompt(ctx) {
  if (!ctx) return '你是一个基金投资顾问助手。'

  const fundSummary = (ctx.funds || []).map(f =>
    `  • ${f.name}（${f.code || '—'}）${f.sector} 持有¥${f.amount} 收益率${f.return}% 状态:${f.label}`
  ).join('\n')

  const decisionSummary = (ctx.decisions || []).map(d =>
    `  • ${d.name}：${d.label} — ${d.suggestion}`
  ).join('\n')

  return `你是一个专业的基金持仓分析助手，风格稳健，不承诺收益，不绝对化建议。

【当前市场状态】
大盘：${ctx.market?.status || '未知'}，风格：${ctx.market?.style || '未知'}
热门板块：${ctx.market?.hotSectors?.join('、') || '—'}
风险板块：${ctx.market?.riskSectors?.join('、') || '—'}
市场情绪：${ctx.market?.sentiment || '—'}/100

【当前持仓】
${fundSummary || '暂无持仓数据'}

【决策引擎建议】
${decisionSummary || '暂无'}

【回答要求】
1. 先给出明确结论
2. 说明原因（基于持仓数据）
3. 给出风险提示
4. 语言简洁，100-200字以内
5. 不承诺收益，不做绝对化判断
6. 严禁使用任何 Markdown 格式：不用 **加粗**、不用 # 标题、不用 - 或 * 列表符号、不用 \`代码块\`。直接用自然语言分段回答，段落之间用换行分隔即可。`
}

// ── Serve Vite build in production ────────────────────────────────────────
import { fileURLToPath } from 'url'
import { dirname, join }  from 'path'
const __dirname = dirname(fileURLToPath(import.meta.url))
const distPath  = join(__dirname, 'dist')
import { existsSync } from 'fs'
if (existsSync(distPath)) {
  const { default: serveStatic } = await import('serve-static')
  app.use(serveStatic(distPath))
  app.get('*', (_req, res) => res.sendFile(join(distPath, 'index.html')))
}

app.listen(port, () => console.log(`[server] http://localhost:${port}`))

process.stdin.resume()
