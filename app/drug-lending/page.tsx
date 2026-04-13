'use client';

import { useEffect, useState, useCallback } from 'react';
import type { Drug, Transaction, DrugBalance } from '@/types';

const today = new Date().toISOString().split('T')[0];

function computeBalances(drugs: Drug[], transactions: Transaction[]): DrugBalance[] {
  const map: Record<string, DrugBalance> = {};

  drugs.forEach(d => {
    const key = `${d.name}||${d.dosage}||${d.brand}`;
    map[key] = { drugName: d.name, dosage: d.dosage, brand: d.brand, balance: 0, totalLent: 0, totalReturned: 0 };
  });

  transactions.forEach(t => {
    const key = `${t.drugName}||${t.dosage}||${t.brand}`;
    if (!map[key]) {
      map[key] = { drugName: t.drugName, dosage: t.dosage, brand: t.brand, balance: 0, totalLent: 0, totalReturned: 0 };
    }
    if (t.type === '借出') {
      map[key].balance -= t.quantity;
      map[key].totalLent += t.quantity;
    } else {
      map[key].balance += t.quantity;
      map[key].totalReturned += t.quantity;
    }
  });

  return Object.values(map);
}

export default function DrugLendingPage() {
  const [drugs, setDrugs] = useState<Drug[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'balance' | 'records' | 'drugs'>('balance');
  const [toastMsg, setToastMsg] = useState('');

  // 新增藥品表單
  const [drugForm, setDrugForm] = useState({ name: '', dosage: '', brand: '', note: '' });
  const [addingDrug, setAddingDrug] = useState(false);

  // 新增借還紀錄表單
  const [txForm, setTxForm] = useState({
    date: today,
    drugName: '',
    dosage: '',
    brand: '',
    type: '借出' as '借出' | '歸還',
    person: '',
    quantity: 1,
    expectedReturn: '',
    note: '',
  });
  const [addingTx, setAddingTx] = useState(false);

  // 刪除確認
  const [deleteTxTarget, setDeleteTxTarget] = useState<number | null>(null);
  const [deleteDrugTarget, setDeleteDrugTarget] = useState<number | null>(null);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(''), 3000);
  };

  const loadAll = useCallback(async () => {
    const [dRes, tRes] = await Promise.all([
      fetch('/api/drugs').then(r => r.json()),
      fetch('/api/transactions').then(r => r.json()),
    ]);
    setDrugs(dRes.data ?? []);
    setTransactions(tRes.data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  // 選藥品後自動填入劑量廠牌
  const handleDrugSelect = (name: string) => {
    const found = drugs.find(d => d.name === name);
    if (found) {
      setTxForm(f => ({ ...f, drugName: found.name, dosage: found.dosage, brand: found.brand }));
    } else {
      setTxForm(f => ({ ...f, drugName: name }));
    }
  };

  const handleAddDrug = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!drugForm.name) return;
    setAddingDrug(true);
    await fetch('/api/drugs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(drugForm),
    });
    setDrugForm({ name: '', dosage: '', brand: '', note: '' });
    await loadAll();
    setAddingDrug(false);
    showToast(`✅ 已新增藥品：${drugForm.name}`);
  };

  const handleDeleteDrug = async () => {
    if (!deleteDrugTarget) return;
    await fetch('/api/drugs', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rowIndex: deleteDrugTarget }),
    });
    setDeleteDrugTarget(null);
    await loadAll();
    showToast('已刪除藥品');
  };

  const handleAddTx = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!txForm.drugName || !txForm.person || txForm.quantity <= 0) return;
    setAddingTx(true);
    await fetch('/api/transactions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(txForm),
    });
    setTxForm(f => ({ ...f, person: '', quantity: 1, expectedReturn: '', note: '' }));
    await loadAll();
    setAddingTx(false);
    showToast(`✅ 已新增${txForm.type}紀錄：${txForm.drugName}`);
  };

  const handleDeleteTx = async () => {
    if (!deleteTxTarget) return;
    await fetch('/api/transactions', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rowIndex: deleteTxTarget }),
    });
    setDeleteTxTarget(null);
    await loadAll();
    showToast('已刪除紀錄');
  };

  const balances = computeBalances(drugs, transactions);
  const sortedTx = [...transactions].sort((a, b) => (b.date > a.date ? 1 : -1));

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
      <div>
        <h1 className="text-2xl font-bold text-[#0e141b]">藥品借還管理</h1>
        <p className="text-sm text-[#4e7397] mt-1">記錄藥品借出與歸還，自動計算目前餘量</p>
      </div>

      {/* 新增借還紀錄（主要操作區） */}
      <div className="card">
        <h2 className="font-bold text-[#0e141b] mb-4 flex items-center gap-2">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#197fe6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          新增借還紀錄
        </h2>
        <form onSubmit={handleAddTx} className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {/* 類型 */}
          <div>
            <label>類型 *</label>
            <div className="flex gap-2">
              {(['借出', '歸還'] as const).map(t => (
                <button key={t} type="button"
                  onClick={() => setTxForm(f => ({ ...f, type: t }))}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors ${
                    txForm.type === t
                      ? t === '借出'
                        ? 'bg-orange-100 text-orange-700 border-orange-300'
                        : 'bg-green-100 text-green-700 border-green-300'
                      : 'bg-white text-[#4e7397] border-[#e7edf3] hover:bg-[#f8fafc]'
                  }`}>
                  {t === '借出' ? '▼ 借出' : '▲ 歸還'}
                </button>
              ))}
            </div>
          </div>

          {/* 藥品名稱（下拉 + 自由輸入） */}
          <div>
            <label>藥品名稱 *</label>
            <input
              type="text"
              required
              list="drug-list"
              placeholder="選擇或輸入藥品"
              value={txForm.drugName}
              onChange={e => handleDrugSelect(e.target.value)}
            />
            <datalist id="drug-list">
              {drugs.map(d => (
                <option key={d.rowIndex} value={d.name}>{d.name} {d.dosage} {d.brand}</option>
              ))}
            </datalist>
          </div>

          <div>
            <label>劑量</label>
            <input type="text" placeholder="例：500mg" value={txForm.dosage}
              onChange={e => setTxForm(f => ({ ...f, dosage: e.target.value }))} />
          </div>

          <div>
            <label>廠牌</label>
            <input type="text" placeholder="廠牌" value={txForm.brand}
              onChange={e => setTxForm(f => ({ ...f, brand: e.target.value }))} />
          </div>

          <div>
            <label>{txForm.type === '借出' ? '借方（誰借走）*' : '歸還者（誰還回）*'}</label>
            <input type="text" required placeholder="姓名或藥局名" value={txForm.person}
              onChange={e => setTxForm(f => ({ ...f, person: e.target.value }))} />
          </div>

          <div>
            <label>數量（顆/盒）*</label>
            <input type="number" required min={1} value={txForm.quantity}
              onChange={e => setTxForm(f => ({ ...f, quantity: Number(e.target.value) }))} />
          </div>

          <div>
            <label>日期 *</label>
            <input type="date" required value={txForm.date}
              onChange={e => setTxForm(f => ({ ...f, date: e.target.value }))} />
          </div>

          {txForm.type === '借出' && (
            <div>
              <label>預計歸還日</label>
              <input type="date" value={txForm.expectedReturn}
                onChange={e => setTxForm(f => ({ ...f, expectedReturn: e.target.value }))} />
            </div>
          )}

          <div className="col-span-2 md:col-span-1">
            <label>備注</label>
            <input type="text" placeholder="備注（選填）" value={txForm.note}
              onChange={e => setTxForm(f => ({ ...f, note: e.target.value }))} />
          </div>

          <div className="col-span-2 md:col-span-3 lg:col-span-4 flex justify-end">
            <button type="submit" disabled={addingTx} className="btn-primary">
              {addingTx ? '儲存中...' : '💾 新增紀錄'}
            </button>
          </div>
        </form>
      </div>

      {/* 分頁切換 */}
      <div className="flex gap-2 border-b border-[#e7edf3]">
        {([
          ['balance', '藥品餘量總覽'],
          ['records', `借還紀錄（${transactions.length}）`],
          ['drugs', `藥品清單（${drugs.length}）`],
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

      {/* 藥品餘量總覽 */}
      {tab === 'balance' && (
        <div className="card p-0 overflow-hidden">
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
                  <th>狀態</th>
                </tr>
              </thead>
              <tbody>
                {balances.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-12 text-[#94a3b8]">
                      尚無資料，請先在「藥品清單」新增藥品，再記錄借還
                    </td>
                  </tr>
                ) : (
                  balances.map((b, i) => (
                    <tr key={i}>
                      <td className="font-medium">{b.drugName}</td>
                      <td>{b.dosage}</td>
                      <td>{b.brand}</td>
                      <td>
                        {b.totalLent > 0 && (
                          <span className="badge bg-orange-50 text-orange-600">▼ {b.totalLent}</span>
                        )}
                      </td>
                      <td>
                        {b.totalReturned > 0 && (
                          <span className="badge bg-green-50 text-green-600">▲ {b.totalReturned}</span>
                        )}
                      </td>
                      <td className="font-bold">
                        <span className={b.balance < 0 ? 'text-red-600' : b.balance > 0 ? 'text-green-600' : 'text-[#4e7397]'}>
                          {b.balance > 0 ? '+' : ''}{b.balance}
                        </span>
                      </td>
                      <td>
                        {b.balance < 0 ? (
                          <span className="badge bg-red-50 text-red-600">⚠️ 未全歸還</span>
                        ) : b.balance > 0 ? (
                          <span className="badge bg-blue-50 text-blue-600">ℹ️ 有盈餘</span>
                        ) : (
                          <span className="badge bg-gray-50 text-gray-500">✓ 持平</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 借還紀錄 */}
      {tab === 'records' && (
        <div className="card p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table>
              <thead>
                <tr>
                  <th>日期</th>
                  <th>藥品</th>
                  <th>劑量</th>
                  <th>廠牌</th>
                  <th>類型</th>
                  <th>借方 / 歸還者</th>
                  <th>數量</th>
                  <th>預計歸還日</th>
                  <th>備注</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {sortedTx.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="text-center py-12 text-[#94a3b8]">尚無借還紀錄</td>
                  </tr>
                ) : (
                  sortedTx.map(t => (
                    <tr key={t.rowIndex}>
                      <td>{t.date}</td>
                      <td className="font-medium">{t.drugName}</td>
                      <td>{t.dosage}</td>
                      <td>{t.brand}</td>
                      <td>
                        <span className={`badge ${t.type === '借出' ? 'bg-orange-50 text-orange-600' : 'bg-green-50 text-green-600'}`}>
                          {t.type === '借出' ? '▼ 借出' : '▲ 歸還'}
                        </span>
                      </td>
                      <td>{t.person}</td>
                      <td className="font-bold">
                        <span className={t.type === '借出' ? 'text-orange-600' : 'text-green-600'}>
                          {t.type === '借出' ? '-' : '+'}{t.quantity}
                        </span>
                      </td>
                      <td className="text-xs text-[#4e7397]">{t.expectedReturn || '-'}</td>
                      <td className="text-xs text-[#4e7397]">{t.note || '-'}</td>
                      <td>
                        <button onClick={() => setDeleteTxTarget(t.rowIndex)}
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
      )}

      {/* 藥品清單管理 */}
      {tab === 'drugs' && (
        <div className="space-y-4">
          {/* 新增藥品表單 */}
          <div className="card">
            <h3 className="font-bold text-[#0e141b] mb-3">新增藥品品項</h3>
            <form onSubmit={handleAddDrug} className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div>
                <label>藥品名稱 *</label>
                <input type="text" required placeholder="藥品名稱" value={drugForm.name}
                  onChange={e => setDrugForm(f => ({ ...f, name: e.target.value }))} />
              </div>
              <div>
                <label>劑量</label>
                <input type="text" placeholder="例：500mg" value={drugForm.dosage}
                  onChange={e => setDrugForm(f => ({ ...f, dosage: e.target.value }))} />
              </div>
              <div>
                <label>廠牌</label>
                <input type="text" placeholder="廠牌" value={drugForm.brand}
                  onChange={e => setDrugForm(f => ({ ...f, brand: e.target.value }))} />
              </div>
              <div>
                <label>備注</label>
                <input type="text" placeholder="備注（選填）" value={drugForm.note}
                  onChange={e => setDrugForm(f => ({ ...f, note: e.target.value }))} />
              </div>
              <div className="col-span-2 md:col-span-4 flex justify-end">
                <button type="submit" disabled={addingDrug} className="btn-primary">
                  {addingDrug ? '新增中...' : '+ 新增藥品'}
                </button>
              </div>
            </form>
          </div>

          {/* 藥品列表 */}
          <div className="card p-0 overflow-hidden">
            <div className="overflow-x-auto">
              <table>
                <thead>
                  <tr>
                    <th>藥品名稱</th>
                    <th>劑量</th>
                    <th>廠牌</th>
                    <th>備注</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {drugs.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="text-center py-12 text-[#94a3b8]">
                        尚無藥品，請從上方新增
                      </td>
                    </tr>
                  ) : (
                    drugs.map(d => (
                      <tr key={d.rowIndex}>
                        <td className="font-medium">{d.name}</td>
                        <td>{d.dosage}</td>
                        <td>{d.brand}</td>
                        <td className="text-[#4e7397] text-sm">{d.note}</td>
                        <td>
                          <button onClick={() => setDeleteDrugTarget(d.rowIndex)}
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
        </div>
      )}

      {/* 刪除確認：借還紀錄 */}
      {deleteTxTarget && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-sm shadow-xl">
            <h3 className="font-bold text-[#0e141b] mb-2">確認刪除此紀錄？</h3>
            <p className="text-sm text-[#4e7397] mb-5">刪除後餘量將自動重新計算，此操作不可復原。</p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteTxTarget(null)} className="btn-secondary flex-1">取消</button>
              <button onClick={handleDeleteTx} className="btn-danger flex-1">確認刪除</button>
            </div>
          </div>
        </div>
      )}

      {/* 刪除確認：藥品 */}
      {deleteDrugTarget && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-sm shadow-xl">
            <h3 className="font-bold text-[#0e141b] mb-2">確認刪除此藥品？</h3>
            <p className="text-sm text-[#4e7397] mb-5">相關借還紀錄不會被刪除，此操作不可復原。</p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteDrugTarget(null)} className="btn-secondary flex-1">取消</button>
              <button onClick={handleDeleteDrug} className="btn-danger flex-1">確認刪除</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
