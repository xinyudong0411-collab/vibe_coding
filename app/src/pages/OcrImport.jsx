import { useState, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { usePortfolio } from '../context/PortfolioContext'
import { fmt, cls, pct } from '../utils/fmt'

const STEP      = { UPLOAD: 'upload', STAGING: 'staging', PROCESSING: 'processing', CONFIRM: 'confirm', DONE: 'done' }
const MAX_FILES = 10
const SECTORS   = ['科技', '新能源', '消费', '医疗', '金融', '其他']

const blankRow = () => ({
  id: Date.now() + Math.random(),
  name: '', code: '', amount: '', returnPct: '', returnAbs: '', sector: '',
})

// Compress image via canvas (max 1200px, 85% JPEG) then return base64
function compressImage(file, maxPx = 1200, quality = 0.85) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      URL.revokeObjectURL(url)
      const scale  = Math.min(1, maxPx / Math.max(img.width, img.height))
      const w      = Math.round(img.width  * scale)
      const h      = Math.round(img.height * scale)
      const canvas = document.createElement('canvas')
      canvas.width  = w
      canvas.height = h
      canvas.getContext('2d').drawImage(img, 0, 0, w, h)
      const dataUrl = canvas.toDataURL('image/jpeg', quality)
      resolve({ base64: dataUrl.split(',')[1], mediaType: 'image/jpeg' })
    }
    img.onerror = reject
    img.src     = url
  })
}

