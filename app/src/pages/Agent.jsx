import { useState, useRef, useEffect, useMemo } from 'react'
import { usePortfolio } from '../context/PortfolioContext'
import { useLang } from '../context/LangContext'
import { runDecisionEngine } from '../engine/decisionEngine'

function normaliseFund(f) {
  return { ...f, return: parseFloat(f.returnPct) || 0, returnAbs: parseFloat(f.returnAbs) || 0, amount: parseFloat(f.amount) || 0 }
}

// Strip residual markdown symbols from AI response
function stripMarkdown(text) {
  return text
    .replace(/#{1,6}\s+/g, '')
    .replace(/\*{1,3}([^*]+)\*{1,3}/g, '$1')
    .replace(/`{1,3}[^`]*`{1,3}/g, (m) => m.replace(/`/g, '').trim())
    .replace(/^\s*[-*+]\s+/gm, '')
    .replace(/^\s*\d+\.\s+/gm, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

export default function Agent() {
  const { t } = useLang()
  const { funds: rawFunds, market: liveMarket } = usePortfolio()

  const funds  = useMemo(() => rawFunds.map(normaliseFund), [rawFunds])
  const market = liveMarket || { status: '未知', statusCode: 'mid', style: '—', hotSectors: [], riskSectors: [], sentiment: 50 }
  const decisions = useMemo(() => runDecisionEngine(funds, market), [funds, market])

  const agentContext = useMemo(() => ({
    funds,
    market,
    decisions: decisions.map(d => ({ name: d.name, label: d.label, suggestion: d.suggestion })),
  }), [funds, market, decisions])

  const [messages, setMessages] = useState([
    { role: 'assistant', content: t('agentGreeting') },
  ])
  const [input,     setInput]     = useState('')
  const [streaming, setStreaming] = useState(false)
  const [error,     setError]     = useState(null)
  const [noKey,     setNoKey]     = useState(false)
  const bottomRef = useRef(null)
  const inputRef  = useRef(null)
  const abortRef  = useRef(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function send(text) {
    const userText = (text || input).trim()
    if (!userText || streaming) return

    setInput('')
    setError(null)
    setNoKey(false)

    const userMsg = { role: 'user', content: userText }
    const newMsgs = [...messages, userMsg]
    setMessages(newMsgs)
    setStreaming(true)
    setMessages(prev => [...prev, { role: 'assistant', content: '', _streaming: true }])

    const apiMessages = newMsgs.slice(-10).map(m => ({ role: m.role, content: m.content }))

    try {
      const controller = new AbortController()
      abortRef.current = controller

      const res = await fetch('/api/chat', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ messages: apiMessages, context: agentContext }),
        signal:  controller.signal,
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        if (res.status === 401 || (err.error || '').includes('API key')) setNoKey(true)
        throw new Error(err.error || `HTTP ${res.status}`)
      }

      const reader  = res.body.getReader()
      const decoder = new TextDecoder()
      let   full    = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        const lines = decoder.decode(value).split('\n').filter(l => l.startsWith('data:'))
        for (const line of lines) {
          const data = line.slice(5).trim()
          if (data === '[DONE]') break
          try {
            const { text, error: sErr } = JSON.parse(data)
            if (sErr) throw new Error(sErr)
            if (text) {
              full += text
              setMessages(prev => {
                const updated = [...prev]
                updated[updated.length - 1] = { role: 'assistant', content: full, _streaming: true }
                return updated
              })
            }
          } catch { /* ignore parse errors */ }
        }
      }

      setMessages(prev => {
        const updated = [...prev]
        updated[updated.length - 1] = { role: 'assistant', content: stripMarkdown(full) }
        return updated
      })
    } catch (e) {
      if (e.name === 'AbortError') {
        setMessages(prev => {
          const updated = [...prev]
          updated[updated.length - 1] = { ...updated[updated.length - 1], _streaming: false }
          return updated
        })
      } else {
        setError(e.message)
        setMessages(prev => prev.filter(m => !m._streaming))
      }
    } finally {
      setStreaming(false)
    }
  }

  function stop() { abortRef.current?.abort() }

  function handleKey(e) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 52px)', maxWidth: 720, margin: '0 auto' }}>
      {/* Context bar */}
      <div style={{
        padding: '8px 16px', borderBottom: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', flexShrink: 0,
        background: 'var(--surface)',
      }}>
        <span style={{ fontSize: 11, color: 'var(--text3)', fontFamily: 'var(--font-ui)' }}>{t('agentContext')}</span>
        <span className="num" style={{ fontSize: 11, color: 'var(--text2)' }}>{funds.length} {t('agentFunds')}</span>
        <span style={{ width: 3, height: 3, borderRadius: '50%', background: 'var(--border2)', display: 'inline-block' }} />
        <span style={{ fontSize: 11, color: 'var(--text2)', fontFamily: 'var(--font-ui)' }}>{t('agentMarket')}{market.status}</span>
        <span style={{ width: 3, height: 3, borderRadius: '50%', background: 'var(--border2)', display: 'inline-block' }} />
        <span style={{ fontSize: 11, color: 'var(--text2)', fontFamily: 'var(--font-ui)' }}>
          {decisions.filter(d => d.pool === 'risk').length} {t('agentRisk')} · {decisions.filter(d => d.pool === 'reduce').length} {t('agentReduce')}
        </span>
        <span style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--down)', display: 'inline-block', animation: 'pulse 2s ease infinite' }} />
          <span className="num" style={{ fontSize: 11, color: 'var(--text3)' }}>claude-sonnet-4-6</span>
        </span>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: 16 }}>
        {noKey && (
          <div style={{ padding: '14px 16px', borderRadius: 'var(--radius-sm)', background: 'rgba(201,168,76,0.07)', border: '1px solid rgba(201,168,76,0.2)', fontSize: 13, color: 'var(--gold)' }}>
            <p style={{ fontWeight: 500, marginBottom: 4 }}>{t('noApiKey')}</p>
            <p style={{ fontSize: 11, color: 'var(--gold-dim)' }}>{t('noApiKeyDesc')}</p>
          </div>
        )}

        {messages.map((msg, i) => <MessageBubble key={i} msg={msg} t={t} />)}

        {error && (
          <div style={{ padding: '10px 14px', borderRadius: 'var(--radius-sm)', background: 'rgba(224,92,92,0.07)', border: '1px solid rgba(224,92,92,0.18)', fontSize: 12, color: 'var(--up)' }}>
            {t('errorPrefix')}{error}
          </div>
        )}

        {messages.length === 1 && (
          <div>
            <p style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 8, fontFamily: 'var(--font-ui)' }}>{t('quickQLabel')}</p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {t('quickQuestions').map(q => (
                <button key={q} onClick={() => send(q)} style={{
                  fontSize: 12, padding: '6px 14px', borderRadius: 999,
                  border: '1px solid var(--border2)', color: 'var(--text2)',
                  background: 'none', cursor: 'pointer', fontFamily: 'var(--font-ui)',
                  transition: 'border-color 0.15s, color 0.15s',
                }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--gold-dim)'; e.currentTarget.style.color = 'var(--gold)' }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border2)'; e.currentTarget.style.color = 'var(--text2)' }}
                >{q}</button>
              ))}
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div style={{ padding: '12px 16px', borderTop: '1px solid var(--border)', flexShrink: 0, background: 'var(--surface)' }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
          <textarea
            ref={inputRef}
            rows={1}
            style={{
              flex: 1, background: 'var(--surface2)', border: '1px solid var(--border)',
              borderRadius: 'var(--radius-sm)', padding: '10px 14px',
              fontSize: 13, color: 'var(--text1)', resize: 'none', outline: 'none',
              fontFamily: 'var(--font-ui)', transition: 'border-color 0.2s',
            }}
            placeholder={t('agentPlaceholder')}
            value={input}
            onChange={e => {
              setInput(e.target.value)
              e.target.style.height = 'auto'
              e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px'
            }}
            onKeyDown={handleKey}
            onFocus={e => e.currentTarget.style.borderColor = 'var(--gold)'}
            onBlur={e => e.currentTarget.style.borderColor = 'var(--border)'}
          />
          {streaming
            ? <button onClick={stop} style={{
                padding: '10px 14px', borderRadius: 'var(--radius-sm)',
                background: 'rgba(224,92,92,0.12)', border: '1px solid rgba(224,92,92,0.3)',
                color: 'var(--up)', fontSize: 13, cursor: 'pointer', fontFamily: 'var(--font-ui)',
                transition: 'background 0.15s',
              }}>{t('agentStop')}</button>
            : <button onClick={() => send()} disabled={!input.trim()} className="btn-primary" style={{ padding: '10px 16px' }}>{t('agentSend')}</button>
          }
        </div>
        <p style={{ fontSize: 10, color: 'var(--text3)', marginTop: 6, textAlign: 'center', fontFamily: 'var(--font-ui)' }}>{t('agentDisclaimer')}</p>
      </div>
    </div>
  )
}

