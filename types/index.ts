// ===== 慢箋個案 =====
export interface Patient {
  rowIndex: number;        // Google Sheets 列號（從 2 開始，1 = 標題列）
  name: string;            // 個案姓名
  phone: string;           // 個案電話
  dob: string;             // 出生年月日 (YYYY-MM-DD)
  gender: string;          // 性別
  firstPickupDate: string; // 第一次領藥日 (YYYY-MM-DD)
  prescriptionDays: number;// 處方天數
  district: string;        // 居住里別
  pickedSecond: boolean;   // 已領第二次
  pickedThird: boolean;    // 已領第三次
  completed: boolean;      // 已結案
}

// 計算出的日期欄位（不存 Google Sheets，前端計算）
export interface PatientWithDates extends Patient {
  secondStart: string;
  secondEnd: string;
  thirdStart: string;
  thirdEnd: string;
  returnVisit: string;
  status: string;
  age: number;
}

// ===== 藥品清單 =====
export interface Drug {
  rowIndex: number;  // Google Sheets 列號
  name: string;      // 藥品名稱
  dosage: string;    // 劑量
  brand: string;     // 廠牌
  note: string;      // 備注
}

// ===== 借還紀錄 =====
export type TransactionType = '借出' | '歸還';

export interface Transaction {
  rowIndex: number;      // Google Sheets 列號
  date: string;          // 日期 (YYYY-MM-DD)
  drugName: string;      // 藥品名稱
  dosage: string;        // 劑量
  brand: string;         // 廠牌
  type: TransactionType; // 借出 or 歸還
  person: string;        // 借方 / 歸還者
  quantity: number;      // 數量（正數）
  expectedReturn: string;// 預計歸還日（借出時填）
  note: string;          // 備注
}

// 藥品目前餘量（彙算用）
export interface DrugBalance {
  drugName: string;
  dosage: string;
  brand: string;
  balance: number;    // 正 = 可借出，負 = 已超借
  totalLent: number;
  totalReturned: number;
}

// ===== API 回應格式 =====
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}
