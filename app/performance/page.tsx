'use client';

import { useState, useCallback, useEffect } from 'react';
import type { PerformanceRecord, WeatherType } from '@/types';

const today = new Date().toISOString().split('T')[0];

const WEATHER_OPTIONS = [
  { value: '晴' as WeatherType,  label: '☀️ 晴',  active: 'bg-yellow-50 text-yellow-700 border-yellow-300' },
  { value: '雨' as WeatherType,  label: '🌧️ 雨',  active: 'bg-sky-50 text-sky-700 border-sky-300' },
  { value: '颱風' as WeatherType, label: '🌀 颱風', active: 'bg-purple-50 text-purple-700 border-purple-300' },
  { value: '大風' as WeatherType, label: '💨 大風', active: 'bg-slate-100 text-slate-700 border-slate-300' },
];

const RX_FIELDS = [
  { key: 'firstRxLijian' as const, label: '立健首次慢箋', color: '#197fe6' },
  { key: 'rx23Lijian'   as const, label: '2/3次慢箋',    color: '#0ea5e9' },
  { key: 'lijianRx'     as const, label: '立健慢箋',      color: '#10b981' },
  { key: 'externalRx'   as const, label: '外來慢箋',      color: '#f59e0b' },
  { key: 'dentalRx'     as const, label: '牙科箋',        color: '#8b5cf6' },
];