function MessageBubble({ msg, t }) {
  const isUser = msg.role === 'user'
  return (
    <div style={{ display: 'flex', gap: 10, flexDirection: isUser ? 'row-reverse' : 'row' }}>
      <div style={{
        width: 28, height: 28, borderRadius: '50%', flexShrink: 0, marginTop: 2,
        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 600,
        background: isUser ? 'var(--gold)' : 'var(--surface2)',
        color: isUser ? '#07090f' : 'var(--text2)',
        border: isUser ? 'none' : '1px solid var(--border)',
        fontFamily: 'var(--font-ui)',
      }}>
        {isUser ? t('me') : '🤖'}
      </div>
      <div style={{
        maxWidth: '80%', padding: '10px 14px', fontSize: 13, lineHeight: 1.65,
        whiteSpace: 'pre-wrap',
        ...(isUser ? {
          background: 'var(--gold)',
          color: '#07090f',
          borderRadius: '10px 2px 10px 10px',
          fontFamily: 'var(--font-ui)',
          fontWeight: 500,
        } : {
          background: 'var(--surface2)',
          border: '1px solid var(--border)',
          borderLeft: '2px solid var(--teal)',
          color: 'var(--text1)',
          borderRadius: '2px 10px 10px 10px',
          fontFamily: 'var(--font-ui)',
        }),
      }}>
        {msg.content || (msg._streaming && <BlinkCursor />)}
        {msg._streaming && msg.content && <BlinkCursor />}
      </div>
    </div>
  )
}

function BlinkCursor() {
  return <span style={{ display: 'inline-block', width: 2, height: 14, background: 'var(--gold)', marginLeft: 2, verticalAlign: 'middle', animation: 'blink 1s step-end infinite' }} />
}