// ── Main component ────────────────────────────────────────────────────────────
export default function OcrImport() {
  const { funds: existingFunds, setFunds } = usePortfolio()
  const navigate = useNavigate()

  const [step,      setStep]      = useState(STEP.UPLOAD)
  const [tab,       setTab]       = useState('ocr')
  const [dragging,  setDragging]  = useState(false)
  const [error,     setError]     = useState(null)
  const [staged,    setStaged]    = useState([])
  const [queue,     setQueue]     = useState([])
  const [rows,      setRows]      = useState([])
  const [skipped,   setSkipped]   = useState([])
  const fileRef = useRef()

  // ── Stage files ────────────────────────────────────────────────────────────
  const stageFiles = useCallback((fileList) => {
    const valid = Array.from(fileList)
      .filter(f => f.type.startsWith('image/'))
      .slice(0, MAX_FILES)

    if (valid.length === 0) { setError('请上传图片文件（PNG/JPG）'); return }
    setError(null)

    const entries = valid.map(file => ({
      id:      Math.random(),
      name:    file.name,
      file,
      preview: URL.createObjectURL(file),
    }))
    setStaged(entries)
    setStep(STEP.STAGING)
  }, [])

  const removeStaged = (id) => {
    const remaining = staged.filter(e => e.id !== id)
    if (remaining.length === 0) { setStep(STEP.UPLOAD); setStaged([]) }
    else setStaged(remaining)
  }

  // ── Run Claude Vision OCR ─────────────────────────────────────────────────
  const startOcr = useCallback(async () => {
    setError(null)

    const entries = staged.map(s => ({ ...s, status: 'pending', progress: 0, msg: '等待中…' }))
    setQueue(entries)
    setStep(STEP.PROCESSING)

    const allRows = []

    for (let i = 0; i < entries.length; i++) {
      setQueue(q => q.map((e, idx) =>
        idx === i ? { ...e, status: 'processing', progress: 20, msg: '上传中…' } : e
      ))

      try {
        const { base64, mediaType } = await compressImage(entries[i].file)

        setQueue(q => q.map((e, idx) =>
          idx === i ? { ...e, progress: 50, msg: 'Claude AI 分析中…' } : e
        ))

        const res = await fetch('/api/ocr-image', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ base64, mediaType }),
        })

        if (!res.ok) {
          const err = await res.json().catch(() => ({}))
          throw new Error(err.error || `服务器错误 ${res.status}`)
        }

        const data   = await res.json()
        if (!data.ok) throw new Error(data.error || '识别失败')

        const parsed = (data.funds || []).map(f => ({
          id:        Date.now() + Math.random(),
          name:      f.name      || '',
          code:      f.code      || '',
          amount:    f.amount    != null ? String(f.amount)    : '',
          returnPct: f.returnPct != null ? String(f.returnPct) : '',
          returnAbs: f.returnAbs != null ? String(f.returnAbs) : '',
          sector:    f.sector    || '',
        }))

        allRows.push(...parsed)

        setQueue(q => q.map((e, idx) =>
          idx === i
            ? { ...e, status: 'done', progress: 100, msg: parsed.length > 0 ? `识别到 ${parsed.length} 条` : '未识别到基金数据' }
            : e
        ))
      } catch (err) {
        setQueue(q => q.map((e, idx) =>
          idx === i ? { ...e, status: 'error', progress: 0, msg: `失败：${err.message}` } : e
        ))
      }
    }

    // Deduplicate within OCR results
    const seen   = new Set()
    const deduped = allRows.filter(r => {
      const key = (r.name + r.code).toLowerCase()
      if (seen.has(key)) return false
      seen.add(key); return true
    })

    const normName = s => (s || '')
      .replace(/（/g, '(').replace(/）/g, ')')
      .replace(/\s+/g, '')
      .toLowerCase()

    const newRows  = []
    const skipList = []
    for (const r of deduped) {
      const alreadyExists = existingFunds.some(e =>
        (r.code && r.code === e.code) ||
        normName(r.name) === normName(e.name)
      )
      if (alreadyExists) skipList.push(r)
      else newRows.push(r)
    }

    setSkipped(skipList)
    setRows(newRows.length > 0 ? newRows : [blankRow()])
    setStep(STEP.CONFIRM)
  }, [staged])

  // ── Row editing ────────────────────────────────────────────────────────────
  const updateRow = (id, field, val) =>
    setRows(prev => prev.map(r => r.id === id ? { ...r, [field]: val } : r))
  const deleteRow = (id) => setRows(prev => prev.filter(r => r.id !== id))
  const addRow    = ()   => setRows(prev => [...prev, blankRow()])

  const reset = () => {
    setStep(STEP.UPLOAD); setQueue([]); setRows([])
    setStaged([]); setSkipped([]); setError(null); setTab('ocr')
  }

  // ── Confirm: merge with existing funds ────────────────────────────────────
  function confirmImport() {
    const normName = s => (s || '').replace(/（/g, '(').replace(/）/g, ')').replace(/\s+/g, '').toLowerCase()
    const incoming = rows.filter(r => r.name && r.amount)
    const merged   = [...existingFunds]
    for (const r of incoming) {
      const idx = merged.findIndex(e =>
        (r.code && e.code === r.code) || normName(e.name) === normName(r.name)
      )
      if (idx >= 0) merged[idx] = r
      else merged.push(r)
    }
    setFunds(merged)
    setStep(STEP.DONE)
  }

  // ── Shared input styles ───────────────────────────────────────────────────
  const inpStyle = {
    width: '100%', background: 'var(--surface2)', border: '1px solid var(--border)',
    borderRadius: 'var(--radius-sm)', padding: '8px 12px', fontSize: 13,
    fontFamily: 'var(--font-ui)', color: 'var(--text1)', outline: 'none',
    transition: 'border-color 0.2s, box-shadow 0.2s',
  }

  return (
    <div style={{ padding: '16px', maxWidth: 720, margin: '0 auto' }}>
      <h1 style={{ fontSize: 16, fontWeight: 600, color: 'var(--text1)', fontFamily: 'var(--font-ui)', marginBottom: 4 }}>导入持仓</h1>
      <p style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 20, fontFamily: 'var(--font-ui)' }}>上传截图由 Claude AI 自动识别，或手动录入</p>

      {/* ── UPLOAD ──────────────────────────────────────────────────────── */}
      {step === STEP.UPLOAD && (
        <>
          {/* Tabs */}
          <div style={{ display: 'flex', gap: 0, marginBottom: 20, borderBottom: '1px solid var(--border)' }}>
            {[
              { key: 'ocr',    label: '📷 截图识别（AI）' },
              { key: 'manual', label: '✏️ 手动录入' },
            ].map(t => (
              <button key={t.key} onClick={() => setTab(t.key)} style={{
                padding: '8px 16px', fontSize: 13, fontWeight: 500, fontFamily: 'var(--font-ui)',
                background: 'none', border: 'none', cursor: 'pointer',
                borderBottom: `2px solid ${tab === t.key ? 'var(--gold)' : 'transparent'}`,
                color: tab === t.key ? 'var(--gold)' : 'var(--text3)',
                marginBottom: -1, transition: 'color 0.15s',
              }}>{t.label}</button>
            ))}
          </div>

          {error && (
            <div style={{ marginBottom: 16, padding: '10px 14px', borderRadius: 'var(--radius-sm)', background: 'rgba(224,92,92,0.08)', border: '1px solid rgba(224,92,92,0.2)', fontSize: 13, color: 'var(--up)' }}>
              {error}
            </div>
          )}

          {tab === 'ocr' && (
            <div
              className={`drop-zone${dragging ? ' active' : ''}`}
              style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '56px 20px', cursor: 'pointer' }}
              onDragOver={e => { e.preventDefault(); setDragging(true) }}
              onDragLeave={() => setDragging(false)}
              onDrop={e => { e.preventDefault(); setDragging(false); stageFiles(e.dataTransfer.files) }}
              onClick={() => fileRef.current.click()}
            >
              <input ref={fileRef} type="file" accept="image/*" multiple style={{ display: 'none' }} onChange={e => stageFiles(e.target.files)} />
              <div style={{ fontSize: 48, marginBottom: 16 }}>📷</div>
              <p style={{ fontSize: 14, color: 'var(--text2)', fontWeight: 500, marginBottom: 6, fontFamily: 'var(--font-ui)' }}>拖拽截图到此处，或点击选择</p>
              <p style={{ fontSize: 11, color: 'var(--text3)' }}>最多 {MAX_FILES} 张图片（PNG / JPG）</p>
              <p style={{ fontSize: 11, color: 'var(--text3)', marginTop: 8 }}>由 Claude AI 识别基金名称、代码、金额、收益率</p>
            </div>
          )}

          {tab === 'manual' && (
            <ManualEntry inpStyle={inpStyle} onConfirm={r => { setRows([r]); setStep(STEP.CONFIRM) }} />
          )}
        </>
      )}

      {/* ── STAGING ──────────────────────────────────────────────────────── */}
      {step === STEP.STAGING && (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <p style={{ fontSize: 13, color: 'var(--text2)', fontFamily: 'var(--font-ui)' }}>
              已选择 <span style={{ color: 'var(--gold)', fontWeight: 500 }}>{staged.length}</span> 张图片
            </p>
            <button onClick={reset} style={{ fontSize: 12, color: 'var(--text3)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-ui)' }}>
              重新选择
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 24 }}>
            {staged.map(item => (
              <div key={item.id} style={{ position: 'relative' }}>
                <img src={item.preview} alt={item.name} style={{ width: '100%', height: 140, objectFit: 'cover', borderRadius: 8, border: '1px solid var(--border)' }} />
                <button
                  onClick={() => removeStaged(item.id)}
                  style={{
                    position: 'absolute', top: 6, right: 6, width: 22, height: 22,
                    borderRadius: '50%', background: 'rgba(0,0,0,0.7)', color: 'var(--text1)',
                    border: 'none', cursor: 'pointer', fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}
                >×</button>
                <p style={{ marginTop: 4, fontSize: 11, color: 'var(--text3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.name}</p>
              </div>
            ))}
            {staged.length < MAX_FILES && (
              <button
                onClick={() => fileRef.current.click()}
                style={{
                  height: 140, borderRadius: 8, border: '2px dashed var(--border2)',
                  background: 'none', cursor: 'pointer', color: 'var(--text3)',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                  gap: 6, fontSize: 12, fontFamily: 'var(--font-ui)', transition: 'border-color 0.15s, color 0.15s',
                }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--gold-dim)'; e.currentTarget.style.color = 'var(--gold)' }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border2)'; e.currentTarget.style.color = 'var(--text3)' }}
              >
                <span style={{ fontSize: 24 }}>+</span>
                <span>继续添加</span>
              </button>
            )}
          </div>

          <input ref={fileRef} type="file" accept="image/*" multiple style={{ display: 'none' }}
            onChange={e => {
              const more = Array.from(e.target.files).filter(f => f.type.startsWith('image/'))
              const combined = [...staged, ...more.map(file => ({
                id: Math.random(), name: file.name, file,
                preview: URL.createObjectURL(file),
              }))].slice(0, MAX_FILES)
              setStaged(combined)
              e.target.value = ''
            }}
          />

          <button onClick={startOcr} className="btn-primary" style={{ width: '100%', justifyContent: 'center', padding: '12px 0' }}>
            ✨ 开始 AI 识别（{staged.length} 张）
          </button>
          <p style={{ fontSize: 11, color: 'var(--text3)', textAlign: 'center', marginTop: 8 }}>
            Claude AI 将自动提取基金名称、代码、金额、收益率
          </p>
        </div>
      )}

      {/* ── PROCESSING ───────────────────────────────────────────────────── */}
      {step === STEP.PROCESSING && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <p style={{ fontSize: 13, color: 'var(--text3)', fontFamily: 'var(--font-ui)', marginBottom: 4 }}>
            正在用 Claude AI 识别 {queue.length} 张图片…
          </p>
          {queue.map(item => (
            <div key={item.id} className="card" style={{ padding: 16, display: 'flex', gap: 16, alignItems: 'center' }}>
              <img src={item.preview} alt="" style={{ width: 52, height: 52, borderRadius: 6, objectFit: 'cover', border: '1px solid var(--border)', flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                  <p style={{ fontSize: 13, color: 'var(--text2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.name}</p>
                  <span style={{ fontSize: 11, marginLeft: 8, flexShrink: 0, fontFamily: 'var(--font-ui)',
                    color: item.status === 'done' ? 'var(--down)' : item.status === 'error' ? 'var(--up)' : item.status === 'processing' ? 'var(--teal)' : 'var(--text3)'
                  }}>{item.msg}</span>
                </div>
                <div style={{ height: 3, borderRadius: 3, background: 'var(--border)' }}>
                  <div style={{
                    height: '100%', borderRadius: 3, transition: 'width 0.7s ease',
                    width: `${item.progress}%`,
                    background: item.status === 'done' ? 'var(--down)' : item.status === 'error' ? 'var(--up)' : 'var(--teal)',
                  }} />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── CONFIRM ──────────────────────────────────────────────────────── */}
      {step === STEP.CONFIRM && (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
            <div>
              <h2 style={{ fontSize: 15, fontWeight: 600, color: 'var(--text1)', fontFamily: 'var(--font-ui)', marginBottom: 4 }}>确认持仓数据</h2>
              <p style={{ fontSize: 12, color: 'var(--text3)' }}>
                共识别 <span style={{ color: 'var(--gold)', fontWeight: 500 }}>{rows.filter(r => r.name).length}</span> 条，请核对后导入
              </p>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={reset} className="btn-ghost" style={{ fontSize: 12, padding: '6px 14px' }}>重新上传</button>
              <button onClick={addRow} style={{
                fontSize: 12, padding: '6px 14px', borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--gold-dim)', color: 'var(--gold)', background: 'none', cursor: 'pointer',
                fontFamily: 'var(--font-ui)', transition: 'background 0.15s',
              }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--gold-glow)'}
                onMouseLeave={e => e.currentTarget.style.background = 'none'}
              >+ 手动添加</button>
            </div>
          </div>

          {/* thumbnails */}
          {queue.length > 0 && (
            <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
              {queue.map(item => (
                <div key={item.id} style={{ position: 'relative' }} title={item.msg}>
                  <img src={item.preview} alt="" style={{ width: 56, height: 56, borderRadius: 6, objectFit: 'cover', border: '1px solid var(--border)' }} />
                  <span style={{
                    position: 'absolute', top: -3, right: -3, width: 14, height: 14, borderRadius: '50%',
                    fontSize: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700,
                    background: item.status === 'done' ? 'var(--down)' : 'var(--up)',
                    color: item.status === 'done' ? '#07090f' : '#fff',
                  }}>{item.status === 'done' ? '✓' : '!'}</span>
                </div>
              ))}
            </div>
          )}

          {queue.some(q => q.status === 'error') && (
            <div style={{ marginBottom: 16, padding: '10px 14px', borderRadius: 'var(--radius-sm)', background: 'rgba(224,92,92,0.07)', border: '1px solid rgba(224,92,92,0.18)', fontSize: 11, color: 'var(--up)' }}>
              {queue.filter(q => q.status === 'error').map(q => (
                <p key={q.id}>⚠ {q.name}：{q.msg}</p>
              ))}
            </div>
          )}

          {skipped.length > 0 && (
            <div style={{ marginBottom: 16, padding: '10px 14px', borderRadius: 'var(--radius-sm)', background: 'var(--surface2)', border: '1px solid var(--gold-dim)', fontSize: 12 }}>
              <p style={{ fontWeight: 500, color: 'var(--text2)', marginBottom: 8, fontFamily: 'var(--font-ui)' }}>以下 {skipped.length} 只已在持仓中，已跳过：</p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {skipped.map(r => (
                  <span key={r.id} style={{ padding: '2px 10px', borderRadius: 999, background: 'var(--surface3)', color: 'var(--text3)', fontSize: 11, fontFamily: 'var(--font-ui)' }}>{r.name}</span>
                ))}
              </div>
            </div>
          )}

          {rows.every(r => !r.name) && skipped.length === 0 && (
            <div style={{ marginBottom: 16, padding: '14px 16px', borderRadius: 'var(--radius-sm)', background: 'rgba(201,168,76,0.07)', border: '1px solid rgba(201,168,76,0.2)', fontSize: 13, color: 'var(--gold)' }}>
              <p style={{ fontWeight: 500, marginBottom: 4 }}>⚠ 未能识别到基金数据</p>
              <p style={{ fontSize: 11, color: 'var(--text3)' }}>可能原因：截图不清晰、图片不是基金持仓界面、或服务器未启动。请手动填写或重新上传。</p>
            </div>
          )}
          {rows.every(r => !r.name) && skipped.length > 0 && (
            <div style={{ marginBottom: 16, padding: '14px 16px', borderRadius: 'var(--radius-sm)', background: 'rgba(61,191,130,0.07)', border: '1px solid rgba(61,191,130,0.2)', fontSize: 13, color: 'var(--down)' }}>
              <p style={{ fontWeight: 500 }}>识别到的基金均已在持仓中，无需重复导入</p>
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 16 }}>
            {rows.map(row => (
              <ConfirmCard
                key={row.id} row={row}
                inpStyle={inpStyle}
                onChange={(field, val) => updateRow(row.id, field, val)}
                onDelete={() => deleteRow(row.id)}
              />
            ))}
          </div>

          {rows.some(r => !r.name || !r.amount) && rows.some(r => r.name) && (
            <div style={{ marginBottom: 16, padding: '10px 14px', borderRadius: 'var(--radius-sm)', background: 'rgba(201,168,76,0.07)', border: '1px solid rgba(201,168,76,0.2)', fontSize: 11, color: 'var(--gold)' }}>
              ⚠ 名称 / 金额（标 *）为必填，请补充后再导入
            </div>
          )}

          <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
            <button onClick={reset} className="btn-ghost" style={{ padding: '8px 18px' }}>取消</button>
            <button
              onClick={confirmImport}
              disabled={rows.every(r => !r.name || !r.amount)}
              className="btn-primary"
            >
              确认导入（{rows.filter(r => r.name && r.amount).length} 条）
            </button>
          </div>
        </div>
      )}

      {/* ── DONE ─────────────────────────────────────────────────────────── */}
      {step === STEP.DONE && (
        <div className="card" style={{ padding: '48px 20px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
          <div style={{ fontSize: 52 }}>✅</div>
          <h2 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text1)', fontFamily: 'var(--font-ui)' }}>导入成功！</h2>
          <p style={{ fontSize: 13, color: 'var(--text3)', fontFamily: 'var(--font-ui)' }}>已导入 {rows.filter(r => r.name && r.amount).length} 条持仓记录</p>
          <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
            <button onClick={reset} className="btn-ghost">继续导入</button>
            <button onClick={() => navigate('/')} className="btn-primary">查看 Dashboard</button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── ConfirmCard ───────────────────────────────────────────────────────────────
function ConfirmCard({ row, inpStyle, onChange, onDelete }) {
  const returnNum = parseFloat(row.returnPct)
  const amountNum = parseFloat(row.amount)
  const missing   = !row.name || !row.amount
  const lbl = { fontSize: 11, color: 'var(--text3)', marginBottom: 4, display: 'block', fontFamily: 'var(--font-ui)' }

  return (
    <div className="card" style={{ padding: 16, borderColor: missing ? 'rgba(201,168,76,0.25)' : 'var(--border)' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12, gap: 12 }}>
        <div style={{ flex: 1 }}>
          <label style={lbl}>基金名称 *</label>
          <input style={inpStyle} value={row.name}
            onChange={e => onChange('name', e.target.value)} placeholder="请输入基金名称"
            onFocus={e => { e.currentTarget.style.borderColor = 'var(--gold)'; e.currentTarget.style.boxShadow = '0 0 0 2px rgba(201,168,76,0.12)' }}
            onBlur={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.boxShadow = 'none' }}
          />
        </div>
        <button onClick={onDelete} style={{ marginTop: 20, color: 'var(--text3)', background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, lineHeight: 1, transition: 'color 0.15s', flexShrink: 0 }}
          onMouseEnter={e => e.currentTarget.style.color = 'var(--up)'}
          onMouseLeave={e => e.currentTarget.style.color = 'var(--text3)'}
        >×</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        {[
          { label: '基金代码', field: 'code', type: 'text', placeholder: '000000' },
          { label: '持有金额（元）*', field: 'amount', type: 'number', placeholder: '0' },
          { label: '收益率（%）', field: 'returnPct', type: 'number', placeholder: '0.00' },
          { label: '收益额（元）', field: 'returnAbs', type: 'number', placeholder: '0' },
        ].map(f => (
          <div key={f.field}>
            <label style={lbl}>{f.label}</label>
            <input style={inpStyle} type={f.type} step={f.field === 'returnPct' ? '0.01' : undefined}
              value={row[f.field]} onChange={e => onChange(f.field, e.target.value)} placeholder={f.placeholder}
              onFocus={e => { e.currentTarget.style.borderColor = 'var(--gold)'; e.currentTarget.style.boxShadow = '0 0 0 2px rgba(201,168,76,0.12)' }}
              onBlur={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.boxShadow = 'none' }}
            />
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <label style={{ ...lbl, marginBottom: 0 }}>板块</label>
          <select
            style={{ ...inpStyle, width: 'auto', padding: '4px 8px', fontSize: 12 }}
            value={row.sector}
            onChange={e => onChange('sector', e.target.value)}
            onFocus={e => { e.currentTarget.style.borderColor = 'var(--gold)' }}
            onBlur={e => { e.currentTarget.style.borderColor = 'var(--border)' }}
          >
            <option value="">未分类</option>
            {SECTORS.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          {row.code && <span style={{ fontSize: 11, color: 'var(--text3)' }}>{row.code}</span>}
        </div>
        <div style={{ display: 'flex', gap: 16, fontSize: 12 }}>
          {amountNum > 0 && (
            <span style={{ color: 'var(--text3)' }}>持有 <span className="num" style={{ color: 'var(--text2)', fontWeight: 500 }}>¥{fmt(amountNum)}</span></span>
          )}
          {!isNaN(returnNum) && returnNum !== 0 && (
            <span className={`num ${cls(returnNum)}`}>{pct(returnNum)}</span>
          )}
        </div>
      </div>
    </div>
  )
}

// ── ManualEntry ───────────────────────────────────────────────────────────────
function ManualEntry({ inpStyle, onConfirm }) {
  const [row, setRow] = useState(blankRow())
  const set  = (field, val) => setRow(r => ({ ...r, [field]: val }))
  const lbl  = { fontSize: 11, color: 'var(--text3)', display: 'block', marginBottom: 4, fontFamily: 'var(--font-ui)' }

  const focusStyle = e => { e.currentTarget.style.borderColor = 'var(--gold)'; e.currentTarget.style.boxShadow = '0 0 0 2px rgba(201,168,76,0.12)' }
  const blurStyle  = e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.boxShadow = 'none' }

  return (
    <div className="card" style={{ padding: 20 }}>
      <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--text1)', fontFamily: 'var(--font-ui)', marginBottom: 16 }}>手动录入持仓</p>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
        {[
          { label: '基金名称 *', field: 'name', type: 'text', placeholder: '易方达蓝筹精选', span: 2 },
          { label: '基金代码', field: 'code', type: 'text', placeholder: '110022' },
          { label: '持有金额（元）*', field: 'amount', type: 'number', placeholder: '10000' },
          { label: '收益率（%）', field: 'returnPct', type: 'number', placeholder: '5.20', step: '0.01' },
          { label: '收益额（元）', field: 'returnAbs', type: 'number', placeholder: '520' },
        ].map(f => (
          <div key={f.field} style={f.span === 2 ? { gridColumn: '1 / -1' } : {}}>
            <label style={lbl}>{f.label}</label>
            <input style={inpStyle} type={f.type} step={f.step} value={row[f.field]}
              onChange={e => set(f.field, e.target.value)} placeholder={f.placeholder}
              onFocus={focusStyle} onBlur={blurStyle}
            />
          </div>
        ))}
        <div>
          <label style={lbl}>板块</label>
          <select style={inpStyle} value={row.sector} onChange={e => set('sector', e.target.value)} onFocus={focusStyle} onBlur={blurStyle}>
            <option value="">请选择</option>
            {SECTORS.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
      </div>
      <button
        disabled={!row.name || !row.amount}
        onClick={() => onConfirm(row)}
        className="btn-primary"
        style={{ width: '100%', justifyContent: 'center', padding: '10px 0' }}
      >
        添加并确认
      </button>
    </div>
  )
}