// ─── SVG Bar Chart ───────────────────────────────────────────
function BarChart({
  records,
  valueKey,
  color,
}: {
  records: PerformanceRecord[];
  valueKey: keyof PerformanceRecord;
  color: string;
}) {
  if (records.length === 0) {
    return (
      <div className="h-40 flex items-center justify-center text-[#94a3b8] text-sm">
        暫無資料
      </div>
    );
  }
  const values = records.map(r => Number(r[valueKey]) || 0);
  const max = Math.max(...values, 1);
  const BAR_W = 36;
  const GAP = 4;
  const H = 120;
  const totalW = records.length * (BAR_W + GAP);

  return (
    <div className="overflow-x-auto">
      <svg
        width={totalW}
        height={H + 32}
        style={{ minWidth: '100%', display: 'block' }}
        viewBox={`0 0 ${totalW} ${H + 32}`}
        preserveAspectRatio="none"
      >
        {records.map((r, i) => {
          const val = values[i];
          const barH = max > 0 ? (val / max) * H : 0;
          const x = i * (BAR_W + GAP);
          const y = H - barH;
          return (
            <g key={r.rowIndex}>
              <rect x={x} y={y} width={BAR_W} height={barH} fill={color} rx={3} opacity={0.85} />
              {val > 0 && (
                <text
                  x={x + BAR_W / 2} y={Math.max(y - 3, 10)}
                  textAnchor="middle" fontSize="9" fill={color} fontWeight="600"
                >
                  {val >= 10000 ? `${(val / 10000).toFixed(1)}萬` : val}
                </text>
              )}
              <text
                x={x + BAR_W / 2} y={H + 20}
                textAnchor="middle" fontSize="10" fill="#94a3b8"
              >
                {r.date.slice(8)}日
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

// ─── 統計計算 ────────────────────────────────────────────────
function getMonths(records: PerformanceRecord[]): string[] {
  const seen: Record<string, boolean> = {};
  records.forEach(r => { seen[r.date.slice(0, 7)] = true; });
  return Object.keys(seen).sort((a, b) => b.localeCompare(a));
}

function computeMonthStats(records: PerformanceRecord[], month: string) {
  const filtered = records
    .filter(r => r.date.startsWith(month))
    .sort((a, b) => a.date.localeCompare(b.date));
  const days = filtered.length;
  const totalRevenue   = filtered.reduce((s, r) => s + r.revenue, 0);
  const totalCustomers = filtered.reduce((s, r) => s + r.totalCustomers, 0);
  const totalSales     = filtered.reduce((s, r) => s + r.salesCount, 0);
  const rxBreakdown = {
    firstRxLijian: filtered.reduce((s, r) => s + r.firstRxLijian, 0),
    rx23Lijian:    filtered.reduce((s, r) => s + r.rx23Lijian, 0),
    lijianRx:      filtered.reduce((s, r) => s + r.lijianRx, 0),
    externalRx:    filtered.reduce((s, r) => s + r.externalRx, 0),
    dentalRx:      filtered.reduce((s, r) => s + r.dentalRx, 0),
  };
  const weatherDays = { '晴': 0, '雨': 0, '颱風': 0, '大風': 0 } as Record<WeatherType, number>;
  filtered.forEach(r => { weatherDays[r.weather] = (weatherDays[r.weather] || 0) + 1; });
  return {
    filtered,
    days,
    totalRevenue,
    avgRevenue:   days ? Math.round(totalRevenue / days) : 0,
    totalCustomers,
    avgCustomers: days ? Math.round(totalCustomers / days) : 0,
    totalSales,
    rxBreakdown,
    weatherDays,
  };
}

// ─── 空白表單 ────────────────────────────────────────────────
const emptyForm = {
  date: today,
  weather: '晴' as WeatherType,
  totalCustomers: 0,
  firstRxLijian: 0,
  rx23Lijian: 0,
  lijianRx: 0,
  externalRx: 0,
  dentalRx: 0,
  revenue: 0,
  salesCount: 0,
};

// ════════════════════════════════════════════════════════════
export default function PerformancePage() {
  const [records, setRecords]         = useState<PerformanceRecord[]>([]);
  const [loading, setLoading]         = useState(true);
  const [saving, setSaving]           = useState(false);
  const [tab, setTab]                 = useState<'input' | 'dashboard'>('input');
  const [toastMsg, setToastMsg]       = useState('');
  const [form, setForm]               = useState(emptyForm);
  const [editTarget, setEditTarget]   = useState<PerformanceRecord | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<number | null>(null);
  const [deleting, setDeleting]       = useState(false);
  const [selectedMonth, setSelectedMonth] = useState('');
  const [viewYear, setViewYear]       = useState(new Date().getFullYear());

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(''), 3500);
  };

  const loadRecords = useCallback(async () => {
    try {
      const res = await fetch('/api/performance');
      const data = await res.json();
      if (data.success) {
        const recs: PerformanceRecord[] = data.data ?? [];
        setRecords(recs);
        const curMonth = new Date().toISOString().slice(0, 7);
        const months = getMonths(recs);
        setSelectedMonth(months.includes(curMonth) ? curMonth : (months[0] ?? curMonth));
      }
    } catch {
      // 維持現有資料
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadRecords(); }, [loadRecords]);

  // ── 新增 / 更新 ──
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (editTarget) {
        const res = await fetch('/api/performance', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...form, rowIndex: editTarget.rowIndex }),
        });
        const data = await res.json();
        if (data.success) {
          setEditTarget(null);
          setForm(emptyForm);
          await loadRecords();
          showToast(`✅ 已更新 ${form.date} 業績`);
        } else {
          showToast(`❌ 更新失敗：${data.error}`);
        }
      } else {
        const res = await fetch('/api/performance', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(form),
        });
        const data = await res.json();
        if (data.success) {
          setForm(f => ({ ...emptyForm, date: f.date }));
          await loadRecords();
          showToast(`✅ 已新增 ${form.date} 業績`);
        } else {
          showToast(`❌ 新增失敗：${data.error}`);
        }
      }
    } finally {
      setSaving(false);
    }
  };

  // ── 編輯 ──
  const handleEdit = (r: PerformanceRecord) => {
    setEditTarget(r);
    setForm({
      date: r.date, weather: r.weather,
      totalCustomers: r.totalCustomers, firstRxLijian: r.firstRxLijian,
      rx23Lijian: r.rx23Lijian, lijianRx: r.lijianRx,
      externalRx: r.externalRx, dentalRx: r.dentalRx,
      revenue: r.revenue, salesCount: r.salesCount,
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // ── 刪除 ──
  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await fetch('/api/performance', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rowIndex: deleteTarget }),
      });
      const data = await res.json();
      if (data.success) {
        setDeleteTarget(null);
        await loadRecords();
        showToast('已刪除紀錄');
      } else {
        showToast(`❌ 刪除失敗：${data.error}`);
        setDeleteTarget(null);
      }
    } finally {
      setDeleting(false);
    }
  };

  // ── 衍生資料 ──
  const months = getMonths(records);
  const stats  = selectedMonth ? computeMonthStats(records, selectedMonth) : null;
  const allMonthsInYear = Array.from({ length: 12 }, (_, i) =>
    `${viewYear}-${String(i + 1).padStart(2, '0')}`
  );
  const sortedRecords = [...records].sort((a, b) => b.date.localeCompare(a.date));

  if (loading) return (
    <div className="flex items-center justify-center h-64 text-[#4e7397]">
      <svg className="animate-spin w-6 h-6 mr-2" viewBox="0 0 24 24" fill="none">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
      </svg>
      讀取資料中...
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Toast */}
      {toastMsg && (
        <div className="fixed top-4 right-4 z-50 bg-[#0e141b] text-white text-sm px-4 py-2.5 rounded-lg shadow-lg print:hidden">
          {toastMsg}
        </div>
      )}

      {/* 標題 */}
      <div className="print:hidden">
        <h1 className="text-2xl font-bold text-[#0e141b]">業績管理</h1>
        <p className="text-sm text-[#4e7397] mt-1">每日業績記錄、月度儀表板與報表匯出</p>
      </div>

      {/* Tab 切換 */}
      <div className="flex gap-2 border-b border-[#e7edf3] print:hidden">
        {([
          ['input',     '📋 每日記錄'],
          ['dashboard', '📊 月度儀表板'],
        ] as const).map(([val, label]) => (
          <button key={val} onClick={() => setTab(val)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
              tab === val
                ? 'border-primary text-primary'
                : 'border-transparent text-[#4e7397] hover:text-[#0e141b]'
            }`}>
            {label}
          </button>
        ))}
      </div>

      {/* ══════ 每日記錄 Tab ══════ */}
      {tab === 'input' && (
        <div className="space-y-6 print:hidden">
          {/* 表單 */}
          <div className="card">
            <h2 className="font-bold text-[#0e141b] mb-4">
              {editTarget ? `✏️ 編輯紀錄：${editTarget.date}` : '📝 新增每日業績'}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* 日期 + 天氣 */}
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                <div>
                  <label>日期 *</label>
                  <input type="date" required value={form.date}
                    onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
                </div>
                <div className="md:col-span-4">
                  <label>天氣 *</label>
                  <div className="flex gap-2 flex-wrap">
                    {WEATHER_OPTIONS.map(w => (
                      <button key={w.value} type="button"
                        onClick={() => setForm(f => ({ ...f, weather: w.value }))}
                        className={`px-3 py-2 rounded-lg text-sm font-medium border transition-colors ${
                          form.weather === w.value
                            ? w.active
                            : 'bg-white text-[#4e7397] border-[#e7edf3] hover:bg-[#f8fafc]'
                        }`}>
                        {w.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* 總人數 / 銷售 / 營業額 */}
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                <div>
                  <label>總人數</label>
                  <input type="number" min={0} value={form.totalCustomers}
                    onChange={e => setForm(f => ({ ...f, totalCustomers: Number(e.target.value) }))} />
                </div>
                <div>
                  <label>銷售人數</label>
                  <input type="number" min={0} value={form.salesCount}
                    onChange={e => setForm(f => ({ ...f, salesCount: Number(e.target.value) }))} />
                </div>
                <div>
                  <label>營業額（元）</label>
                  <input type="number" min={0} value={form.revenue}
                    onChange={e => setForm(f => ({ ...f, revenue: Number(e.target.value) }))} />
                </div>
              </div>

              {/* 慢箋分類 */}
              <div>
                <p className="text-xs font-semibold text-[#4e7397] uppercase tracking-wide mb-2">
                  慢箋分類人數
                </p>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                  {RX_FIELDS.map(f => (
                    <div key={f.key}>
                      <label>{f.label}</label>
                      <input type="number" min={0}
                        value={form[f.key]}
                        onChange={e => setForm(prev => ({ ...prev, [f.key]: Number(e.target.value) }))} />
                    </div>
                  ))}
                </div>
              </div>

              {/* 按鈕 */}
              <div className="flex gap-3 justify-end">
                {editTarget && (
                  <button type="button"
                    onClick={() => { setEditTarget(null); setForm(emptyForm); }}
                    className="btn-secondary">
                    取消編輯
                  </button>
                )}
                <button type="submit" disabled={saving} className="btn-primary">
                  {saving ? '儲存中...' : editTarget ? '💾 更新紀錄' : '💾 新增紀錄'}
                </button>
              </div>
            </form>
          </div>

          {/* 紀錄列表 */}
          <div className="card p-0 overflow-hidden">
            <div className="px-6 py-4 border-b border-[#e7edf3] flex items-center justify-between">
              <h3 className="font-semibold text-[#0e141b]">所有業績紀錄</h3>
              <span className="text-sm text-[#4e7397]">共 {records.length} 筆</span>
            </div>
            <div className="overflow-x-auto">
              <table>
                <thead>
                  <tr>
                    <th>日期</th>
                    <th>天氣</th>
                    <th>總人數</th>
                    <th>立健首次</th>
                    <th>2/3次</th>
                    <th>立健慢箋</th>
                    <th>外來慢箋</th>
                    <th>牙科箋</th>
                    <th>銷售</th>
                    <th>營業額</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {sortedRecords.length === 0 ? (
                    <tr>
                      <td colSpan={11} className="text-center py-12 text-[#94a3b8]">
                        尚無業績紀錄，請從上方新增
                      </td>
                    </tr>
                  ) : (
                    sortedRecords.map(r => (
                      <tr key={r.rowIndex}>
                        <td className="font-medium whitespace-nowrap">{r.date}</td>
                        <td className="whitespace-nowrap">
                          {r.weather === '晴' ? '☀️' : r.weather === '雨' ? '🌧️' : r.weather === '颱風' ? '🌀' : '💨'}{' '}
                          {r.weather}
                        </td>
                        <td>{r.totalCustomers}</td>
                        <td>{r.firstRxLijian}</td>
                        <td>{r.rx23Lijian}</td>
                        <td>{r.lijianRx}</td>
                        <td>{r.externalRx}</td>
                        <td>{r.dentalRx}</td>
                        <td>{r.salesCount}</td>
                        <td className="font-semibold text-[#197fe6] whitespace-nowrap">
                          ${r.revenue.toLocaleString()}
                        </td>
                        <td>
                          <div className="flex gap-1">
                            <button onClick={() => handleEdit(r)}
                              className="text-[#94a3b8] hover:text-[#197fe6] transition-colors p-1"
                              title="編輯">
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                              </svg>
                            </button>
                            <button onClick={() => setDeleteTarget(r.rowIndex)}
                              className="text-[#94a3b8] hover:text-red-500 transition-colors p-1"
                              title="刪除">
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14H6L5 6" />
                                <path d="M10 11v6M14 11v6" /><path d="M9 6V4h6v2" />
                              </svg>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ══════ 月度儀表板 Tab ══════ */}
      {tab === 'dashboard' && (
        <div className="space-y-6">
          {/* 月份選擇 + 列印 */}
          <div className="flex flex-wrap items-center gap-3 print:hidden">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-[#4e7397]">月份：</span>
              <select value={selectedMonth}
                onChange={e => setSelectedMonth(e.target.value)}
                className="w-36">
                {months.length === 0
                  ? <option value="">（無資料）</option>
                  : months.map(m => (
                    <option key={m} value={m}>
                      {m.slice(0, 4)} 年 {parseInt(m.slice(5))} 月
                    </option>
                  ))
                }
              </select>
            </div>
            <button
              onClick={() => window.print()}
              className="btn-secondary flex items-center gap-2 ml-auto"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="6 9 6 2 18 2 18 9" />
                <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
                <rect x="6" y="14" width="12" height="8" />
              </svg>
              列印 / 匯出 PDF
            </button>
          </div>

          {stats && stats.days > 0 ? (
            <div id="print-report" className="space-y-6">
              {/* 列印標題（螢幕隱藏） */}
              <div className="hidden print:block mb-6 text-center border-b pb-4">
                <h1 className="text-3xl font-bold">立安藥局 業績月報</h1>
                <p className="text-gray-600 mt-2 text-lg">
                  {selectedMonth.slice(0, 4)} 年 {parseInt(selectedMonth.slice(5))} 月
                </p>
                <p className="text-gray-400 text-sm mt-1">
                  列印日期：{new Date().toLocaleDateString('zh-TW')}
                </p>
              </div>

              {/* 摘要統計卡片 */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  {
                    label: '本月總營業額',
                    value: `$${stats.totalRevenue.toLocaleString()}`,
                    sub: `日均 $${stats.avgRevenue.toLocaleString()}`,
                    color: 'text-blue-600',
                    bg: 'bg-blue-50',
                  },
                  {
                    label: '總來客人數',
                    value: stats.totalCustomers.toLocaleString(),
                    sub: `日均 ${stats.avgCustomers} 人`,
                    color: 'text-emerald-600',
                    bg: 'bg-emerald-50',
                  },
                  {
                    label: '銷售人數',
                    value: stats.totalSales.toLocaleString(),
                    sub: `日均 ${stats.days ? Math.round(stats.totalSales / stats.days) : 0} 人`,
                    color: 'text-violet-600',
                    bg: 'bg-violet-50',
                  },
                  {
                    label: '記錄天數',
                    value: `${stats.days} 天`,
                    sub: `${selectedMonth.slice(0, 4)} 年 ${parseInt(selectedMonth.slice(5))} 月`,
                    color: 'text-amber-600',
                    bg: 'bg-amber-50',
                  },
                ].map(c => (
                  <div key={c.label} className={`card ${c.bg} border-0`}>
                    <p className="text-xs text-[#4e7397] mb-1">{c.label}</p>
                    <p className={`text-2xl font-bold ${c.color}`}>{c.value}</p>
                    <p className="text-xs text-[#94a3b8] mt-1">{c.sub}</p>
                  </div>
                ))}
              </div>

              {/* 每日營業額圖表 */}
              <div className="card">
                <h3 className="font-semibold text-[#0e141b] mb-4">📈 每日營業額（元）</h3>
                <BarChart records={stats.filtered} valueKey="revenue" color="#197fe6" />
              </div>

              {/* 每日來客數圖表 */}
              <div className="card">
                <h3 className="font-semibold text-[#0e141b] mb-4">👥 每日來客人數</h3>
                <BarChart records={stats.filtered} valueKey="totalCustomers" color="#10b981" />
              </div>

              {/* 慢箋分類 + 天氣分佈 */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* 慢箋分類 */}
                <div className="card">
                  <h3 className="font-semibold text-[#0e141b] mb-4">💊 慢箋分類統計</h3>
                  <div className="space-y-3">
                    {RX_FIELDS.map(f => {
                      const count = stats.rxBreakdown[f.key];
                      const total = Object.values(stats.rxBreakdown).reduce((a, b) => a + b, 0);
                      const pct   = total > 0 ? Math.round((count / total) * 100) : 0;
                      return (
                        <div key={f.key}>
                          <div className="flex justify-between text-sm mb-1">
                            <span className="text-[#4e7397]">{f.label}</span>
                            <span className="font-semibold" style={{ color: f.color }}>
                              {count} 人（{pct}%）
                            </span>
                          </div>
                          <div className="h-2 bg-[#f1f5f9] rounded-full overflow-hidden">
                            <div className="h-full rounded-full transition-all"
                              style={{ width: `${pct}%`, backgroundColor: f.color }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* 天氣分佈 */}
                <div className="card">
                  <h3 className="font-semibold text-[#0e141b] mb-4">🌤️ 天氣分佈</h3>
                  <div className="space-y-3">
                    {WEATHER_OPTIONS.map(w => {
                      const days = stats.weatherDays[w.value] || 0;
                      const pct  = stats.days > 0 ? Math.round((days / stats.days) * 100) : 0;
                      return (
                        <div key={w.value}>
                          <div className="flex justify-between text-sm mb-1">
                            <span className="text-[#4e7397]">{w.label}</span>
                            <span className="font-semibold text-[#0e141b]">
                              {days} 天（{pct}%）
                            </span>
                          </div>
                          <div className="h-2 bg-[#f1f5f9] rounded-full overflow-hidden">
                            <div className="h-full rounded-full bg-[#197fe6] transition-all"
                              style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* 每日明細表 */}
              <div className="card p-0 overflow-hidden">
                <div className="px-6 py-4 border-b border-[#e7edf3]">
                  <h3 className="font-semibold text-[#0e141b]">📋 每日明細</h3>
                </div>
                <div className="overflow-x-auto">
                  <table>
                    <thead>
                      <tr>
                        <th>日期</th>
                        <th>天氣</th>
                        <th>總人數</th>
                        <th>立健首次</th>
                        <th>2/3次</th>
                        <th>立健慢箋</th>
                        <th>外來慢箋</th>
                        <th>牙科箋</th>
                        <th>銷售</th>
                        <th>營業額</th>
                      </tr>
                    </thead>
                    <tbody>
                      {stats.filtered.map(r => (
                        <tr key={r.rowIndex}>
                          <td className="whitespace-nowrap">{r.date}</td>
                          <td className="whitespace-nowrap">
                            {r.weather === '晴' ? '☀️' : r.weather === '雨' ? '🌧️' : r.weather === '颱風' ? '🌀' : '💨'}{' '}{r.weather}
                          </td>
                          <td>{r.totalCustomers}</td>
                          <td>{r.firstRxLijian}</td>
                          <td>{r.rx23Lijian}</td>
                          <td>{r.lijianRx}</td>
                          <td>{r.externalRx}</td>
                          <td>{r.dentalRx}</td>
                          <td>{r.salesCount}</td>
                          <td className="font-semibold text-[#197fe6]">
                            ${r.revenue.toLocaleString()}
                          </td>
                        </tr>
                      ))}
                      {/* 合計列 */}
                      <tr className="bg-[#f8fafc] font-bold text-[#0e141b]">
                        <td>合計</td>
                        <td>—</td>
                        <td>{stats.totalCustomers}</td>
                        <td>{stats.rxBreakdown.firstRxLijian}</td>
                        <td>{stats.rxBreakdown.rx23Lijian}</td>
                        <td>{stats.rxBreakdown.lijianRx}</td>
                        <td>{stats.rxBreakdown.externalRx}</td>
                        <td>{stats.rxBreakdown.dentalRx}</td>
                        <td>{stats.totalSales}</td>
                        <td className="text-[#197fe6]">${stats.totalRevenue.toLocaleString()}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* 年度月份概覽 */}
              <div className="card print:hidden">
                <div className="flex items-center gap-3 mb-4">
                  <h3 className="font-semibold text-[#0e141b]">
                    📅 {viewYear} 年月度業績概覽
                  </h3>
                  <div className="flex gap-1 ml-auto">
                    <button onClick={() => setViewYear(y => y - 1)}
                      className="btn-secondary px-2 py-1 text-xs">◀</button>
                    <button onClick={() => setViewYear(y => y + 1)}
                      className="btn-secondary px-2 py-1 text-xs">▶</button>
                  </div>
                </div>
                <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                  {allMonthsInYear.map(m => {
                    const ms = computeMonthStats(records, m);
                    const hasData  = ms.days > 0;
                    const isCurrent = m === selectedMonth;
                    return (
                      <button key={m}
                        disabled={!hasData}
                        onClick={() => setSelectedMonth(m)}
                        className={`p-3 rounded-lg border text-left transition-colors ${
                          isCurrent
                            ? 'border-primary bg-[#e8f0fe]'
                            : hasData
                              ? 'border-[#e7edf3] bg-white hover:border-primary hover:bg-[#f0f7ff]'
                              : 'border-dashed border-[#e7edf3] bg-[#f8fafc] opacity-50 cursor-default'
                        }`}>
                        <p className={`text-xs font-medium ${isCurrent ? 'text-primary' : 'text-[#4e7397]'}`}>
                          {parseInt(m.slice(5))} 月
                        </p>
                        {hasData ? (
                          <>
                            <p className="text-sm font-bold text-[#0e141b] mt-1">
                              {ms.totalRevenue >= 10000
                                ? `$${(ms.totalRevenue / 10000).toFixed(1)}萬`
                                : `$${ms.totalRevenue.toLocaleString()}`}
                            </p>
                            <p className="text-xs text-[#94a3b8]">{ms.days} 天</p>
                          </>
                        ) : (
                          <p className="text-xs text-[#94a3b8] mt-1">無資料</p>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : (
            <div className="card text-center py-20 text-[#94a3b8]">
              <p className="text-5xl mb-4">📊</p>
              <p className="font-medium text-lg">此月份尚無業績記錄</p>
              <p className="text-sm mt-2">請先在「每日記錄」分頁新增資料</p>
            </div>
          )}
        </div>
      )}

      {/* 刪除確認 Dialog */}
      {deleteTarget && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4 print:hidden">
          <div className="bg-white rounded-xl p-6 w-full max-w-sm shadow-xl">
            <h3 className="font-bold text-[#0e141b] mb-2">確認刪除此業績紀錄？</h3>
            <p className="text-sm text-[#4e7397] mb-5">此操作不可復原。</p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteTarget(null)} disabled={deleting}
                className="btn-secondary flex-1">取消</button>
              <button onClick={handleDelete} disabled={deleting}
                className="btn-danger flex-1">
                {deleting ? '刪除中...' : '確認刪除'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
