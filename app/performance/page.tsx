'use client';

import { useState, useCallback, useEffect } from 'react';
import type { PerformanceRecord, WeatherType, HistoricalDayRecord } from '@/types';
import type { ChronicMonthStat } from '@/lib/sheets';

const today = new Date().toISOString().split('T')[0];

const WEATHER_OPTIONS = [
  { value: '晴'  as WeatherType, label: '☀️ 晴',  active: 'bg-yellow-50 text-yellow-700 border-yellow-300' },
  { value: '雨'  as WeatherType, label: '🌧️ 雨',  active: 'bg-sky-50 text-sky-700 border-sky-300' },
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

const MONTH_LABELS = ['1月','2月','3月','4月','5月','6月','7月','8月','9月','10月','11月','12月'];

// 年份對應顏色
const YEAR_COLORS: Record<number, string> = {
  2019: '#94a3b8', 2020: '#64748b', 2021: '#a78bfa',
  2022: '#f472b6', 2023: '#fb923c', 2024: '#34d399',
  2025: '#38bdf8', 2026: '#197fe6',
};
function yearColor(y: number) { return YEAR_COLORS[y] ?? '#197fe6'; }

// ─── SVG 折線圖（多系列）──────────────────────────────────────
type ChartSeries = { name: string; data: number[]; color: string };
type TooltipState = {
  svgX: number; svgY: number;
  value: number; xLabel: string; seriesName: string; color: string;
} | null;

function MultiLineChart({
  series,
  xLabels,
  height = 200,
  formatY = (v: number) => v >= 10000 ? `${(v / 10000).toFixed(1)}萬` : String(v),
}: {
  series: ChartSeries[];
  xLabels: string[];
  height?: number;
  formatY?: (v: number) => string;
}) {
  const [tooltip, setTooltip] = useState<TooltipState>(null);

  const n = xLabels.length;
  const allV = series.flatMap(s => s.data).filter(v => v > 0);
  if (allV.length === 0) return (
    <div className="flex items-center justify-center text-[#94a3b8] text-sm" style={{ height }}>
      暫無資料
    </div>
  );
  const maxY = Math.max(...allV, 1);
  const W = 640; const PL = 58; const PR = 16; const PT = 24; const PB = 32;
  const cW = W - PL - PR; const cH = height - PT - PB;
  const xp = (i: number) => n <= 1 ? PL + cW / 2 : PL + (i / (n - 1)) * cW;
  const yp = (v: number) => PT + cH - (v / maxY) * cH;
  const yTicks = [0, 0.25, 0.5, 0.75, 1];

  // Tooltip 尺寸與定位（SVG 座標系）
  const TW = 136; const TH = 50;
  const tx = tooltip ? Math.min(tooltip.svgX + 12, W - PR - TW) : 0;
  const ty = tooltip ? Math.max(tooltip.svgY - TH - 8, PT) : 0;

  return (
    <div className="overflow-x-auto">
      <svg width="100%" height={height} viewBox={`0 0 ${W} ${height}`}
        style={{ minWidth: 320, display: 'block' }} preserveAspectRatio="xMidYMid meet"
        onMouseLeave={() => setTooltip(null)}>
        {/* 格線 + Y軸標籤 */}
        {yTicks.map((r, ti) => {
          const yv = Math.round(maxY * r);
          const yy = yp(yv);
          return (
            <g key={ti}>
              <line x1={PL} y1={yy} x2={W - PR} y2={yy}
                stroke="#f1f5f9" strokeWidth={r === 0 ? 1.5 : 1} />
              <text x={PL - 5} y={yy + 4} textAnchor="end" fontSize="9" fill="#94a3b8">
                {formatY(yv)}
              </text>
            </g>
          );
        })}
        {/* X軸標籤 */}
        {xLabels.map((lbl, i) => (
          <text key={i} x={xp(i)} y={height - 6}
            textAnchor="middle" fontSize="10" fill="#94a3b8">{lbl}</text>
        ))}
        {/* 系列：折線 + 互動圓點 */}
        {series.map(s => {
          const pts = s.data.map((v, i) => `${xp(i)},${yp(v)}`).join(' ');
          return (
            <g key={s.name}>
              <polyline points={pts} fill="none" stroke={s.color}
                strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
              {s.data.map((v, i) => (
                <circle key={i} cx={xp(i)} cy={yp(v)}
                  r={v > 0 ? 5 : 0}
                  fill={v > 0 ? s.color : 'none'}
                  opacity={tooltip && tooltip.svgX === xp(i) && tooltip.seriesName === s.name ? 1 : 0.6}
                  style={{ cursor: v > 0 ? 'crosshair' : 'default' }}
                  onMouseEnter={v > 0 ? () => setTooltip({
                    svgX: xp(i), svgY: yp(v),
                    value: v, xLabel: xLabels[i],
                    seriesName: s.name, color: s.color,
                  }) : undefined}
                />
              ))}
            </g>
          );
        })}
        {/* Hover Tooltip */}
        {tooltip && (
          <g pointerEvents="none">
            {/* 連接線 */}
            <line x1={tooltip.svgX} y1={tooltip.svgY - 6}
              x2={tooltip.svgX} y2={PT}
              stroke={tooltip.color} strokeWidth={1} strokeDasharray="3 3" opacity={0.4} />
            {/* 提示框背景 */}
            <rect x={tx} y={ty} width={TW} height={TH} rx={6}
              fill="white" stroke="#e2e8f0" strokeWidth={1.5}
              style={{ filter: 'drop-shadow(0 2px 6px rgba(0,0,0,0.12))' }} />
            {/* 色條 */}
            <rect x={tx} y={ty} width={4} height={TH} rx={3}
              fill={tooltip.color} />
            {/* 系列名 */}
            <text x={tx + 12} y={ty + 18} fontSize="11" fill={tooltip.color} fontWeight="700">
              {tooltip.seriesName}
            </text>
            {/* 月份 + 數值 */}
            <text x={tx + 12} y={ty + 36} fontSize="11" fill="#475569">
              {tooltip.xLabel}：{formatY(tooltip.value)}
            </text>
          </g>
        )}
      </svg>
    </div>
  );
}

// ─── 圖例 ────────────────────────────────────────────────────
function Legend({ series }: { series: ChartSeries[] }) {
  return (
    <div className="flex flex-wrap gap-3 mt-2">
      {series.map(s => (
        <div key={s.name} className="flex items-center gap-1.5 text-xs text-[#4e7397]">
          <span className="inline-block w-4 h-1.5 rounded" style={{ backgroundColor: s.color }} />
          {s.name}
        </div>
      ))}
    </div>
  );
}

// ─── SVG 長條圖（每日）──────────────────────────────────────
function BarChart({ records, valueKey, color }: {
  records: PerformanceRecord[];
  valueKey: keyof PerformanceRecord;
  color: string;
}) {
  if (records.length === 0) return (
    <div className="h-40 flex items-center justify-center text-[#94a3b8] text-sm">暫無資料</div>
  );
  const values = records.map(r => Number(r[valueKey]) || 0);
  const max = Math.max(...values, 1);
  const BAR_W = 36; const GAP = 4; const H = 120;
  const totalW = records.length * (BAR_W + GAP);
  return (
    <div className="overflow-x-auto">
      <svg width={totalW} height={H + 32} style={{ minWidth: '100%', display: 'block' }}
        viewBox={`0 0 ${totalW} ${H + 32}`} preserveAspectRatio="none">
        {records.map((r, i) => {
          const val = values[i];
          const barH = max > 0 ? (val / max) * H : 0;
          const x = i * (BAR_W + GAP); const y = H - barH;
          return (
            <g key={r.rowIndex}>
              <rect x={x} y={y} width={BAR_W} height={barH} fill={color} rx={3} opacity={0.85} />
              {val > 0 && (
                <text x={x + BAR_W / 2} y={Math.max(y - 3, 10)}
                  textAnchor="middle" fontSize="9" fill={color} fontWeight="600">
                  {val >= 10000 ? `${(val / 10000).toFixed(1)}萬` : val}
                </text>
              )}
              <text x={x + BAR_W / 2} y={H + 20} textAnchor="middle" fontSize="10" fill="#94a3b8">
                {r.date.slice(8)}日
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

// ─── 歷史月份長條圖（帶休診淡化）──────────────────────────────
function SimpleBarChart({ items, color }: {
  items: { label: string; value: number; dimmed?: boolean }[];
  color: string;
}) {
  if (items.length === 0) return (
    <div className="h-32 flex items-center justify-center text-[#94a3b8] text-sm">暫無資料</div>
  );
  const max = Math.max(...items.map(i => i.value), 1);
  const BAR_W = 28; const GAP = 3; const H = 110;
  const totalW = Math.max(items.length * (BAR_W + GAP), 320);
  return (
    <div className="overflow-x-auto">
      <svg width={totalW} height={H + 30} style={{ display: 'block' }}
        viewBox={`0 0 ${totalW} ${H + 30}`} preserveAspectRatio="none">
        {items.map((item, i) => {
          const barH = max > 0 ? (item.value / max) * H : 0;
          const x = i * (BAR_W + GAP);
          const y = H - barH;
          const fill = item.dimmed ? '#e2e8f0' : color;
          return (
            <g key={i}>
              <rect x={x} y={y} width={BAR_W} height={barH} fill={fill} rx={2} opacity={0.85} />
              {item.value > 0 && !item.dimmed && (
                <text x={x + BAR_W / 2} y={Math.max(y - 2, 10)}
                  textAnchor="middle" fontSize="8" fill={color} fontWeight="600">
                  {item.value >= 10000 ? `${(item.value / 10000).toFixed(1)}萬` : item.value}
                </text>
              )}
              <text x={x + BAR_W / 2} y={H + 20} textAnchor="middle"
                fontSize="9" fill={item.dimmed ? '#cbd5e1' : '#94a3b8'}>
                {item.label}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

// ─── 歷史資料統計（不含休診）──────────────────────────────────
function computeHistStats(records: HistoricalDayRecord[]) {
  const active = records.filter(r => !r.isHoliday);
  const all    = records;
  const days   = active.length;
  const totalRevenue   = active.reduce((s, r) => s + r.revenue, 0);
  const totalCustomers = active.reduce((s, r) => s + r.totalCustomers, 0);
  const totalSales     = active.reduce((s, r) => s + r.salesCount, 0);
  const rxBreakdown = {
    firstRxLijian: active.reduce((s, r) => s + r.firstRxLijian, 0),
    rx23Lijian:    active.reduce((s, r) => s + r.rx23Lijian, 0),
    lijianRx:      active.reduce((s, r) => s + r.lijianRx, 0),
    externalRx:    active.reduce((s, r) => s + r.externalRx, 0),
    dentalRx:      active.reduce((s, r) => s + r.dentalRx, 0),
    normalRx:      active.reduce((s, r) => s + Math.max(0, r.totalCustomers - r.lijianRx - r.externalRx - r.dentalRx), 0),
  };
  const weatherDays: Record<string, number> = {};
  active.forEach(r => { weatherDays[r.weather] = (weatherDays[r.weather] || 0) + 1; });
  return {
    all, active, days,
    totalRevenue,   avgRevenue:   days ? Math.round(totalRevenue / days)   : 0,
    totalCustomers, avgCustomers: days ? Math.round(totalCustomers / days) : 0,
    totalSales,     rxBreakdown,  weatherDays,
  };
}

// ─── 統計計算 ────────────────────────────────────────────────
function getMonths(records: PerformanceRecord[]): string[] {
  const seen: Record<string, boolean> = {};
  records.forEach(r => {
    const m = r.date.slice(0, 7);
    if (/^\d{4}-\d{2}$/.test(m)) seen[m] = true;  // 過濾非 YYYY-MM 格式
  });
  return Object.keys(seen).sort((a, b) => b.localeCompare(a));
}

function getYears(records: PerformanceRecord[]): number[] {
  const seen: Record<number, boolean> = {};
  records.forEach(r => {
    const y = parseInt(r.date.slice(0, 4));
    if (!isNaN(y) && y > 2000 && y < 2100) seen[y] = true;  // 過濾異常年份
  });
  return Object.keys(seen).map(Number).sort((a, b) => a - b);
}

function computeMonthStats(records: PerformanceRecord[], month: string) {
  const filtered = records.filter(r => r.date.startsWith(month)).sort((a, b) => a.date.localeCompare(b.date));
  const days = filtered.length;
  const totalRevenue = filtered.reduce((s, r) => s + r.revenue, 0);
  const totalCustomers = filtered.reduce((s, r) => s + r.totalCustomers, 0);
  const totalSales = filtered.reduce((s, r) => s + r.salesCount, 0);
  const rxBreakdown = {
    firstRxLijian: filtered.reduce((s, r) => s + r.firstRxLijian, 0),
    rx23Lijian:    filtered.reduce((s, r) => s + r.rx23Lijian, 0),
    lijianRx:      filtered.reduce((s, r) => s + r.lijianRx, 0),
    externalRx:    filtered.reduce((s, r) => s + r.externalRx, 0),
    dentalRx:      filtered.reduce((s, r) => s + r.dentalRx, 0),
    normalRx:      filtered.reduce((s, r) => s + Math.max(0, r.totalCustomers - r.lijianRx - r.externalRx - r.dentalRx), 0),
  };
  const weatherDays = { '晴': 0, '雨': 0, '颱風': 0, '大風': 0 } as Record<WeatherType, number>;
  filtered.forEach(r => { weatherDays[r.weather] = (weatherDays[r.weather] || 0) + 1; });
  return { filtered, days, totalRevenue, avgRevenue: days ? Math.round(totalRevenue / days) : 0,
    totalCustomers, avgCustomers: days ? Math.round(totalCustomers / days) : 0,
    totalSales, rxBreakdown, weatherDays };
}

/** 依年份彙整每月資料，回傳 12 個月的陣列（缺月補 0） */
function yearMonthly(records: PerformanceRecord[], year: number, field: keyof PerformanceRecord) {
  const totals = Array(12).fill(0);
  records.filter(r => r.date.startsWith(String(year))).forEach(r => {
    const m = parseInt(r.date.slice(5, 7)) - 1;
    totals[m] += Number(r[field]) || 0;
  });
  return totals;
}

// ─── 空白表單 ────────────────────────────────────────────────
const emptyForm = {
  date: today, weather: '晴' as WeatherType,
  totalCustomers: 0, firstRxLijian: 0, rx23Lijian: 0,
  lijianRx: 0, externalRx: 0, dentalRx: 0, revenue: 0, salesCount: 0,
};

// ════════════════════════════════════════════════════════════
export default function PerformancePage() {
  const [records, setRecords]         = useState<PerformanceRecord[]>([]);
  const [chronicStats, setChronicStats] = useState<ChronicMonthStat[]>([]);
  const [loading, setLoading]         = useState(true);
  const [saving, setSaving]           = useState(false);
  const [tab, setTab]                 = useState<'input' | 'dashboard' | 'trend' | 'hist'>('input');
  const [toastMsg, setToastMsg]       = useState('');
  const [form, setForm]               = useState(emptyForm);
  const [editTarget, setEditTarget]   = useState<PerformanceRecord | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ rowIndex: number; sourceTab: string } | null>(null);
  const [deleting, setDeleting]       = useState(false);
  const [selectedMonth, setSelectedMonth] = useState('');
  const [viewYear, setViewYear]       = useState(new Date().getFullYear());
  // 年度趨勢 state
  const [trendYears, setTrendYears]   = useState<number[]>([]);
  const [trendMetric, setTrendMetric] = useState<'revenue' | 'totalCustomers' | 'rx'>('revenue');
  const [printTarget, setPrintTarget] = useState<'monthly' | 'annual'>('monthly');
  const [loadError, setLoadError]     = useState('');
  // 歷史查詢 state
  const [availableTabs, setAvailableTabs]       = useState<string[]>([]);
  const [selectedHistTab, setSelectedHistTab]   = useState('');
  const [histRecords, setHistRecords]           = useState<HistoricalDayRecord[]>([]);
  const [histLoading, setHistLoading]           = useState(false);
  const [initingTab, setInitingTab]             = useState<string | null>(null);

  const showToast = (msg: string) => { setToastMsg(msg); setTimeout(() => setToastMsg(''), 3500); };

  const loadAll = useCallback(async () => {
    setLoadError('');
    try {
      const [pRes, cRes] = await Promise.all([
        fetch('/api/performance').then(r => r.json()).catch(e => ({ success: false, error: String(e) })),
        fetch('/api/chronic-stats').then(r => r.json()).catch(e => ({ success: false, error: String(e) })),
      ]);
      if (pRes.success) {
        const recs: PerformanceRecord[] = pRes.data ?? [];
        setRecords(recs);
        const months = getMonths(recs);
        // 預設選最新月份（不鎖在可能無資料的當月）
        setSelectedMonth(months[0] ?? '');
        // 預設選最新年份
        const years = getYears(recs);
        setTrendYears(years.length > 0 ? [years[years.length - 1]] : []);
      } else {
        setLoadError(`業績資料載入失敗：${pRes.error ?? '未知錯誤'}（請確認試算表分頁名稱為「業績記錄」）`);
      }
      // 讀取歷史分頁清單
      const tabsRes = await fetch('/api/historical-performance')
        .then(r => r.json()).catch(() => ({ success: false }));
      if (tabsRes.success) {
        const tabs: string[] = tabsRes.data ?? [];
        setAvailableTabs(tabs);
        if (tabs.length > 0) {
          const latest = tabs[tabs.length - 1];
          setSelectedHistTab(latest);
          // 預載最新月份
          fetch(`/api/historical-performance?tab=${latest}`)
            .then(r => r.json())
            .then(res => { if (res.success) setHistRecords(res.data ?? []); })
            .catch(() => {});
        }
      }

      if (cRes.success) {
        const chronicData: ChronicMonthStat[] = cRes.data ?? [];
        setChronicStats(chronicData);
        // 業績無資料時，用慢箋年份初始化 trendYears，讓年度折線仍能顯示
        if (!pRes.success || (pRes.data ?? []).length === 0) {
          const seenCY: Record<number, boolean> = {};
          chronicData.forEach(s => { seenCY[parseInt(s.month.slice(0, 4))] = true; });
          const chronicYearsArr = Object.keys(seenCY).map(Number).sort((a, b) => a - b);
          if (chronicYearsArr.length > 0) setTrendYears(chronicYearsArr.slice(-3));
        }
      } else if (!pRes.success) {
        // 僅在兩個都失敗時附加第二條錯誤（避免訊息過長）
        setLoadError(prev => prev + `\n慢箋統計載入失敗：${cRes.error ?? '未知錯誤'}`);
      }
    } catch (err) {
      setLoadError(`網路錯誤：${String(err)}`);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setSaving(true);
    try {
      const endpoint = '/api/performance';
      const method = editTarget ? 'PUT' : 'POST';
      const body = editTarget
        ? { ...form, rowIndex: editTarget.rowIndex, sourceTab: editTarget.sourceTab }
        : form;
      const res = await fetch(endpoint, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const data = await res.json();
      if (data.success) {
        setEditTarget(null); setForm(emptyForm); await loadAll();
        showToast(editTarget ? `✅ 已更新 ${form.date} 業績` : `✅ 已新增 ${form.date} 業績`);
      } else showToast(`❌ 操作失敗：${data.error}`);
    } finally { setSaving(false); }
  };

  const handleEdit = (r: PerformanceRecord) => {
    setEditTarget(r);
    setForm({ date: r.date, weather: r.weather, totalCustomers: r.totalCustomers,
      firstRxLijian: r.firstRxLijian, rx23Lijian: r.rx23Lijian, lijianRx: r.lijianRx,
      externalRx: r.externalRx, dentalRx: r.dentalRx, revenue: r.revenue, salesCount: r.salesCount });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = async () => {
    if (!deleteTarget) return; setDeleting(true);
    try {
      const res = await fetch('/api/performance', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rowIndex: deleteTarget.rowIndex, sourceTab: deleteTarget.sourceTab }),
      });
      const data = await res.json();
      if (data.success) { setDeleteTarget(null); await loadAll(); showToast('已刪除紀錄'); }
      else { showToast(`❌ 刪除失敗：${data.error}`); setDeleteTarget(null); }
    } finally { setDeleting(false); }
  };

  const loadHistMonth = async (tab: string) => {
    if (!tab) return;
    setHistLoading(true);
    setHistRecords([]);
    try {
      const res = await fetch(`/api/historical-performance?tab=${tab}`).then(r => r.json());
      if (res.success) setHistRecords(res.data ?? []);
      else showToast(`載入失敗：${res.error}`);
    } finally { setHistLoading(false); }
  };

  // ── 初始化 YYYYMM 月份骨架 ──
  const handleInitMonth = async (tabName: string) => {
    if (initingTab) return;
    const y = tabName.slice(0, 4);
    const m = parseInt(tabName.slice(4));
    if (!window.confirm(`確定要為 ${y} 年 ${m} 月建立全月骨架資料嗎？\n（將預填該月所有日期與星期，數值欄位留空）`)) return;
    setInitingTab(tabName);
    try {
      const res = await fetch('/api/historical-performance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tab: tabName }),
      }).then(r => r.json());
      if (res.success) {
        showToast(`✅ ${y} 年 ${m} 月已建立，共新增 ${res.data.rowsAdded} 列`);
        // 重新載入可用分頁列表
        const tabsRes = await fetch('/api/historical-performance').then(r => r.json());
        if (tabsRes.success) setAvailableTabs(tabsRes.data ?? []);
        // 自動切換到新月份
        setSelectedHistTab(tabName);
        loadHistMonth(tabName);
      } else {
        showToast(`❌ 建立失敗：${res.error}`);
      }
    } finally {
      setInitingTab(null);
    }
  };

  const handlePrint = (target: 'monthly' | 'annual') => { setPrintTarget(target); setTimeout(() => window.print(), 100); };

  // ── 衍生資料 ──
  const months = getMonths(records);
  const allYears = getYears(records);
  const stats = selectedMonth ? computeMonthStats(records, selectedMonth) : null;
  const allMonthsInYear = Array.from({ length: 12 }, (_, i) => `${viewYear}-${String(i + 1).padStart(2, '0')}`);

  // 年度趨勢折線資料
  const trendSeries: ChartSeries[] = trendYears.map(y => ({
    name: `${y}年`,
    color: yearColor(y),
    data: trendMetric === 'rx'
      ? yearMonthly(records, y, 'lijianRx').map((v, i) =>
          v + (yearMonthly(records, y, 'externalRx')[i] || 0))
      : yearMonthly(records, y, trendMetric),
  }));

  // 慢箋年度折線
  const chronicYears = Array.from(new Set(chronicStats.map(s => parseInt(s.month.slice(0, 4))))).sort();
  const selectedChronicYears = trendYears.filter(y => chronicYears.includes(y));
  const chronicSeries: ChartSeries[] = selectedChronicYears.map(y => ({
    name: `${y}年`,
    color: yearColor(y),
    data: Array.from({ length: 12 }, (_, i) => {
      const m = `${y}-${String(i + 1).padStart(2, '0')}`;
      return chronicStats.find(s => s.month === m)?.newPatients ?? 0;
    }),
  }));
  // 若無選中年份顯示全部年份的慢箋統計
  const chronicDisplaySeries = chronicSeries.length > 0 ? chronicSeries : chronicYears.slice(-3).map(y => ({
    name: `${y}年`, color: yearColor(y),
    data: Array.from({ length: 12 }, (_, i) => {
      const m = `${y}-${String(i + 1).padStart(2, '0')}`;
      return chronicStats.find(s => s.month === m)?.newPatients ?? 0;
    }),
  }));

  const sortedRecords = [...records].sort((a, b) => b.date.localeCompare(a.date));

  if (loading) return (
    <div className="flex items-center justify-center h-64 text-[#4e7397]">
      <svg className="animate-spin w-6 h-6 mr-2" viewBox="0 0 24 24" fill="none">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
      </svg>讀取資料中...
    </div>
  );

  return (
    <div className="space-y-6">
      {toastMsg && (
        <div className="fixed top-4 right-4 z-50 bg-[#0e141b] text-white text-sm px-4 py-2.5 rounded-lg shadow-lg print:hidden">
          {toastMsg}
        </div>
      )}

      <div className="print:hidden">
        <h1 className="text-2xl font-bold text-[#0e141b]">業績管理</h1>
        <p className="text-sm text-[#4e7397] mt-1">每日業績記錄、月度儀表板與年度趨勢分析</p>
      </div>

      {/* 錯誤提示 */}
      {loadError && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 print:hidden">
          <div className="flex items-start gap-3">
            <span className="text-red-500 text-xl mt-0.5">⚠️</span>
            <div>
              <p className="font-semibold text-red-700 text-sm">資料載入失敗</p>
              {loadError.split('\n').map((line, i) => (
                <p key={i} className="text-red-600 text-sm mt-1 font-mono">{line}</p>
              ))}
              <p className="text-red-500 text-xs mt-2">
                💡 請確認 Google 試算表中有分頁名稱為「<strong>業績記錄</strong>」（記 = 記錄的記），
                並確認服務帳號已有該試算表的編輯權限。
              </p>
              <button onClick={loadAll} className="mt-2 text-xs text-red-600 underline">重新載入</button>
            </div>
          </div>
        </div>
      )}

      {/* Tab 切換 */}
      <div className="flex gap-2 border-b border-[#e7edf3] print:hidden">
        {([
          ['input',     '📋 每日記錄'],
          ['dashboard', '📊 月度儀表板'],
          ['trend',     '📈 年度趨勢'],
          ['hist',      '📚 歷史查詢'],
        ] as const).map(([val, label]) => (
          <button key={val} onClick={() => setTab(val)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${tab === val ? 'border-primary text-primary' : 'border-transparent text-[#4e7397] hover:text-[#0e141b]'}`}>
            {label}
          </button>
        ))}
      </div>

      {/* ══════ 每日記錄 Tab ══════ */}
      {tab === 'input' && (
        <div className="space-y-6 print:hidden">
          <div className="card">
            <h2 className="font-bold text-[#0e141b] mb-4">
              {editTarget ? `✏️ 編輯紀錄：${editTarget.date}` : '📝 新增每日業績'}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
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
                        className={`px-3 py-2 rounded-lg text-sm font-medium border transition-colors ${form.weather === w.value ? w.active : 'bg-white text-[#4e7397] border-[#e7edf3] hover:bg-[#f8fafc]'}`}>
                        {w.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                <div><label>總人數</label><input type="number" min={0} value={form.totalCustomers} onChange={e => setForm(f => ({ ...f, totalCustomers: Number(e.target.value) }))} /></div>
                <div><label>銷售人數</label><input type="number" min={0} value={form.salesCount} onChange={e => setForm(f => ({ ...f, salesCount: Number(e.target.value) }))} /></div>
                <div><label>營業額（元）</label><input type="number" min={0} value={form.revenue} onChange={e => setForm(f => ({ ...f, revenue: Number(e.target.value) }))} /></div>
              </div>
              <div>
                <p className="text-xs font-semibold text-[#4e7397] uppercase tracking-wide mb-2">慢箋分類人數</p>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                  {RX_FIELDS.map(f => (
                    <div key={f.key}>
                      <label>{f.label}</label>
                      <input type="number" min={0} value={form[f.key]}
                        onChange={e => setForm(prev => ({ ...prev, [f.key]: Number(e.target.value) }))} />
                    </div>
                  ))}
                </div>
              </div>
              <div className="flex gap-3 justify-end">
                {editTarget && (
                  <button type="button" onClick={() => { setEditTarget(null); setForm(emptyForm); }} className="btn-secondary">取消編輯</button>
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
                <thead><tr>
                  <th>日期</th><th>天氣</th><th>總人數</th><th>立健首次</th><th>2/3次</th>
                  <th>立健慢箋</th><th>外來慢箋</th><th>牙科箋</th><th>銷售</th><th>營業額</th><th></th>
                </tr></thead>
                <tbody>
                  {sortedRecords.length === 0 ? (
                    <tr><td colSpan={11} className="text-center py-12 text-[#94a3b8]">尚無業績紀錄，請從上方新增</td></tr>
                  ) : sortedRecords.map(r => (
                    <tr key={r.rowIndex}>
                      <td className="font-medium whitespace-nowrap">{r.date}</td>
                      <td className="whitespace-nowrap">{r.weather === '晴' ? '☀️' : r.weather === '雨' ? '🌧️' : r.weather === '颱風' ? '🌀' : '💨'} {r.weather}</td>
                      <td>{r.totalCustomers}</td><td>{r.firstRxLijian}</td><td>{r.rx23Lijian}</td>
                      <td>{r.lijianRx}</td><td>{r.externalRx}</td><td>{r.dentalRx}</td>
                      <td>{r.salesCount}</td>
                      <td className="font-semibold text-[#197fe6] whitespace-nowrap">${r.revenue.toLocaleString()}</td>
                      <td>
                        <div className="flex gap-1">
                          <button onClick={() => handleEdit(r)} className="text-[#94a3b8] hover:text-[#197fe6] p-1" title="編輯">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                            </svg>
                          </button>
                          <button onClick={() => setDeleteTarget({ rowIndex: r.rowIndex, sourceTab: r.sourceTab })} className="text-[#94a3b8] hover:text-red-500 p-1" title="刪除">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/>
                            </svg>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ══════ 月度儀表板 Tab ══════ */}
      {tab === 'dashboard' && (
        <div className="space-y-6">
          <div className="flex flex-wrap items-center gap-3 print:hidden">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-[#4e7397]">月份：</span>
              {months.length > 0 ? (
                <select value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)} className="w-40">
                  {months.map(m => <option key={m} value={m}>{m.slice(0,4)}年{parseInt(m.slice(5))}月</option>)}
                </select>
              ) : (
                <span className="text-sm text-[#94a3b8]">（試算表「業績記錄」分頁尚無資料）</span>
              )}
            </div>
            <button onClick={() => handlePrint('monthly')}
              className="btn-secondary flex items-center gap-2 ml-auto">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/>
              </svg>
              列印月報 PDF
            </button>
          </div>

          {stats && stats.days > 0 ? (
            <div id="print-monthly" className="space-y-6">
              {/* 列印標題 */}
              <div className="hidden print:block mb-6 text-center border-b-2 pb-4">
                <h1 className="text-3xl font-bold">立安藥局 業績月報</h1>
                <p className="text-gray-600 mt-2 text-xl">{selectedMonth.slice(0,4)} 年 {parseInt(selectedMonth.slice(5))} 月</p>
                <p className="text-gray-400 text-sm mt-1">列印日期：{new Date().toLocaleDateString('zh-TW')}</p>
              </div>

              {/* 摘要卡片 */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  { label: '本月總營業額', value: `$${stats.totalRevenue.toLocaleString()}`, sub: `日均 $${stats.avgRevenue.toLocaleString()}`, color: 'text-blue-600', bg: 'bg-blue-50' },
                  { label: '總來客人數',   value: stats.totalCustomers.toLocaleString(), sub: `日均 ${stats.avgCustomers} 人`, color: 'text-emerald-600', bg: 'bg-emerald-50' },
                  { label: '銷售人數',     value: stats.totalSales.toLocaleString(), sub: `日均 ${stats.days ? Math.round(stats.totalSales / stats.days) : 0} 人`, color: 'text-violet-600', bg: 'bg-violet-50' },
                  { label: '記錄天數',     value: `${stats.days} 天`, sub: `${selectedMonth.slice(0,4)}年${parseInt(selectedMonth.slice(5))}月`, color: 'text-amber-600', bg: 'bg-amber-50' },
                ].map(c => (
                  <div key={c.label} className={`card ${c.bg} border-0`}>
                    <p className="text-xs text-[#4e7397] mb-1">{c.label}</p>
                    <p className={`text-2xl font-bold ${c.color}`}>{c.value}</p>
                    <p className="text-xs text-[#94a3b8] mt-1">{c.sub}</p>
                  </div>
                ))}
              </div>

              {/* 每日營業額 */}
              <div className="card">
                <h3 className="font-semibold text-[#0e141b] mb-4">📈 每日營業額（元）</h3>
                <BarChart records={stats.filtered} valueKey="revenue" color="#197fe6" />
              </div>

              {/* 每日來客 */}
              <div className="card">
                <h3 className="font-semibold text-[#0e141b] mb-4">👥 每日來客人數</h3>
                <BarChart records={stats.filtered} valueKey="totalCustomers" color="#10b981" />
              </div>

              {/* 慢箋 + 天氣 */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="card">
                  <h3 className="font-semibold text-[#0e141b] mb-4">💊 處方箋統計</h3>
                  <div className="space-y-3">
                    {([
                      ...RX_FIELDS,
                      { key: 'normalRx', label: '一般箋', color: '#64748b' },
                    ] as { key: string; label: string; color: string }[]).map(f => {
                      const count = (stats.rxBreakdown as Record<string, number>)[f.key] ?? 0;
                      const pct = stats.totalCustomers > 0 ? Math.round((count / stats.totalCustomers) * 100) : 0;
                      return (
                        <div key={f.key}>
                          <div className="flex justify-between text-sm mb-1">
                            <span className="text-[#4e7397]">{f.label}</span>
                            <span className="font-semibold" style={{ color: f.color }}>{count} 人（{pct}%）</span>
                          </div>
                          <div className="h-2 bg-[#f1f5f9] rounded-full overflow-hidden">
                            <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: f.color }} />
                          </div>
                        </div>
                      );
                    })}
                    <div className="pt-2 border-t border-[#f1f5f9] text-sm text-[#4e7397]">
                      總人數：{stats.totalCustomers} 人
                    </div>
                  </div>
                </div>
                <div className="card">
                  <h3 className="font-semibold text-[#0e141b] mb-4">🌤️ 天氣分佈</h3>
                  <div className="space-y-3">
                    {WEATHER_OPTIONS.map(w => {
                      const d = stats.weatherDays[w.value] || 0;
                      const pct = stats.days > 0 ? Math.round((d / stats.days) * 100) : 0;
                      return (
                        <div key={w.value}>
                          <div className="flex justify-between text-sm mb-1">
                            <span className="text-[#4e7397]">{w.label}</span>
                            <span className="font-semibold text-[#0e141b]">{d} 天（{pct}%）</span>
                          </div>
                          <div className="h-2 bg-[#f1f5f9] rounded-full overflow-hidden">
                            <div className="h-full rounded-full bg-[#197fe6]" style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* 每日明細表 */}
              <div className="card p-0 overflow-hidden">
                <div className="px-6 py-4 border-b border-[#e7edf3]"><h3 className="font-semibold text-[#0e141b]">📋 每日明細</h3></div>
                <div className="overflow-x-auto">
                  <table>
                    <thead><tr>
                      <th>日期</th><th>天氣</th><th>總人數</th><th>立健首次</th><th>2/3次</th>
                      <th>立健慢箋</th><th>外來慢箋</th><th>牙科箋</th><th>銷售</th><th>營業額</th>
                    </tr></thead>
                    <tbody>
                      {stats.filtered.map(r => (
                        <tr key={r.rowIndex}>
                          <td className="whitespace-nowrap">{r.date}</td>
                          <td>{r.weather === '晴' ? '☀️' : r.weather === '雨' ? '🌧️' : r.weather === '颱風' ? '🌀' : '💨'} {r.weather}</td>
                          <td>{r.totalCustomers}</td><td>{r.firstRxLijian}</td><td>{r.rx23Lijian}</td>
                          <td>{r.lijianRx}</td><td>{r.externalRx}</td><td>{r.dentalRx}</td>
                          <td>{r.salesCount}</td>
                          <td className="font-semibold text-[#197fe6]">${r.revenue.toLocaleString()}</td>
                        </tr>
                      ))}
                      <tr className="bg-[#f8fafc] font-bold text-[#0e141b]">
                        <td>合計</td><td>—</td><td>{stats.totalCustomers}</td>
                        <td>{stats.rxBreakdown.firstRxLijian}</td><td>{stats.rxBreakdown.rx23Lijian}</td>
                        <td>{stats.rxBreakdown.lijianRx}</td><td>{stats.rxBreakdown.externalRx}</td>
                        <td>{stats.rxBreakdown.dentalRx}</td><td>{stats.totalSales}</td>
                        <td className="text-[#197fe6]">${stats.totalRevenue.toLocaleString()}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* 年度月份格狀概覽 */}
              <div className="card print:hidden">
                <div className="flex items-center gap-3 mb-4">
                  <h3 className="font-semibold text-[#0e141b]">📅 {viewYear} 年月度業績概覽</h3>
                  <div className="flex gap-1 ml-auto">
                    <button onClick={() => setViewYear(y => y - 1)} className="btn-secondary px-2 py-1 text-xs">◀</button>
                    <button onClick={() => setViewYear(y => y + 1)} className="btn-secondary px-2 py-1 text-xs">▶</button>
                  </div>
                </div>
                <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                  {allMonthsInYear.map(m => {
                    const ms = computeMonthStats(records, m);
                    const hasData = ms.days > 0; const isCurrent = m === selectedMonth;
                    return (
                      <button key={m} disabled={!hasData} onClick={() => setSelectedMonth(m)}
                        className={`p-3 rounded-lg border text-left transition-colors ${isCurrent ? 'border-primary bg-[#e8f0fe]' : hasData ? 'border-[#e7edf3] bg-white hover:border-primary hover:bg-[#f0f7ff]' : 'border-dashed border-[#e7edf3] bg-[#f8fafc] opacity-50 cursor-default'}`}>
                        <p className={`text-xs font-medium ${isCurrent ? 'text-primary' : 'text-[#4e7397]'}`}>{parseInt(m.slice(5))} 月</p>
                        {hasData ? (
                          <>
                            <p className="text-sm font-bold text-[#0e141b] mt-1">{ms.totalRevenue >= 10000 ? `$${(ms.totalRevenue / 10000).toFixed(1)}萬` : `$${ms.totalRevenue.toLocaleString()}`}</p>
                            <p className="text-xs text-[#94a3b8]">{ms.days} 天</p>
                          </>
                        ) : <p className="text-xs text-[#94a3b8] mt-1">無資料</p>}
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

      {/* ══════ 年度趨勢 Tab ══════ */}
      {tab === 'trend' && (
        <div className="space-y-6">
          {/* 工具列 */}
          <div className="card p-4 flex flex-wrap gap-4 items-start print:hidden">
            {/* 年份選擇 */}
            <div>
              <p className="text-xs font-semibold text-[#4e7397] mb-2 uppercase tracking-wide">選擇年份（可複選）</p>
              <div className="flex flex-wrap gap-2">
                {allYears.map(y => (
                  <button key={y} onClick={() => setTrendYears(prev =>
                    prev.includes(y) ? prev.filter(x => x !== y) : [...prev, y].sort())}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${trendYears.includes(y) ? 'text-white border-transparent' : 'bg-white text-[#4e7397] border-[#e7edf3] hover:bg-[#f8fafc]'}`}
                    style={trendYears.includes(y) ? { backgroundColor: yearColor(y) } : {}}>
                    {y}
                  </button>
                ))}
              </div>
            </div>
            {/* 指標選擇 */}
            <div>
              <p className="text-xs font-semibold text-[#4e7397] mb-2 uppercase tracking-wide">業績指標</p>
              <div className="flex gap-2">
                {([
                  ['revenue', '💰 營業額'],
                  ['totalCustomers', '👥 來客數'],
                  ['rx', '💊 慢箋合計'],
                ] as const).map(([val, label]) => (
                  <button key={val} onClick={() => setTrendMetric(val)}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${trendMetric === val ? 'bg-[#197fe6] text-white border-transparent' : 'bg-white text-[#4e7397] border-[#e7edf3] hover:bg-[#f8fafc]'}`}>
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <button onClick={() => handlePrint('annual')} className="btn-secondary flex items-center gap-2 ml-auto self-end">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/>
              </svg>
              列印年度報表
            </button>
          </div>

          <div id="print-annual" className="space-y-6">
            {/* 列印年度標題 */}
            <div className="hidden print:block mb-6 text-center border-b-2 pb-4">
              <h1 className="text-3xl font-bold">立安藥局 年度業績趨勢報表</h1>
              <p className="text-gray-600 mt-2">{trendYears.join('、')} 年</p>
              <p className="text-gray-400 text-sm mt-1">列印日期：{new Date().toLocaleDateString('zh-TW')}</p>
            </div>

            {/* 年度摘要卡片 */}
            {trendYears.length > 0 && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {trendYears.map(y => {
                  const yRecs = records.filter(r => r.date.startsWith(String(y)));
                  const rev = yRecs.reduce((s, r) => s + r.revenue, 0);
                  const cust = yRecs.reduce((s, r) => s + r.totalCustomers, 0);
                  const rxTotal = yRecs.reduce((s, r) => s + r.lijianRx + r.externalRx, 0);
                  return (
                    <div key={y} className="card border-l-4 year-summary-card" style={{ borderLeftColor: yearColor(y) }}>
                      <p className="text-sm font-bold" style={{ color: yearColor(y) }}>{y} 年</p>
                      <p className="text-xl font-bold text-[#0e141b] mt-1">
                        {rev >= 10000 ? `$${(rev / 10000).toFixed(1)}萬` : `$${rev.toLocaleString()}`}
                      </p>
                      <p className="text-xs text-[#94a3b8] mt-1">{cust.toLocaleString()} 人次 ・ {rxTotal} 張慢箋</p>
                    </div>
                  );
                })}
              </div>
            )}

            {/* 業績折線圖 */}
            <div className="card">
              <h3 className="font-semibold text-[#0e141b] mb-1">
                {trendMetric === 'revenue' ? '📈 月營業額趨勢（元）'
                  : trendMetric === 'totalCustomers' ? '👥 月來客數趨勢'
                  : '💊 月慢箋合計趨勢'}
              </h3>
              <Legend series={trendSeries} />
              <div className="mt-4">
                <MultiLineChart
                  series={trendSeries}
                  xLabels={MONTH_LABELS}
                  height={220}
                  formatY={trendMetric === 'revenue'
                    ? (v) => v >= 10000 ? `${(v / 10000).toFixed(0)}萬` : String(v)
                    : undefined}
                />
              </div>
            </div>

            {/* 慢箋各類 + 一般箋折線圖（固定顯示）*/}
            {trendYears.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 rx-charts-grid">
                {RX_FIELDS.map(f => {
                  const rxSeries: ChartSeries[] = trendYears.map(y => ({
                    name: `${y}年`, color: yearColor(y),
                    data: yearMonthly(records, y, f.key),
                  }));
                  return (
                    <div key={f.key} className="card chart-block">
                      <h3 className="font-semibold text-[#0e141b] mb-1 text-sm">{f.label} 月趨勢</h3>
                      <Legend series={rxSeries} />
                      <div className="mt-3">
                        <MultiLineChart series={rxSeries} xLabels={MONTH_LABELS} height={160} />
                      </div>
                    </div>
                  );
                })}
                {/* 一般箋月趨勢 */}
                {(() => {
                  const normalSeries: ChartSeries[] = trendYears.map(y => {
                    const tc  = yearMonthly(records, y, 'totalCustomers');
                    const lj  = yearMonthly(records, y, 'lijianRx');
                    const ext = yearMonthly(records, y, 'externalRx');
                    const dnt = yearMonthly(records, y, 'dentalRx');
                    return {
                      name: `${y}年`,
                      color: yearColor(y),
                      data: tc.map((v, i) => Math.max(0, v - (lj[i] || 0) - (ext[i] || 0) - (dnt[i] || 0))),
                    };
                  });
                  return (
                    <div className="card chart-block">
                      <h3 className="font-semibold text-[#0e141b] mb-1 text-sm">一般箋 月趨勢</h3>
                      <Legend series={normalSeries} />
                      <div className="mt-3">
                        <MultiLineChart series={normalSeries} xLabels={MONTH_LABELS} height={160} />
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}

            {/* 慢箋統計年度趨勢（從個案紀錄彙算） */}
            {chronicStats.length > 0 && (
              <div className="card chronic-table-section">
                <h3 className="font-semibold text-[#0e141b] mb-1">📋 慢箋首次領藥人次年度趨勢（{Math.min(...chronicYears)}～{Math.max(...chronicYears)}）</h3>
                <p className="text-xs text-[#94a3b8] mb-3">資料來源：慢箋管理個案紀錄 / 首次領藥日統計</p>
                {/* 年份選擇（只顯示有資料的年份） */}
                <div className="flex flex-wrap gap-2 mb-4 print:hidden">
                  {chronicYears.map(y => (
                    <button key={y} onClick={() => setTrendYears(prev =>
                      prev.includes(y) ? prev.filter(x => x !== y) : [...prev, y].sort())}
                      className={`px-2.5 py-1 rounded text-xs font-medium border transition-colors ${trendYears.includes(y) ? 'text-white border-transparent' : 'bg-white text-[#4e7397] border-[#e7edf3]'}`}
                      style={trendYears.includes(y) ? { backgroundColor: yearColor(y) } : {}}>
                      {y}
                    </button>
                  ))}
                </div>
                <Legend series={chronicDisplaySeries} />
                <div className="mt-3">
                  <MultiLineChart series={chronicDisplaySeries} xLabels={MONTH_LABELS} height={220} />
                </div>

                {/* 年度慢箋統計彙整表 */}
                <div className="mt-6 overflow-x-auto">
                  <table>
                    <thead><tr>
                      <th>年份</th>
                      {MONTH_LABELS.map(m => <th key={m}>{m}</th>)}
                      <th>全年合計</th>
                    </tr></thead>
                    <tbody>
                      {chronicYears.map(y => {
                        const monthData = Array.from({ length: 12 }, (_, i) => {
                          const m = `${y}-${String(i + 1).padStart(2, '0')}`;
                          return chronicStats.find(s => s.month === m)?.newPatients ?? 0;
                        });
                        const total = monthData.reduce((a, b) => a + b, 0);
                        return (
                          <tr key={y}>
                            <td className="font-semibold" style={{ color: yearColor(y) }}>{y}</td>
                            {monthData.map((v, i) => (
                              <td key={i} className={v > 0 ? 'font-medium' : 'text-[#94a3b8]'}>{v || '-'}</td>
                            ))}
                            <td className="font-bold text-[#0e141b]">{total}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ══════ 歷史查詢 Tab ══════ */}
      {tab === 'hist' && (() => {
        // 依年份分組月份清單
        const histYearGroups: Record<number, string[]> = {};
        availableTabs.forEach(t => {
          const y = parseInt(t.slice(0, 4));
          if (!histYearGroups[y]) histYearGroups[y] = [];
          histYearGroups[y].push(t);
        });
        const histYears = Object.keys(histYearGroups).map(Number).sort((a, b) => a - b);
        const hStats = histRecords.length > 0 ? computeHistStats(histRecords) : null;
        const selYear  = selectedHistTab ? parseInt(selectedHistTab.slice(0, 4)) : 0;
        const selMonth = selectedHistTab ? parseInt(selectedHistTab.slice(4, 6)) : 0;

        return (
          <div className="space-y-6">
            {/* 月份選擇格狀 */}
            <div className="card">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-[#0e141b]">📅 選擇查詢月份</h3>
                <span className="text-xs text-[#94a3b8]">綠色虛線 ＋ 月份 → 點擊自動建立全月骨架</span>
              </div>
              {availableTabs.length === 0 ? (
                <p className="text-sm text-[#94a3b8]">找不到 YYYYMM 格式的分頁，請確認試算表分頁名稱為 6 位數字（如 202601）。</p>
              ) : (
                <div className="space-y-4">
                  {histYears.map(y => (
                    <div key={y}>
                      <p className="text-xs font-semibold text-[#4e7397] uppercase tracking-wide mb-2">{y} 年</p>
                      <div className="flex flex-wrap gap-2">
                        {Array.from({ length: 12 }, (_, i) => {
                          const tabName   = `${y}${String(i + 1).padStart(2, '0')}`;
                          const has       = histYearGroups[y]?.includes(tabName);
                          const isSel     = selectedHistTab === tabName;
                          const isIniting = initingTab === tabName;
                          return (
                            <button
                              key={tabName}
                              disabled={isIniting}
                              onClick={() => {
                                if (has) {
                                  setSelectedHistTab(tabName);
                                  loadHistMonth(tabName);
                                } else {
                                  handleInitMonth(tabName);
                                }
                              }}
                              title={has ? `查看 ${i + 1} 月` : `點擊建立 ${i + 1} 月骨架`}
                              className={`w-14 py-1.5 rounded-lg text-sm font-medium border transition-all ${
                                isSel      ? 'bg-[#197fe6] text-white border-transparent shadow-sm'
                                : isIniting ? 'bg-[#f0fdf4] text-[#94a3b8] border-[#bbf7d0] cursor-wait animate-pulse'
                                : has       ? 'bg-white text-[#4e7397] border-[#e7edf3] hover:border-[#197fe6] hover:text-[#197fe6]'
                                :             'bg-[#f0fdf4] text-[#16a34a] border-dashed border-[#86efac] hover:bg-[#dcfce7] cursor-pointer'
                              }`}>
                              {isIniting ? '…' : has ? `${i + 1}月` : `＋${i + 1}月`}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 載入中 */}
            {histLoading && (
              <div className="flex items-center gap-2 text-[#4e7397] text-sm">
                <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                </svg>
                載入 {selYear} 年 {selMonth} 月資料中…
              </div>
            )}

            {/* 儀表板 */}
            {!histLoading && hStats && (
              <div className="space-y-5">
                {/* 標題列 */}
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-[#0e141b] text-lg">
                    {selYear} 年 {selMonth} 月業績總覽
                    <span className="ml-2 text-sm font-normal text-[#94a3b8]">（共 {hStats.all.length} 天，營業 {hStats.days} 天）</span>
                  </h3>
                  <button onClick={() => handlePrint('monthly')} className="btn-secondary flex items-center gap-2 print:hidden text-sm">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/>
                    </svg>
                    列印報表
                  </button>
                </div>

                {/* 摘要卡片 */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {[
                    { label: '本月總營業額', value: `$${hStats.totalRevenue.toLocaleString()}`, sub: `日均 $${hStats.avgRevenue.toLocaleString()}`, color: 'text-blue-600', bg: 'bg-blue-50' },
                    { label: '總來客人數',   value: hStats.totalCustomers.toLocaleString(),   sub: `日均 ${hStats.avgCustomers} 人`,         color: 'text-emerald-600', bg: 'bg-emerald-50' },
                    { label: '銷售人數',     value: hStats.totalSales.toLocaleString(),       sub: `日均 ${hStats.days ? Math.round(hStats.totalSales / hStats.days) : 0} 人`, color: 'text-violet-600', bg: 'bg-violet-50' },
                    { label: '營業天數',     value: `${hStats.days} 天`,                      sub: `${hStats.all.length - hStats.days} 天休診`, color: 'text-amber-600',   bg: 'bg-amber-50' },
                  ].map(c => (
                    <div key={c.label} className={`card ${c.bg} border-0 p-4`}>
                      <p className="text-xs text-[#4e7397] mb-1">{c.label}</p>
                      <p className={`text-xl font-bold ${c.color}`}>{c.value}</p>
                      <p className="text-xs text-[#94a3b8] mt-0.5">{c.sub}</p>
                    </div>
                  ))}
                </div>

                {/* 每日營業額長條圖 */}
                <div className="card">
                  <h4 className="font-semibold text-[#0e141b] mb-3 text-sm">📈 每日營業額（元）</h4>
                  <SimpleBarChart color="#197fe6" items={hStats.all.map(r => ({
                    label: r.date.slice(8).replace(/^0/, '') + '日',
                    value: r.revenue,
                    dimmed: r.isHoliday,
                  }))} />
                </div>

                {/* 每日來客長條圖 */}
                <div className="card">
                  <h4 className="font-semibold text-[#0e141b] mb-3 text-sm">👥 每日來客人數</h4>
                  <SimpleBarChart color="#10b981" items={hStats.all.map(r => ({
                    label: r.date.slice(8).replace(/^0/, '') + '日',
                    value: r.totalCustomers,
                    dimmed: r.isHoliday,
                  }))} />
                </div>

                {/* 慢箋分類 + 天氣分佈 */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="card">
                    <h4 className="font-semibold text-[#0e141b] mb-3 text-sm">💊 處方箋統計</h4>
                    <div className="space-y-2.5">
                      {([
                        ...RX_FIELDS,
                        { key: 'normalRx', label: '一般箋', color: '#64748b' },
                      ] as { key: string; label: string; color: string }[]).map(f => {
                        const count = (hStats.rxBreakdown as Record<string, number>)[f.key] ?? 0;
                        const pct = hStats.totalCustomers > 0 ? Math.round((count / hStats.totalCustomers) * 100) : 0;
                        return (
                          <div key={f.key}>
                            <div className="flex justify-between text-sm mb-1">
                              <span className="text-[#4e7397] text-xs">{f.label}</span>
                              <span className="font-semibold text-xs" style={{ color: f.color }}>{count} 人（{pct}%）</span>
                            </div>
                            <div className="h-1.5 bg-[#f1f5f9] rounded-full overflow-hidden">
                              <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: f.color }} />
                            </div>
                          </div>
                        );
                      })}
                      <p className="text-xs text-[#94a3b8] pt-1 border-t border-[#f1f5f9]">
                        總人數：{hStats.totalCustomers} 人
                      </p>
                    </div>
                  </div>
                  <div className="card">
                    <h4 className="font-semibold text-[#0e141b] mb-3 text-sm">🌤️ 天氣分佈（營業日）</h4>
                    <div className="space-y-2.5">
                      {WEATHER_OPTIONS.map(w => {
                        const d   = hStats.weatherDays[w.value] || 0;
                        const pct = hStats.days > 0 ? Math.round((d / hStats.days) * 100) : 0;
                        return (
                          <div key={w.value}>
                            <div className="flex justify-between text-sm mb-1">
                              <span className="text-[#4e7397] text-xs">{w.label}</span>
                              <span className="font-semibold text-xs text-[#0e141b]">{d} 天（{pct}%）</span>
                            </div>
                            <div className="h-1.5 bg-[#f1f5f9] rounded-full overflow-hidden">
                              <div className="h-full rounded-full bg-[#197fe6]" style={{ width: `${pct}%` }} />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* 每日明細表 */}
                <div className="card p-0 overflow-hidden">
                  <div className="px-5 py-3 border-b border-[#e7edf3]">
                    <h4 className="font-semibold text-[#0e141b] text-sm">📋 每日明細</h4>
                  </div>
                  <div className="overflow-x-auto">
                    <table>
                      <thead><tr>
                        <th>日期</th><th>星期</th><th>天氣</th><th>總人數</th>
                        <th>立健首次</th><th>2/3次</th><th>立健慢箋</th><th>外來慢箋</th><th>牙科箋</th>
                        <th>銷售</th><th>營業額</th><th>備注</th>
                      </tr></thead>
                      <tbody>
                        {hStats.all.map((r, i) => (
                          <tr key={i} className={r.isHoliday ? 'opacity-40' : ''}>
                            <td className="whitespace-nowrap font-medium">{r.date}</td>
                            <td className="whitespace-nowrap text-[#4e7397]">{r.weekday}</td>
                            <td>{r.weather === '晴' ? '☀️' : r.weather === '雨' ? '🌧️' : r.weather === '颱風' ? '🌀' : '💨'} {r.weather}</td>
                            <td>{r.totalCustomers}</td>
                            <td>{r.firstRxLijian}</td><td>{r.rx23Lijian}</td>
                            <td>{r.lijianRx}</td><td>{r.externalRx}</td><td>{r.dentalRx}</td>
                            <td>{r.salesCount}</td>
                            <td className="font-semibold text-[#197fe6] whitespace-nowrap">{r.revenue > 0 ? `$${r.revenue.toLocaleString()}` : '—'}</td>
                            <td className="text-[#ef4444] text-xs">{r.note}</td>
                          </tr>
                        ))}
                        {/* 合計列 */}
                        <tr className="bg-[#f8fafc] font-bold text-[#0e141b]">
                          <td colSpan={3}>合計（營業 {hStats.days} 天）</td>
                          <td>{hStats.totalCustomers}</td>
                          <td>{hStats.rxBreakdown.firstRxLijian}</td>
                          <td>{hStats.rxBreakdown.rx23Lijian}</td>
                          <td>{hStats.rxBreakdown.lijianRx}</td>
                          <td>{hStats.rxBreakdown.externalRx}</td>
                          <td>{hStats.rxBreakdown.dentalRx}</td>
                          <td>{hStats.totalSales}</td>
                          <td className="text-[#197fe6]">${hStats.totalRevenue.toLocaleString()}</td>
                          <td></td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* 選了月份但無資料 */}
            {!histLoading && selectedHistTab && histRecords.length === 0 && (
              <div className="card text-center py-16 text-[#94a3b8]">
                <p className="text-4xl mb-3">📭</p>
                <p className="font-medium">{selYear} 年 {selMonth} 月 尚無資料</p>
              </div>
            )}
          </div>
        );
      })()}

      {/* 刪除確認 */}
      {deleteTarget && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4 print:hidden">
          <div className="bg-white rounded-xl p-6 w-full max-w-sm shadow-xl">
            <h3 className="font-bold text-[#0e141b] mb-2">確認刪除此業績紀錄？</h3>
            <p className="text-sm text-[#4e7397] mb-1">分頁：{deleteTarget.sourceTab}</p>
            <p className="text-sm text-[#4e7397] mb-5">此操作不可復原。</p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteTarget(null)} disabled={deleting} className="btn-secondary flex-1">取消</button>
              <button onClick={handleDelete} disabled={deleting} className="btn-danger flex-1">
                {deleting ? '刪除中...' : '確認刪除'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
