'use client';

import { useState, useRef } from 'react';
import type { DrugCheckResult, ManualEntryType, ParsedMedication, DrugInteraction, RiskScore } from '@/types';
import { downloadDrugCheckReport, calcAge, type PatientInfo } from '@/lib/drugCheckReport';

interface ManualEntry {
  id: number;
  type: ManualEntryType;
  name: string;
  dosage: string;
  frequency: string;
}

const SEVERITY_STYLE: Record<string, string> = {
  contraindicated: 'bg-red-100 text-red-800 border border-red-200',
  major:           'bg-orange-100 text-orange-800 border border-orange-200',
  moderate:        'bg-amber-100 text-amber-800 border border-amber-200',
  minor:           'bg-sky-100 text-sky-800 border border-sky-200',
};

const RISK_STYLE: Record<string, { wrap: string; badge: string; score: string }> = {
  low:      { wrap: 'bg-green-50 border-green-200',  badge: 'bg-green-100 text-green-800',  score: 'text-green-700' },
  moderate: { wrap: 'bg-amber-50 border-amber-200',  badge: 'bg-amber-100 text-amber-800',  score: 'text-amber-700' },
  high:     { wrap: 'bg-red-50   border-red-200',    badge: 'bg-red-100   text-red-800',    score: 'text-red-700'   },
};

const TYPE_BADGE: Record<string, string> = {
  西藥:   'bg-blue-100 text-blue-800',
  中藥:   'bg-green-100 text-green-800',
  保健食品: 'bg-purple-100 text-purple-800',
  一般食品: 'bg-gray-100 text-gray-700',
};

function RiskCard({ title, risk }: { title: string; risk: RiskScore }) {
  const s = RISK_STYLE[risk.level] ?? RISK_STYLE.low;
  return (
    <div className={`rounded-xl border p-4 ${s.wrap}`}>
      <div className="flex items-center justify-between mb-2">
        <h3 className="font-semibold text-[#0e141b] text-sm">{title}</h3>
        <div className="flex items-center gap-2">
          <span className={`text-2xl font-bold ${s.score}`}>{risk.total}</span>
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${s.badge}`}>{risk.levelLabel}</span>
        </div>
      </div>
      <p className="text-xs text-[#4e7397] mb-3">{risk.interpretation}</p>
      {risk.contributors.length > 0 && (
        <div className="space-y-1">
          {risk.contributors.map((c, i) => (
            <div key={i} className="flex items-start gap-1.5 text-xs">
              <span className={`font-bold shrink-0 ${s.score}`}>+{c.score}</span>
              <span className="font-medium text-[#0e141b] shrink-0">{c.name}</span>
              <span className="text-[#4e7397]">— {c.reason}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function InteractionCard({ ix, label }: { ix: DrugInteraction; label: string }) {
  const [open, setOpen] = useState(false);
  const s = SEVERITY_STYLE[ix.severity] ?? SEVERITY_STYLE.minor;
  return (
    <div className="border border-[#e7edf3] rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-[#f8fafc] transition-colors"
      >
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${s}`}>{ix.severityLabel}</span>
          <span className="text-sm font-medium text-[#0e141b]">{ix.item1}</span>
          <span className="text-[#4e7397]">×</span>
          <span className="text-sm font-medium text-[#0e141b]">{ix.item2}</span>
        </div>
        <svg
          width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
          strokeWidth="2" className={`shrink-0 transition-transform ${open ? 'rotate-180' : ''} text-[#4e7397]`}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>
      {open && (
        <div className="px-4 pb-4 space-y-2 bg-[#f8fafc] text-sm">
          <p className="text-[#0e141b]">{ix.description}</p>
          {ix.mechanism && (
            <p className="text-[#4e7397]"><span className="font-medium">機轉：</span>{ix.mechanism}</p>
          )}
          {ix.management && (
            <p className="text-[#4e7397]"><span className="font-medium text-[#0e141b]">處置建議：</span>{ix.management}</p>
          )}
        </div>
      )}
    </div>
  );
}

type UploadedImage = { base64: string; mimeType: string; preview: string };

