import { useState } from 'react'
import { getHeritageMeta, saveHeritageMeta } from '../store'
import type { HeritageMeta } from '../store'
import type { ModelMeta, HistoricalPhoto, ArchiveDocument, RepairRecord, RedCultureMark } from '../types'
import { PROTECTION_LEVEL_LABELS, CONSERVATION_STATUS_LABELS, uid } from '../types'

type Tab = 'basic' | 'photos' | 'docs' | 'repairs' | 'red'

interface Props {
  model: ModelMeta
  onClose: () => void
  onSaved: () => void
}

const TABS: { key: Tab; label: string }[] = [
  { key: 'basic', label: '基本信息' },
  { key: 'photos', label: '历史照片' },
  { key: 'docs', label: '文史档案' },
  { key: 'repairs', label: '修缮记录' },
  { key: 'red', label: '红色印记' },
]

const DOC_TYPES: { value: ArchiveDocument['type']; label: string }[] = [
  { value: 'history', label: '历史资料' },
  { value: 'architecture', label: '建筑测绘' },
  { value: 'culture', label: '文化研究' },
  { value: 'party_history', label: '党史资料' },
  { value: 'other', label: '其他' },
]

// ── Styles ──

const inputClass =
  'w-full px-3 py-2 rounded-lg border border-border-1 bg-white text-text-1 text-[13px] focus:outline-none focus:border-accent-1/40 transition-colors placeholder:text-text-3/40'

const labelClass = 'block text-[11px] font-medium text-text-3 mb-1.5 tracking-wide'

const btnDangerClass =
  'px-2.5 py-1 rounded-lg text-[11px] text-accent-3/60 hover:text-accent-3 hover:bg-accent-3/5 transition-colors bg-transparent border-none cursor-pointer'

const btnSecondaryClass =
  'px-3 py-1.5 rounded-lg text-[11px] text-accent-1/70 hover:bg-accent-1/5 transition-colors bg-transparent border border-accent-1/15 cursor-pointer'

