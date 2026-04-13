// ===== 慢箋個案（對應試算表欄位 A~J）=====
export interface Patient {
  rowIndex: number;        // Google Sheets 列號
  name: string;            // A: 個案姓名
  phone: string;           // B: 電話
  dob: string;             // C: 出生年月日 (YYYY-MM-DD)
  district: string;        // D: 居住里別
  firstPickupDate: string; // E: 第一次領藥日 (YYYY-MM-DD)
  pickedSecond: boolean;   // F: 已領第二次
  pickedThird: boolean;    // G: 已領第三次
  returnVisit: string;     // H: 回診日（手動填入，YYYY-MM-DD）
  completed: boolean;      // I: 已結案
  lineId: string;          // J: LINE_ID
}

// 計算出的日期欄位（前端計算，不存試算表）
export interface PatientWithDates extends Patient {
  secondStart: string;
  secondEnd: string;
  thirdStart: string;
  thirdEnd: string;
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
export type TransactionType = '借出' | '歸還' | '借入';

export interface Transaction {
  rowIndex: number;      // Google Sheets 列號
  date: string;          // 日期 (YYYY-MM-DD)
  drugName: string;      // 藥品名稱
  dosage: string;        // 劑量
  brand: string;         // 廠牌
  type: TransactionType; // 借出 / 歸還 / 借入
  person: string;        // 借出=借方，歸還=歸還者，借入=向誰借
  quantity: number;      // 數量（正數）
  expectedReturn: string;// 預計歸還日（借出時填）
  note: string;          // 備注
}

// 藥品目前餘量（彙算用）
export interface DrugBalance {
  drugName: string;
  dosage: string;
  brand: string;
  balance: number;       // 正 = 淨餘，負 = 淨欠
  totalLent: number;     // 借出合計
  totalReturned: number; // 歸還合計
  totalBorrowed: number; // 借入合計
}

// ===== API 回應格式 =====
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}
