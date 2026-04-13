'use client';

import { useEffect, useState, useCallback } from 'react';
import type { Patient, PatientWithDates } from '@/types';
import { calculateDates, checkStatus, calculateAge } from '@/lib/dateUtils';

const today = new Date().toISOString().split('T')[0];

function enrichPatient(p: Patient): PatientWithDates {
  const dates = calculateDates(p.firstPickupDate, p.prescriptionDays);
  return {
    ...p,
    ...dates,
    status: checkStatus(p),
    age: calculateAge(p.dob),
  };
}

function StatusBadge({ status }: { status: string }) {
  let cls = 'badge ';
  if (status.includes('🔴')) cls += 'bg-red-50 text-red-700';
  else if (status.includes('❌')) cls += 'bg-red-100 text-red-800';
  else if (status.includes('⚠️')) cls += 'bg-yellow-50 text-yellow-700';
  else if (status.includes('✅')) cls += 'bg-green-50 text-green-700';
  else if (status.includes('🏥')) cls += 'bg-purple-50 text-purple-700';
  else if (status.includes('🏁')) cls += 'bg-gray-100 text-gray-500';
  else cls += 'bg-blue-50 text-blue-700';
  return <span className={cls}>{status}</span>;
}

export default function ChronicPrescriptionsPage() {
  const [patients, setPatients] = useState<PatientWithDates[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notifying, setNotifying] = useState(false);
  const [filter, setFilter] = useState<'all' | 'urgent' | 'active'>('all');
  const [search, setSearch] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<number | null>(null);
  const [toastMsg, setToastMsg] = useState('');

  // 新增表單
  const [form, setForm] = useState({
    name: '', phone: '', dob: '', gender: '男',
    firstPickupDate: today, prescriptionDays: 28, district: '',
  });

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(''), 3000);
  };

  const loadPatients = useCallback(async () => {
    const res = await fetch('/api/patients');
    const data = await res.json();
    if (data.success) {
      setPatients((data.data as Patient[]).map(enrichPatient));
    }
    setLoading(false);
  }, []);

  useEffect(() => { loadPatients(); }, [loadPatients]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.firstPickupDate) return;
    setSaving(true);
    await fetch('/api/patients', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, pickedSecond: false, pickedThird: false, completed: false }),
    });
    setForm({ name: '', phone: '', dob: '', gender: '男', firstPickupDate: today, prescriptionDays: 28, district: '' });
    await loadPatients();
    setSaving(false);
    showToast(`✅ 已新增個案：${form.name}`);
  };

  const handleToggle = async (p: PatientWithDates, field: 'pickedSecond' | 'pickedThird' | 'completed') => {
    const updated = { ...p, [field]: !p[field] };
    setPatients(prev => prev.map(x => x.rowIndex === p.rowIndex ? { ...enrichPatient(updated) } : x));
    await fetch('/api/patients', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updated),
    });
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    await fetch('/api/patients', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rowIndex: deleteTarget }),
    });
    setDeleteTarget(null);
    await loadPatients();
    showToast('已刪除個案');
  };

  const handleNotify = async () => {
    const urgent = patients.filter(p => p.status.includes('🔴') && !p.completed);
    if (urgent.length === 0) return;
    setNotifying(true);
    const dateStr = new Date().toLocaleDateString('zh-TW');
    let msg = `【慢箋領藥提醒彙整】\n日期：${dateStr}\n\n以下個案需通知領藥：\n`;
    urgent.forEach((p, i) => {
      msg += `${i + 1}. ${p.name}（${p.status.replace('🔴 ', '')}）\n   電話：${p.phone}\n`;
    });
    msg += '\n請藥師協助聯繫個案。';
    const res = await fetch('/api/notify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: msg }),
    });
    const data = await res.json();
    setNotifying(false);
    showToast(data.success ? '📲 已發送 LINE 通知給藥師！' : `發送失敗：${data.error}`);
  };

  const filtered = patients.filter(p => {
    const matchSearch = !search || p.name.includes(search) || p.phone.includes(search) || p.district.includes(search);
    const matchFilter =
      filter === 'all' ? true :
      filter === 'urgent' ? (p.status.includes('🔴') || p.status.includes('❌')) :
      !p.completed;
    return matchSearch && matchFilter;
  });

  const urgentCount = patients.filter(p => p.status.includes('🔴') && !p.completed).length;

  if (loading) return (
    <div className="flex items-center justify-center h-64 text-[#4e7397]">
      <svg className="animate-spin w-6 h-6 mr-2" viewBox="0 0 24 24" fill="none">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
      </svg>
      讀取資料中...
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Toast */}
      {toastMsg && (
        <div className="fixed top-4 right-4 z-50 bg-[#0e141b] text-white text-sm px-4 py-2.5 rounded-lg shadow-lg">
          {toastMsg}
        </div>
      )}

      {/* 標題 */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[#0e141b]">慢箋提醒管理</h1>
          <p className="text-sm text-[#4e7397] mt-1">追蹤個案領藥進度，自動計算下次領藥區間</p>
        </div>
        <button
          onClick={handleNotify}
          disabled={urgentCount === 0 || notifying}
          className="btn-primary flex items-center gap-2"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
          </svg>
          {notifying ? '發送中...' : `LINE 通知 (${urgentCount} 位)`}
        </button>
      </div>

      {/* 新增個案表單 */}
      <div className="card">
        <h2 className="font-bold text-[#0e141b] mb-4 flex items-center gap-2">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#197fe6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="8" r="4"/><path d="M20 21a8 8 0 1 0-16 0"/><line x1="12" y1="12" x2="12" y2="16"/><line x1="10" y1="14" x2="14" y2="14"/>
          </svg>
          新增個案資料
        </h2>
        <form onSubmit={handleAdd} className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <div>
            <label>個案姓名 *</label>
            <input type="text" required placeholder="姓名" value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
          </div>
          <div>
            <label>個案電話</label>
            <input type="text" placeholder="電話" value={form.phone}
              onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
          </div>
          <div>
            <label>出生年月日</label>
            <input type="date" value={form.dob}
              onChange={e => setForm(f => ({ ...f, dob: e.target.value }))} />
          </div>
          <div>
            <label>性別</label>
            <select value={form.gender} onChange={e => setForm(f => ({ ...f, gender: e.target.value }))}>
              <option>男</option>
              <option>女</option>
            </select>
          </div>
          <div>
            <label>居住里別</label>
            <input type="text" placeholder="例：大安里" value={form.district}
              onChange={e => setForm(f => ({ ...f, district: e.target.value }))} />
          </div>
          <div>
            <label>處方天數</label>
            <select value={form.prescriptionDays} onChange={e => setForm(f => ({ ...f, prescriptionDays: Number(e.target.value) }))}>
              <option value={28}>28 天</option>
              <option value={30}>30 天</option>
            </select>
          </div>
          <div>
            <label>第一次領藥日 *</label>
            <input type="date" required value={form.firstPickupDate}
              onChange={e => setForm(f => ({ ...f, firstPickupDate: e.target.value }))} />
          </div>
          <div className="col-span-2 md:col-span-3 lg:col-span-5 flex items-end">
            <button type="submit" disabled={saving} className="btn-primary w-full md:w-auto">
              {saving ? '儲存中...' : '💾 新增個案'}
            </button>
          </div>
        </form>
      </div>

      {/* 篩選與搜尋 */}
      <div className="flex flex-wrap gap-3 items-center">
        <input type="text" placeholder="搜尋姓名、電話、里別..." value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-56"
        />
        <div className="flex gap-2">
          {([['all', '全部'], ['active', '追蹤中'], ['urgent', '需領藥']] as const).map(([val, label]) => (
            <button key={val} onClick={() => setFilter(val)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                filter === val ? 'bg-primary text-white' : 'bg-white text-[#4e7397] border border-[#e7edf3] hover:bg-[#f8fafc]'
              }`}>
              {label}
            </button>
          ))}
        </div>
        <span className="text-sm text-[#4e7397] ml-auto">共 {filtered.length} 筆</span>
      </div>

      {/* 個案列表 */}
      <div className="card p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table>
            <thead>
              <tr>
                <th>個案姓名</th>
                <th>電話</th>
                <th>里別</th>
                <th>第一次領藥日</th>
                <th>第二次區間</th>
                <th>第三次區間</th>
                <th>回診日</th>
                <th>目前狀態</th>
                <th className="text-center">已領2次</th>
                <th className="text-center">已領3次</th>
                <th className="text-center">已結案</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={12} className="text-center py-12 text-[#94a3b8]">
                    {search ? '找不到符合的個案' : '目前沒有個案，請從上方新增'}
                  </td>
                </tr>
              ) : (
                filtered.map((p) => (
                  <tr key={p.rowIndex}>
                    <td className="font-medium">{p.name}</td>
                    <td className="text-[#4e7397]">{p.phone}</td>
                    <td>{p.district}</td>
                    <td>{p.firstPickupDate}</td>
                    <td className="text-xs text-[#4e7397]">
                      {p.secondStart ? `${p.secondStart.slice(5)} ~ ${p.secondEnd.slice(5)}` : '-'}
                    </td>
                    <td className="text-xs text-[#4e7397]">
                      {p.thirdStart ? `${p.thirdStart.slice(5)} ~ ${p.thirdEnd.slice(5)}` : '-'}
                    </td>
                    <td className="text-xs">{p.returnVisit}</td>
                    <td><StatusBadge status={p.status} /></td>
                    <td className="text-center">
                      <input type="checkbox" checked={p.pickedSecond}
                        onChange={() => handleToggle(p, 'pickedSecond')}
                        className="w-4 h-4 accent-primary cursor-pointer"
                      />
                    </td>
                    <td className="text-center">
                      <input type="checkbox" checked={p.pickedThird}
                        onChange={() => handleToggle(p, 'pickedThird')}
                        className="w-4 h-4 accent-primary cursor-pointer"
                      />
                    </td>
                    <td className="text-center">
                      <input type="checkbox" checked={p.completed}
                        onChange={() => handleToggle(p, 'completed')}
                        className="w-4 h-4 accent-primary cursor-pointer"
                      />
                    </td>
                    <td>
                      <button onClick={() => setDeleteTarget(p.rowIndex)}
                        className="text-[#94a3b8] hover:text-red-500 transition-colors p-1"
                        title="刪除">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/>
                        </svg>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 刪除確認 Dialog */}
      {deleteTarget && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-sm shadow-xl">
            <h3 className="font-bold text-[#0e141b] mb-2">確認刪除？</h3>
            <p className="text-sm text-[#4e7397] mb-5">此操作不可復原，請確認後再刪除。</p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteTarget(null)} className="btn-secondary flex-1">取消</button>
              <button onClick={handleDelete} className="btn-danger flex-1">確認刪除</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
