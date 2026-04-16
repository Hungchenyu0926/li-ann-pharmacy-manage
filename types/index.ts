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

// ===== 歷史月度紀錄（YYYYMM 分頁格式）=====
export interface HistoricalDayRecord {
  date: string;           // YYYY-MM-DD（由分頁名 + 日期欄解析）
  weekday: string;        // 星期X
  weather: string;        // 晴/雨/颱風/大風
  totalCustomers: number;
  firstRxLijian: number;
  rx23Lijian: number;
  lijianRx: number;
  externalRx: number;
  dentalRx: number;
  revenue: number;
  salesCount: number;
  note: string;           // 休診 / 備注
  isHoliday: boolean;
}

// ===== API 回應格式 =====
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

// ===== 業績紀錄 =====
export type WeatherType = '晴' | '雨' | '颱風' | '大風';

export interface PerformanceRecord {
  rowIndex: number;
  date: string;            // A: 日期 (YYYY-MM-DD)
  weather: WeatherType;    // B: 天氣
  totalCustomers: number;  // C: 總人數
  firstRxLijian: number;   // D: 立健首次慢箋
  rx23Lijian: number;      // E: 2/3次慢箋人數
  lijianRx: number;        // F: 立健慢箋
  externalRx: number;      // G: 外來慢箋人數
  dentalRx: number;        // H: 牙科箋人數
  revenue: number;         // I: 營業額
  salesCount: number;      // J: 銷售人數
}
