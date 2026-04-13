'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import type { Patient, Transaction, Drug, DrugBalance } from '@/types';
import { checkStatus } from '@/lib/dateUtils';

function StatCard({
  label,
  value,
  sub,
  color = 'blue',
  icon,
}: {
  label: string;
  value: number | string;
  sub?: string;
  color?: 'blue' | 'green' | 'orange' | 'red';
  icon: React.ReactNode;
}) {
  const colorMap = {
    blue: 'bg-blue-50 text-blue-600',
    green: 'bg-green-50 text-green-600',
    orange: 'bg-orange-50 text-orange-600',
    red: 'bg-red-50 text-red-600',
  };
  return (
    <div className="card flex items-center gap-4">
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${colorMap[color]}`}>
        {icon}
      </div>
      <div>
        <p className="text-xs text-[#4e7397] mb-0.5">{label}</p>
        <p className="text-2xl font-bold text-[#0e141b] leading-none">{value}</p>
        {sub && <p className="text-xs text-[#94a3b8] mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [drugs, setDrugs] = useState<Drug[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch('/api/patients').then(r => r.json()),
      fetch('/api/transactions').then(r => r.json()),
      fetch('/api/drugs').then(r => r.json()),
    ]).then(([pRes, tRes, dRes]) => {
      setPatients(pRes.data ?? []);
      setTransactions(tRes.data ?? []);
      setDrugs(dRes.data ?? []);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  // 計算慢箋統計
  const urgentPatients = patients.filter(p => {
    const s = checkStatus(p);
    return s.includes('🔴') || s.includes('❌');
  });
  const activePatients = patients.filter(p => !p.completed);

  // 計算藥品借還統計
  const balanceMap: Record<string, DrugBalance> = {};
  drugs.forEach(d => {
    const key = `${d.name}|${d.dosage}|${d.brand}`;
    balanceMap[key] = { drugName: d.name, dosage: d.dosage, brand: d.brand, balance: 0, totalLent: 0, totalReturned: 0 };
  });
  transactions.forEach(t => {
    const key = `${t.drugName}|${t.dosage}|${t.brand}`;
    if (!balanceMap[key]) {
      balanceMap[key] = { drugName: t.drugName, dosage: t.dosage, brand: t.brand, balance: 0, totalLent: 0, totalReturned: 0 };
    }
    if (t.type === '借出') {
      balanceMap[key].balance -= t.quantity;
      balanceMap[key].totalLent += t.quantity;
    } else {
      balanceMap[key].balance += t.quantity;
      balanceMap[key].totalReturned += t.quantity;
    }
  });
  const balances = Object.values(balanceMap);
  const unreturned = balances.filter(b => b.balance < 0);

  // 最近5筆借還
  const recentTx = [...transactions]
    .sort((a, b) => (b.date > a.date ? 1 : -1))
    .slice(0, 5);

  // 需要注意的慢箋（前5筆）
  const urgentList = patients
    .filter(p => {
      const s = checkStatus(p);
      return s.includes('🔴') || s.includes('⚠️') || s.includes('❌');
    })
    .slice(0, 5)
    .map(p => ({ ...p, status: checkStatus(p) }));

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-[#4e7397]">
        <svg className="animate-spin w-6 h-6 mr-2" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
        </svg>
        讀取資料中...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 標題 */}
      <div>
        <h1 className="text-2xl font-bold text-[#0e141b]">首頁總覽</h1>
        <p className="text-sm text-[#4e7397] mt-1">立安藥局管理系統</p>
      </div>

      {/* 統計卡片 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="追蹤中個案"
          value={activePatients.length}
          sub={`共 ${patients.length} 位`}
          color="blue"
          icon={
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
            </svg>
          }
        />
        <StatCard
          label="需領藥提醒"
          value={urgentPatients.length}
          sub="立即處理"
          color={urgentPatients.length > 0 ? 'red' : 'green'}
          icon={
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 17H2a3 3 0 0 0 3-3V9a7 7 0 0 1 14 0v5a3 3 0 0 0 3 3zm-8.27 4a2 2 0 0 1-3.46 0"/>
            </svg>
          }
        />
        <StatCard
          label="藥品種類"
          value={drugs.length}
          sub="已建立品項"
          color="blue"
          icon={
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h13a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2z"/><path d="M12 11h4M12 16h4M8 11h.01M8 16h.01"/>
            </svg>
          }
        />
        <StatCard
          label="未歸還藥品"
          value={unreturned.length}
          sub="種類數"
          color={unreturned.length > 0 ? 'orange' : 'green'}
          icon={
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-3"/><line x1="12" y1="8" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
            </svg>
          }
        />
      </div>

      {/* 主要內容區 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* 需要注意的慢箋 */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-[#0e141b]">需要處理的慢箋</h2>
            <Link href="/chronic-prescriptions" className="text-xs text-primary hover:underline">
              查看全部 →
            </Link>
          </div>
          {urgentList.length === 0 ? (
            <div className="text-center py-8 text-[#94a3b8] text-sm">
              <div className="text-2xl mb-2">✅</div>
              目前沒有需要緊急處理的個案
            </div>
          ) : (
            <div className="space-y-2">
              {urgentList.map((p) => (
                <div key={p.rowIndex} className="flex items-center justify-between py-2 border-b border-[#f1f5f9] last:border-0">
                  <div>
                    <span className="font-medium text-sm text-[#0e141b]">{p.name}</span>
                    <span className="text-xs text-[#4e7397] ml-2">{p.district}</span>
                  </div>
                  <span className="text-xs">{p.status}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 最近借還紀錄 */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-[#0e141b]">最近借還紀錄</h2>
            <Link href="/drug-lending" className="text-xs text-primary hover:underline">
              查看全部 →
            </Link>
          </div>
          {recentTx.length === 0 ? (
            <div className="text-center py-8 text-[#94a3b8] text-sm">
              <div className="text-2xl mb-2">📋</div>
              尚無借還紀錄
            </div>
          ) : (
            <div className="space-y-2">
              {recentTx.map((t) => (
                <div key={t.rowIndex} className="flex items-center justify-between py-2 border-b border-[#f1f5f9] last:border-0">
                  <div>
                    <span className="font-medium text-sm text-[#0e141b]">{t.drugName}</span>
                    <span className="text-xs text-[#4e7397] ml-1">{t.dosage}</span>
                    <div className="text-xs text-[#4e7397]">{t.person}</div>
                  </div>
                  <div className="text-right">
                    <span className={`badge ${t.type === '借出' ? 'bg-orange-50 text-orange-600' : 'bg-green-50 text-green-600'}`}>
                      {t.type === '借出' ? '▼' : '▲'} {t.quantity} 顆 {t.type}
                    </span>
                    <div className="text-xs text-[#94a3b8] mt-0.5">{t.date}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 藥品餘量警示 */}
        {unreturned.length > 0 && (
          <div className="card lg:col-span-2">
            <h2 className="font-bold text-[#0e141b] mb-4">⚠️ 有借出尚未歸還的藥品</h2>
            <div className="overflow-x-auto">
              <table>
                <thead>
                  <tr>
                    <th>藥品名稱</th>
                    <th>劑量</th>
                    <th>廠牌</th>
                    <th>借出合計</th>
                    <th>歸還合計</th>
                    <th>目前餘量</th>
                  </tr>
                </thead>
                <tbody>
                  {unreturned.map((b, i) => (
                    <tr key={i}>
                      <td className="font-medium">{b.drugName}</td>
                      <td>{b.dosage}</td>
                      <td>{b.brand}</td>
                      <td className="text-orange-600">-{b.totalLent}</td>
                      <td className="text-green-600">+{b.totalReturned}</td>
                      <td>
                        <span className="badge bg-red-50 text-red-600">{b.balance}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