export default function HeritageEditor({ model, onClose, onSaved }: Props) {
  const [tab, setTab] = useState<Tab>('basic')
  const [saving, setSaving] = useState(false)

  const existing = getHeritageMeta(model.id) ?? {}

  const [meta, setMeta] = useState<HeritageMeta>({
    protectionLevel: existing.protectionLevel ?? model.protectionLevel ?? 'none',
    constructionYear: existing.constructionYear ?? model.constructionYear ?? '',
    architecturalStyle: existing.architecturalStyle ?? model.architecturalStyle ?? '',
    conservationStatus: existing.conservationStatus ?? model.conservationStatus ?? 'good',
    location: existing.location ?? model.location ?? { address: '', district: '', lat: 0, lng: 0 },
    historicalPhotos: existing.historicalPhotos ?? model.historicalPhotos ?? [],
    documents: existing.documents ?? model.documents ?? [],
    repairRecords: existing.repairRecords ?? model.repairRecords ?? [],
    redCultureMarks: existing.redCultureMarks ?? model.redCultureMarks ?? [],
  })

  function update<K extends keyof HeritageMeta>(key: K, value: HeritageMeta[K]) {
    setMeta((prev: HeritageMeta) => ({ ...prev, [key]: value }))
  }

  // ── List item handlers ──

  function addPhoto() {
    const list = [...(meta.historicalPhotos ?? [])]
    list.push({ id: uid(), url: '', year: '', caption: '' })
    update('historicalPhotos', list)
  }
  function editPhoto(idx: number, f: Partial<HistoricalPhoto>) {
    const list = [...(meta.historicalPhotos ?? [])]
    list[idx] = { ...list[idx], ...f }
    update('historicalPhotos', list)
  }
  function delPhoto(idx: number) {
    update('historicalPhotos', (meta.historicalPhotos ?? []).filter((_m: HistoricalPhoto, i: number) => i !== idx))
  }

  function addDoc() {
    const list = [...(meta.documents ?? [])]
    list.push({ id: uid(), title: '', type: 'other' as ArchiveDocument['type'], description: '', url: '' })
    update('documents', list)
  }
  function editDoc(idx: number, f: Partial<ArchiveDocument>) {
    const list = [...(meta.documents ?? [])]
    list[idx] = { ...list[idx], ...f }
    update('documents', list)
  }
  function delDoc(idx: number) {
    update('documents', (meta.documents ?? []).filter((_d: ArchiveDocument, i: number) => i !== idx))
  }

  function addRepair() {
    const list = [...(meta.repairRecords ?? [])]
    list.push({ id: uid(), date: '', description: '', photos: [] as string[] })
    update('repairRecords', list)
  }
  function editRepair(idx: number, f: Partial<RepairRecord>) {
    const list = [...(meta.repairRecords ?? [])]
    list[idx] = { ...list[idx], ...f }
    update('repairRecords', list)
  }
  function delRepair(idx: number) {
    update('repairRecords', (meta.repairRecords ?? []).filter((_r: RepairRecord, i: number) => i !== idx))
  }

  function addRed() {
    const list = [...(meta.redCultureMarks ?? [])]
    list.push({ id: uid(), title: '', description: '', period: '' })
    update('redCultureMarks', list)
  }
  function editRed(idx: number, f: Partial<RedCultureMark>) {
    const list = [...(meta.redCultureMarks ?? [])]
    list[idx] = { ...list[idx], ...f }
    update('redCultureMarks', list)
  }
  function delRed(idx: number) {
    update('redCultureMarks', (meta.redCultureMarks ?? []).filter((_r: RedCultureMark, i: number) => i !== idx))
  }

  async function handleSave() {
    setSaving(true)
    try {
      // Clean empty optional fields before save
      const clean: HeritageMeta = { ...meta }
      if (clean.location && !clean.location.address && !clean.location.district && !clean.location.lat && !clean.location.lng) {
        delete clean.location
      }
      saveHeritageMeta(model.id, clean)
      onSaved()
    } finally {
      setSaving(false)
    }
  }

  // ── Render ──

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/30 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl max-h-[85vh] flex flex-col rounded-2xl bg-white border border-border-1 shadow-xl overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="shrink-0 flex items-center justify-between px-6 py-4 border-b border-border-1">
          <h2 className="text-[15px] font-semibold text-text-1 font-display tracking-wide">
            编辑文保信息 · {model.name}
          </h2>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-text-3/50 hover:text-text-1 hover:bg-surface-2 transition-colors bg-transparent border-none cursor-pointer"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Tab bar */}
        <div className="shrink-0 flex gap-0 px-6 border-b border-border-1 bg-surface-0/50">
          {TABS.map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-4 py-2.5 text-[12px] font-medium tracking-wide transition-colors bg-transparent border-none cursor-pointer border-b-2 -mb-[1px] ${
                tab === t.key
                  ? 'text-accent-1 border-accent-1'
                  : 'text-text-3/60 border-transparent hover:text-text-2'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
          {tab === 'basic' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>保护级别</label>
                  <select
                    value={meta.protectionLevel ?? 'none'}
                    onChange={e => update('protectionLevel', e.target.value as HeritageMeta['protectionLevel'])}
                    className={inputClass}
                  >
                    {Object.entries(PROTECTION_LEVEL_LABELS).map(([k, v]) => (
                      <option key={k} value={k}>{v}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={labelClass}>保存状态</label>
                  <select
                    value={meta.conservationStatus ?? 'good'}
                    onChange={e => update('conservationStatus', e.target.value as HeritageMeta['conservationStatus'])}
                    className={inputClass}
                  >
                    {Object.entries(CONSERVATION_STATUS_LABELS).map(([k, v]) => (
                      <option key={k} value={k}>{v}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>建造年代</label>
                  <input
                    type="text" value={meta.constructionYear ?? ''}
                    onChange={e => update('constructionYear', e.target.value)}
                    placeholder="如：清光绪年间（约1880年）"
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className={labelClass}>建筑风格</label>
                  <input
                    type="text" value={meta.architecturalStyle ?? ''}
                    onChange={e => update('architecturalStyle', e.target.value)}
                    placeholder="如：岭南石雕、徽派建筑"
                    className={inputClass}
                  />
                </div>
              </div>
              <fieldset className="rounded-xl border border-border-1 p-4 space-y-3">
                <legend className="text-[11px] font-medium text-text-3 px-1 tracking-wide">地理位置</legend>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelClass}>地址</label>
                    <input
                      type="text" value={meta.location?.address ?? ''}
                      onChange={e => update('location', { ...meta.location!, address: e.target.value })}
                      placeholder="详细地址"
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>所属区域</label>
                    <input
                      type="text" value={meta.location?.district ?? ''}
                      onChange={e => update('location', { ...meta.location!, district: e.target.value })}
                      placeholder="如：越秀区"
                      className={inputClass}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelClass}>纬度</label>
                    <input
                      type="number" step="any" value={meta.location?.lat ?? ''}
                      onChange={e => update('location', { ...meta.location!, lat: parseFloat(e.target.value) || 0 })}
                      placeholder="23.1196"
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>经度</label>
                    <input
                      type="number" step="any" value={meta.location?.lng ?? ''}
                      onChange={e => update('location', { ...meta.location!, lng: parseFloat(e.target.value) || 0 })}
                      placeholder="113.2591"
                      className={inputClass}
                    />
                  </div>
                </div>
              </fieldset>
            </div>
          )}

          {tab === 'photos' && (
            <div className="space-y-3">
              {(meta.historicalPhotos ?? []).length === 0 && (
                <p className="text-[12px] text-text-3/50 text-center py-8">暂无历史照片</p>
              )}
              {(meta.historicalPhotos ?? []).map((p: HistoricalPhoto, i: number) => (
                <div key={p.id} className="flex gap-3 p-3 rounded-xl bg-surface-0 border border-border-1 items-start">
                  <div className="flex-1 space-y-2">
                    <input
                      type="text" value={p.url}
                      onChange={e => editPhoto(i, { url: e.target.value })}
                      placeholder="图片 URL（可留空，后续补充）"
                      className={inputClass}
                    />
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="text" value={p.year}
                        onChange={e => editPhoto(i, { year: e.target.value })}
                        placeholder="年代（如：1920年代）"
                        className={inputClass}
                      />
                      <input
                        type="text" value={p.caption}
                        onChange={e => editPhoto(i, { caption: e.target.value })}
                        placeholder="图片说明"
                        className={inputClass}
                      />
                    </div>
                  </div>
                  <button onClick={() => delPhoto(i)} className={btnDangerClass} style={{ marginTop: 2 }}>
                    删除
                  </button>
                </div>
              ))}
              <button onClick={addPhoto} className={btnSecondaryClass}>
                + 添加照片
              </button>
            </div>
          )}

          {tab === 'docs' && (
            <div className="space-y-3">
              {(meta.documents ?? []).length === 0 && (
                <p className="text-[12px] text-text-3/50 text-center py-8">暂无文史档案</p>
              )}
              {(meta.documents ?? []).map((d: ArchiveDocument, i: number) => (
                <div key={d.id} className="flex gap-3 p-3 rounded-xl bg-surface-0 border border-border-1 items-start">
                  <div className="flex-1 space-y-2">
                    <input
                      type="text" value={d.title}
                      onChange={e => editDoc(i, { title: e.target.value })}
                      placeholder="档案标题"
                      className={inputClass}
                    />
                    <div className="flex gap-2">
                      <select
                        value={d.type}
                        onChange={e => editDoc(i, { type: e.target.value as ArchiveDocument['type'] })}
                        className={inputClass + ' w-32'}
                      >
                        {DOC_TYPES.map(dt => (
                          <option key={dt.value} value={dt.value}>{dt.label}</option>
                        ))}
                      </select>
                      <input
                        type="text" value={d.url ?? ''}
                        onChange={e => editDoc(i, { url: e.target.value })}
                        placeholder="文件 URL（可选）"
                        className={inputClass + ' flex-1'}
                      />
                    </div>
                    <textarea
                      value={d.description}
                      onChange={e => editDoc(i, { description: e.target.value })}
                      placeholder="档案描述"
                      rows={2}
                      className={inputClass + ' resize-none'}
                    />
                  </div>
                  <button onClick={() => delDoc(i)} className={btnDangerClass} style={{ marginTop: 2 }}>
                    删除
                  </button>
                </div>
              ))}
              <button onClick={addDoc} className={btnSecondaryClass}>
                + 添加档案
              </button>
            </div>
          )}

          {tab === 'repairs' && (
            <div className="space-y-3">
              {(meta.repairRecords ?? []).length === 0 && (
                <p className="text-[12px] text-text-3/50 text-center py-8">暂无修缮记录</p>
              )}
              {(meta.repairRecords ?? []).map((r: RepairRecord, i: number) => (
                <div key={r.id} className="flex gap-3 p-3 rounded-xl bg-surface-0 border border-border-1 items-start">
                  <div className="flex-1 space-y-2">
                    <input
                      type="text" value={r.date}
                      onChange={e => editRepair(i, { date: e.target.value })}
                      placeholder="日期（如：2023-08）"
                      className={inputClass + ' w-44'}
                    />
                    <textarea
                      value={r.description}
                      onChange={e => editRepair(i, { description: e.target.value })}
                      placeholder="修缮描述"
                      rows={2}
                      className={inputClass + ' resize-none'}
                    />
                  </div>
                  <button onClick={() => delRepair(i)} className={btnDangerClass} style={{ marginTop: 2 }}>
                    删除
                  </button>
                </div>
              ))}
              <button onClick={addRepair} className={btnSecondaryClass}>
                + 添加修缮记录
              </button>
            </div>
          )}

          {tab === 'red' && (
            <div className="space-y-3">
              {(meta.redCultureMarks ?? []).length === 0 && (
                <p className="text-[12px] text-text-3/50 text-center py-8">暂无红色文化印记</p>
              )}
              {(meta.redCultureMarks ?? []).map((r: RedCultureMark, i: number) => (
                <div key={r.id} className="flex gap-3 p-3 rounded-xl bg-surface-0 border border-border-1 items-start">
                  <div className="flex-1 space-y-2">
                    <input
                      type="text" value={r.title}
                      onChange={e => editRed(i, { title: e.target.value })}
                      placeholder="标题（如：大革命时期工农集会点）"
                      className={inputClass}
                    />
                    <input
                      type="text" value={r.period}
                      onChange={e => editRed(i, { period: e.target.value })}
                      placeholder="历史时期（如：抗日战争时期 1942-1944）"
                      className={inputClass}
                    />
                    <textarea
                      value={r.description}
                      onChange={e => editRed(i, { description: e.target.value })}
                      placeholder="详细描述"
                      rows={2}
                      className={inputClass + ' resize-none'}
                    />
                  </div>
                  <button onClick={() => delRed(i)} className={btnDangerClass} style={{ marginTop: 2 }}>
                    删除
                  </button>
                </div>
              ))}
              <button onClick={addRed} className={btnSecondaryClass}>
                + 添加红色印记
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="shrink-0 flex items-center justify-between px-6 py-4 border-t border-border-1 bg-surface-0/50">
          <p className="text-[10px] text-text-3/40">
            修改将保存到本地存储 · 内置模型可随时恢复默认
          </p>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-[12px] text-text-2/70 hover:text-text-1 bg-transparent border border-border-1 hover:bg-surface-1 transition-colors cursor-pointer"
            >
              取消
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-5 py-2 rounded-xl text-[12px] font-medium text-white bg-accent-1 hover:opacity-90 transition-opacity border-none cursor-pointer disabled:opacity-50"
            >
              {saving ? '保存中…' : '保存'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