export default function DrugCheckPage() {
  const [patient, setPatient] = useState<PatientInfo>({ name: '', birthDate: '', gender: '', phone: '', idNumber: '', labData: '' });
  const [inputMode, setInputMode] = useState<'text' | 'image'>('text');
  const [pastedText, setPastedText] = useState('');
  const [uploadedImage, setUploadedImage] = useState<UploadedImage | null>(null);
  const [labInputMode, setLabInputMode] = useState<'text' | 'image'>('text');
  const [labImage, setLabImage] = useState<UploadedImage | null>(null);
  const [manualEntries, setManualEntries] = useState<ManualEntry[]>([]);
  const [manualForm, setManualForm] = useState({ type: '中藥' as ManualEntryType, name: '', dosage: '', frequency: '' });
  const [nextId, setNextId] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<DrugCheckResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'meds' | 'interactions' | 'risks'>('meds');

  const fileRef     = useRef<HTMLInputElement>(null);
  const imageRef    = useRef<HTMLInputElement>(null);
  const labFileRef  = useRef<HTMLInputElement>(null);
  const labImageRef = useRef<HTMLInputElement>(null);

  const readImageFile = (file: File, setter: (img: UploadedImage) => void) => {
    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result as string;
      const [header, base64] = dataUrl.split(',');
      const mimeType = header.match(/:(.*?);/)?.[1] ?? 'image/png';
      setter({ base64, mimeType, preview: dataUrl });
    };
    reader.readAsDataURL(file);
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) readImageFile(file, setUploadedImage);
  };

  const handleLabImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) readImageFile(file, setLabImage);
  };

  // 台灣醫療系統匯出的 CSV/TXT 常為 Big5 編碼；先以 UTF-8 嚴格解碼，失敗再改用 Big5
  const decodeText = (buffer: ArrayBuffer): string => {
    try {
      return new TextDecoder('utf-8', { fatal: true }).decode(buffer);
    } catch {
      return new TextDecoder('big5').decode(buffer);
    }
  };

  // .txt/.csv/.xlsx/.xls → 純文字（xlsx 各工作表轉 CSV 後串接）
  const readFileToText = async (file: File): Promise<string> => {
    const buffer = await file.arrayBuffer();
    const isExcel = /\.(xlsx|xls)$/i.test(file.name)
      // xlsx 實為 zip 壓縮檔，開頭固定為 "PK"
      || new Uint8Array(buffer.slice(0, 2)).every((b, i) => b === [0x50, 0x4b][i]);
    if (isExcel) {
      const XLSX = await import('xlsx');
      const wb = XLSX.read(buffer, { type: 'array' });
      return wb.SheetNames
        .map(name => XLSX.utils.sheet_to_csv(wb.Sheets[name]).trim())
        .filter(Boolean)
        .join('\n\n');
    }
    return decodeText(buffer);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    try {
      setPastedText(await readFileToText(file));
    } catch {
      setError('檔案讀取失敗，請確認檔案格式（支援 .txt / .csv / .xlsx / .xls）。');
    } finally {
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const handleLabFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    try {
      const text = await readFileToText(file);
      setPatient(p => ({ ...p, labData: text }));
    } catch {
      setError('檢驗數據檔案讀取失敗，請確認檔案格式（支援 .txt / .csv / .xlsx / .xls）。');
    } finally {
      if (labFileRef.current) labFileRef.current.value = '';
    }
  };

  const addManual = () => {
    if (!manualForm.name.trim()) return;
    setManualEntries(prev => [...prev, { ...manualForm, id: nextId }]);
    setNextId(n => n + 1);
    setManualForm(prev => ({ ...prev, name: '', dosage: '', frequency: '' }));
  };

  const removeManual = (id: number) => setManualEntries(prev => prev.filter(e => e.id !== id));

  const handleAnalyze = async () => {
    if (!patient.name.trim() || !patient.birthDate) {
      setError('請填寫個案基本資料（姓名與出生年月日為必填）。');
      return;
    }
    if (!pastedText.trim() && !uploadedImage && manualEntries.length === 0) {
      setError('請輸入用藥資料後再分析。');
      return;
    }
    setIsLoading(true);
    setError(null);
    setResult(null);
    try {
      const resp = await fetch('/api/drug-check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: pastedText || undefined,
          imageBase64:  uploadedImage?.base64,
          imageMimeType: uploadedImage?.mimeType,
          manualEntries: manualEntries.map(({ type, name, dosage, frequency }) => ({ type, name, dosage, frequency })),
          // 只傳臨床必要資訊給 AI，不含姓名/電話/身分證等個資
          patientAge: calcAge(patient.birthDate) ?? undefined,
          patientGender: patient.gender || undefined,
          labData: patient.labData?.trim() || undefined,
          labImageBase64:  labImage?.base64,
          labImageMimeType: labImage?.mimeType,
        }),
      });
      const data = await resp.json();
      if (!data.success) {
        setError(data.error ?? '分析失敗，請重試。');
      } else {
        setResult(data.data);
        setActiveTab('meds');
        setTimeout(() => {
          document.getElementById('drug-check-result')?.scrollIntoView({ behavior: 'smooth' });
        }, 100);
      }
    } catch {
      setError('網路錯誤，請稍後重試。');
    } finally {
      setIsLoading(false);
    }
  };

  const totalInteractions = result
    ? (result.drugInteractions?.length ?? 0) + (result.foodInteractions?.length ?? 0)
    : 0;

  const hasMajor = result?.drugInteractions?.some(i => i.severity === 'major' || i.severity === 'contraindicated')
    || result?.foodInteractions?.some(i => i.severity === 'major' || i.severity === 'contraindicated');

  const highRiskCount = result
    ? [result.fallRisk, result.anticholinergicBurden, result.sedationRisk].filter(r => r?.level === 'high').length
    : 0;

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[#0e141b]">用藥安全評估</h1>
        <p className="text-sm text-[#4e7397] mt-1">
          AI 輔助藥師評估中西藥交互作用、跌倒風險、抗膽鹼指數及昏睡指數
        </p>
      </div>

      {/* ── Input section ── */}
      {/* ── Patient info ── */}
      <div className="bg-white border border-[#e7edf3] rounded-2xl p-5 mb-5 space-y-4">
        <h2 className="font-semibold text-[#0e141b]">個案基本資料</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <label className="block">
            <span className="text-xs font-medium text-[#4e7397]">姓名 <span className="text-red-500">*</span></span>
            <input
              value={patient.name}
              onChange={e => setPatient(p => ({ ...p, name: e.target.value }))}
              placeholder="王小明"
              className="mt-1 w-full border border-[#e7edf3] rounded-lg px-3 py-2 text-sm text-[#0e141b] placeholder-[#94a3b8] focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </label>
          <label className="block">
            <span className="text-xs font-medium text-[#4e7397]">出生年月日 <span className="text-red-500">*</span></span>
            <input
              type="date"
              value={patient.birthDate}
              onChange={e => setPatient(p => ({ ...p, birthDate: e.target.value }))}
              className="mt-1 w-full border border-[#e7edf3] rounded-lg px-3 py-2 text-sm text-[#0e141b] focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </label>
          <label className="block">
            <span className="text-xs font-medium text-[#4e7397]">性別</span>
            <select
              value={patient.gender}
              onChange={e => setPatient(p => ({ ...p, gender: e.target.value }))}
              className="mt-1 w-full border border-[#e7edf3] rounded-lg px-3 py-2 text-sm text-[#0e141b] focus:outline-none focus:ring-2 focus:ring-primary/30"
            >
              <option value="">未填寫</option>
              <option value="男">男</option>
              <option value="女">女</option>
            </select>
          </label>
          <label className="block">
            <span className="text-xs font-medium text-[#4e7397]">電話</span>
            <input
              type="tel"
              value={patient.phone}
              onChange={e => setPatient(p => ({ ...p, phone: e.target.value }))}
              placeholder="0912-345-678"
              className="mt-1 w-full border border-[#e7edf3] rounded-lg px-3 py-2 text-sm text-[#0e141b] placeholder-[#94a3b8] focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </label>
          <label className="block">
            <span className="text-xs font-medium text-[#4e7397]">身分證字號</span>
            <input
              value={patient.idNumber}
              onChange={e => setPatient(p => ({ ...p, idNumber: e.target.value.toUpperCase() }))}
              placeholder="A123456789"
              maxLength={10}
              className="mt-1 w-full border border-[#e7edf3] rounded-lg px-3 py-2 text-sm text-[#0e141b] placeholder-[#94a3b8] focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </label>
        </div>
      </div>

      {/* ── Lab data (multi-modal) ── */}
      <div className="bg-white border border-[#e7edf3] rounded-2xl p-5 mb-5 space-y-4">
        <h2 className="font-semibold text-[#0e141b]">
          檢驗數據
          <span className="ml-2 text-xs font-normal text-[#4e7397]">（選填，AI 將依此調整風險評估與劑量建議）</span>
        </h2>

        {/* Lab mode tabs */}
        <div className="flex gap-1 bg-[#f1f5f9] p-1 rounded-xl w-fit">
          {([['text', '貼上文字/上傳檔案'], ['image', '上傳截圖']] as const).map(([mode, label]) => (
            <button
              key={mode}
              onClick={() => setLabInputMode(mode)}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                labInputMode === mode
                  ? 'bg-white text-[#0e141b] shadow-sm'
                  : 'text-[#4e7397] hover:text-[#0e141b]'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Lab text mode */}
        {labInputMode === 'text' && (
          <div className="space-y-3">
            <textarea
              value={patient.labData}
              onChange={e => setPatient(p => ({ ...p, labData: e.target.value }))}
              rows={4}
              placeholder={`從健保醫療資訊雲端系統複製檢驗數據表格貼入此處，或直接輸入。

例：eGFR 45、Scr 1.4、K 3.2、ALT 80、HbA1c 8.5%、INR 2.8`}
              className="w-full border border-[#e7edf3] rounded-xl px-4 py-3 text-sm text-[#0e141b] placeholder-[#94a3b8] focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary resize-none font-mono"
            />
            <div className="flex items-center gap-2">
              <input ref={labFileRef} type="file" accept=".txt,.csv,.xlsx,.xls" className="hidden" onChange={handleLabFileUpload} />
              <button
                onClick={() => labFileRef.current?.click()}
                className="flex items-center gap-1.5 text-sm text-[#4e7397] hover:text-primary px-3 py-1.5 border border-[#e7edf3] rounded-lg hover:bg-primary-light transition-colors"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
                </svg>
                上傳檔案 (.txt/.csv/.xlsx)
              </button>
              {patient.labData && (
                <button onClick={() => setPatient(p => ({ ...p, labData: '' }))} className="text-xs text-[#94a3b8] hover:text-red-500 transition-colors">
                  清除
                </button>
              )}
            </div>
          </div>
        )}

        {/* Lab image mode */}
        {labInputMode === 'image' && (
          <div className="space-y-3">
            <input ref={labImageRef} type="file" accept="image/*" className="hidden" onChange={handleLabImageUpload} />
            {labImage ? (
              <div className="relative">
                <img
                  src={labImage.preview}
                  alt="檢驗數據截圖"
                  className="max-h-96 rounded-xl border border-[#e7edf3] object-contain w-full"
                />
                <button
                  onClick={() => { setLabImage(null); if (labImageRef.current) labImageRef.current.value = ''; }}
                  className="absolute top-2 right-2 bg-white border border-[#e7edf3] rounded-full p-1.5 text-[#4e7397] hover:text-red-500 shadow transition-colors"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                  </svg>
                </button>
              </div>
            ) : (
              <button
                onClick={() => labImageRef.current?.click()}
                className="w-full border-2 border-dashed border-[#e7edf3] rounded-xl py-8 flex flex-col items-center gap-3 text-[#4e7397] hover:border-primary hover:bg-primary-light transition-colors"
              >
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/>
                  <polyline points="21 15 16 10 5 21"/>
                </svg>
                <div className="text-center">
                  <p className="font-medium">點擊上傳檢驗數據截圖</p>
                  <p className="text-xs mt-0.5">支援 JPG、PNG、WEBP</p>
                </div>
              </button>
            )}
          </div>
        )}
      </div>

      <div className="bg-white border border-[#e7edf3] rounded-2xl p-5 mb-5 space-y-5">
        <h2 className="font-semibold text-[#0e141b]">輸入用藥資料</h2>

        {/* Mode tabs */}
        <div className="flex gap-1 bg-[#f1f5f9] p-1 rounded-xl w-fit">
          {([['text', '貼上文字/上傳檔案'], ['image', '上傳截圖']] as const).map(([mode, label]) => (
            <button
              key={mode}
              onClick={() => setInputMode(mode)}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                inputMode === mode
                  ? 'bg-white text-[#0e141b] shadow-sm'
                  : 'text-[#4e7397] hover:text-[#0e141b]'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Text mode */}
        {inputMode === 'text' && (
          <div className="space-y-3">
            <textarea
              value={pastedText}
              onChange={e => setPastedText(e.target.value)}
              rows={8}
              placeholder={`從健保醫療資訊雲端系統複製用藥表格貼入此處，或直接輸入藥品清單。

例：
Amlodipine 5mg  每天1次
Metformin 500mg  早晚各1顆
Atorvastatin 20mg  睡前1顆`}
              className="w-full border border-[#e7edf3] rounded-xl px-4 py-3 text-sm text-[#0e141b] placeholder-[#94a3b8] focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary resize-none font-mono"
            />
            <div className="flex items-center gap-2">
              <input ref={fileRef} type="file" accept=".txt,.csv,.xlsx,.xls" className="hidden" onChange={handleFileUpload} />
              <button
                onClick={() => fileRef.current?.click()}
                className="flex items-center gap-1.5 text-sm text-[#4e7397] hover:text-primary px-3 py-1.5 border border-[#e7edf3] rounded-lg hover:bg-primary-light transition-colors"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
                </svg>
                上傳檔案 (.txt/.csv/.xlsx)
              </button>
              {pastedText && (
                <button onClick={() => setPastedText('')} className="text-xs text-[#94a3b8] hover:text-red-500 transition-colors">
                  清除
                </button>
              )}
            </div>
          </div>
        )}

        {/* Image mode */}
        {inputMode === 'image' && (
          <div className="space-y-3">
            <input ref={imageRef} type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
            {uploadedImage ? (
              <div className="relative">
                <img
                  src={uploadedImage.preview}
                  alt="用藥截圖"
                  className="max-h-96 rounded-xl border border-[#e7edf3] object-contain w-full"
                />
                <button
                  onClick={() => { setUploadedImage(null); if (imageRef.current) imageRef.current.value = ''; }}
                  className="absolute top-2 right-2 bg-white border border-[#e7edf3] rounded-full p-1.5 text-[#4e7397] hover:text-red-500 shadow transition-colors"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                  </svg>
                </button>
              </div>
            ) : (
              <button
                onClick={() => imageRef.current?.click()}
                className="w-full border-2 border-dashed border-[#e7edf3] rounded-xl py-12 flex flex-col items-center gap-3 text-[#4e7397] hover:border-primary hover:bg-primary-light transition-colors"
              >
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/>
                  <polyline points="21 15 16 10 5 21"/>
                </svg>
                <div className="text-center">
                  <p className="font-medium">點擊上傳截圖</p>
                  <p className="text-xs mt-0.5">支援 JPG、PNG、WEBP</p>
                </div>
              </button>
            )}
          </div>
        )}

        {/* ── Manual entry ── */}
        <div className="border-t border-[#e7edf3] pt-4 space-y-3">
          <p className="text-sm font-medium text-[#0e141b]">手動新增（中藥・保健食品・食品）</p>
          <div className="flex flex-wrap gap-2">
            <select
              value={manualForm.type}
              onChange={e => setManualForm(f => ({ ...f, type: e.target.value as ManualEntryType }))}
              className="border border-[#e7edf3] rounded-lg px-3 py-2 text-sm text-[#0e141b] focus:outline-none focus:ring-2 focus:ring-primary/30"
            >
              {(['中藥', '保健食品', '一般食品', '西藥'] as ManualEntryType[]).map(t => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
            <input
              value={manualForm.name}
              onChange={e => setManualForm(f => ({ ...f, name: e.target.value }))}
              onKeyDown={e => e.key === 'Enter' && addManual()}
              placeholder="名稱（如：丹參、魚油）"
              className="border border-[#e7edf3] rounded-lg px-3 py-2 text-sm text-[#0e141b] placeholder-[#94a3b8] focus:outline-none focus:ring-2 focus:ring-primary/30 w-40 flex-1 min-w-32"
            />
            <input
              value={manualForm.dosage}
              onChange={e => setManualForm(f => ({ ...f, dosage: e.target.value }))}
              placeholder="劑量（如：500mg）"
              className="border border-[#e7edf3] rounded-lg px-3 py-2 text-sm text-[#0e141b] placeholder-[#94a3b8] focus:outline-none focus:ring-2 focus:ring-primary/30 w-32"
            />
            <input
              value={manualForm.frequency}
              onChange={e => setManualForm(f => ({ ...f, frequency: e.target.value }))}
              placeholder="用法（如：每天2次）"
              className="border border-[#e7edf3] rounded-lg px-3 py-2 text-sm text-[#0e141b] placeholder-[#94a3b8] focus:outline-none focus:ring-2 focus:ring-primary/30 w-32"
            />
            <button
              onClick={addManual}
              disabled={!manualForm.name.trim()}
              className="px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              新增
            </button>
          </div>

          {manualEntries.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {manualEntries.map(e => (
                <div key={e.id} className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border ${TYPE_BADGE[e.type] ?? 'bg-gray-100 text-gray-700'} border-transparent`}>
                  <span className="opacity-60">{e.type}</span>
                  <span className="font-semibold">{e.name}</span>
                  {e.dosage && <span className="opacity-70">{e.dosage}</span>}
                  {e.frequency && <span className="opacity-70">{e.frequency}</span>}
                  <button onClick={() => removeManual(e.id)} className="ml-0.5 hover:opacity-100 opacity-50 transition-opacity">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Analyze button */}
        <button
          onClick={handleAnalyze}
          disabled={isLoading}
          className="w-full py-3 bg-primary text-white font-semibold rounded-xl hover:bg-primary/90 disabled:opacity-60 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
        >
          {isLoading ? (
            <>
              <svg className="animate-spin w-5 h-5" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="40" strokeDashoffset="10" strokeLinecap="round" />
              </svg>
              AI 正在分析用藥資料…
            </>
          ) : (
            <>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/>
                <path d="M11 8v6M8 11h6" strokeLinecap="round"/>
              </svg>
              開始 AI 用藥安全分析
            </>
          )}
        </button>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm">{error}</div>
        )}
      </div>

      {/* ── Results ── */}
      {result && (
        <div id="drug-check-result" className="space-y-5">
          {/* Download report */}
          <div className="flex justify-end">
            <button
              onClick={() => downloadDrugCheckReport(result, patient)}
              className="flex items-center gap-1.5 text-sm font-medium text-primary px-4 py-2 border border-primary/30 rounded-lg hover:bg-primary-light transition-colors"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
              </svg>
              下載評估報告
            </button>
          </div>

          {/* Summary banner */}
          <div className={`rounded-2xl p-5 border ${
            hasMajor || highRiskCount >= 2
              ? 'bg-red-50 border-red-200'
              : highRiskCount >= 1 || totalInteractions > 0
              ? 'bg-amber-50 border-amber-200'
              : 'bg-green-50 border-green-200'
          }`}>
            <div className="flex items-start gap-3">
              <div className={`mt-0.5 w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                hasMajor || highRiskCount >= 2 ? 'bg-red-200' : highRiskCount >= 1 || totalInteractions > 0 ? 'bg-amber-200' : 'bg-green-200'
              }`}>
                {hasMajor || highRiskCount >= 2 ? (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-red-700">
                    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
                  </svg>
                ) : highRiskCount >= 1 || totalInteractions > 0 ? (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-amber-700">
                    <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                  </svg>
                ) : (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-green-700">
                    <polyline points="20 6 9 17 4 12"/>
                  </svg>
                )}
              </div>
              <div>
                <p className="font-semibold text-[#0e141b] mb-1">整體評估摘要</p>
                <p className="text-sm text-[#0e141b]">{result.summary}</p>
                {result.recommendations?.length > 0 && (
                  <ul className="mt-2 space-y-1">
                    {result.recommendations.map((r, i) => (
                      <li key={i} className="text-sm text-[#4e7397] flex items-start gap-1.5">
                        <span className="mt-0.5 text-primary shrink-0">•</span>{r}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 bg-[#f1f5f9] p-1 rounded-xl">
            {([
              ['meds', `解析藥品（${result.parsedMedications?.length ?? 0}）`],
              ['interactions', `交互作用（${totalInteractions}）`],
              ['risks', '風險評估'],
            ] as const).map(([tab, label]) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`flex-1 py-2 text-sm font-medium rounded-lg transition-colors ${
                  activeTab === tab
                    ? 'bg-white text-[#0e141b] shadow-sm'
                    : 'text-[#4e7397] hover:text-[#0e141b]'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Tab content */}
          <div className="bg-white border border-[#e7edf3] rounded-2xl overflow-hidden">

            {/* Parsed meds */}
            {activeTab === 'meds' && (
              <div>
                {!result.parsedMedications?.length ? (
                  <p className="text-sm text-[#4e7397] p-6 text-center">未解析到任何藥品。</p>
                ) : (
                  <div className="divide-y divide-[#e7edf3]">
                    {result.parsedMedications.map((med: ParsedMedication, i) => (
                      <div key={i} className="px-5 py-4 flex items-start gap-3">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 mt-0.5 ${TYPE_BADGE[med.type] ?? 'bg-gray-100 text-gray-700'}`}>
                          {med.type}
                        </span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-baseline gap-2 flex-wrap">
                            <span className="font-semibold text-[#0e141b]">{med.name}</span>
                            {med.genericName && med.genericName !== med.name && (
                              <span className="text-xs text-[#4e7397]">{med.genericName}</span>
                            )}
                            {med.brandName && med.brandName !== med.name && (
                              <span className="text-xs text-[#4e7397]">（{med.brandName}）</span>
                            )}
                          </div>
                          <div className="flex flex-wrap gap-x-4 gap-y-0.5 mt-1">
                            {med.dosage    && <span className="text-xs text-[#4e7397]">劑量：{med.dosage}</span>}
                            {med.form      && <span className="text-xs text-[#4e7397]">劑型：{med.form}</span>}
                            {med.route     && <span className="text-xs text-[#4e7397]">用法：{med.route}</span>}
                            {med.frequency && <span className="text-xs text-[#4e7397]">頻率：{med.frequency}</span>}
                            {med.indication && <span className="text-xs text-[#4e7397]">適應症：{med.indication}</span>}
                          </div>
                        </div>
                        {med.source === 'manual' && (
                          <span className="text-xs text-[#94a3b8] shrink-0">手動</span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Interactions */}
            {activeTab === 'interactions' && (
              <div className="p-5 space-y-4">
                {/* Drug-drug */}
                <div>
                  <p className="text-sm font-semibold text-[#0e141b] mb-2 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-primary inline-block" />
                    藥物－藥物交互作用
                  </p>
                  {!result.drugInteractions?.length ? (
                    <p className="text-sm text-[#4e7397] bg-green-50 border border-green-200 rounded-xl px-4 py-3">
                      未偵測到顯著藥物-藥物交互作用。
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {result.drugInteractions.map((ix, i) => (
                        <InteractionCard key={i} ix={ix} label="藥物" />
                      ))}
                    </div>
                  )}
                </div>

                {/* Food interactions */}
                <div>
                  <p className="text-sm font-semibold text-[#0e141b] mb-2 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-green-500 inline-block" />
                    藥物－食物交互作用
                  </p>
                  {!result.foodInteractions?.length ? (
                    <p className="text-sm text-[#4e7397] bg-green-50 border border-green-200 rounded-xl px-4 py-3">
                      未偵測到顯著藥物-食物交互作用。
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {result.foodInteractions.map((ix, i) => (
                        <InteractionCard key={i} ix={ix} label="食物" />
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Risk assessment */}
            {activeTab === 'risks' && (
              <div className="p-5 space-y-3">
                {result.fallRisk && (
                  <RiskCard title="跌倒風險指數（Beers Criteria / STOPP v3）" risk={result.fallRisk} />
                )}
                {result.anticholinergicBurden && (
                  <RiskCard title="抗膽鹼負擔指數（ACB Scale）" risk={result.anticholinergicBurden} />
                )}
                {result.sedationRisk && (
                  <RiskCard title="鎮靜昏睡風險" risk={result.sedationRisk} />
                )}
              </div>
            )}
          </div>

          {/* Disclaimer */}
          <p className="text-xs text-[#94a3b8] text-center pb-2">
            ⚠ {result.disclaimer}
          </p>
        </div>
      )}
    </div>
  );
}
