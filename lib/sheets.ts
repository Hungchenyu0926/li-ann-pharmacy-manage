import { google } from 'googleapis';
import type { Patient, Drug, Transaction, PerformanceRecord, WeatherType, HistoricalDayRecord } from '@/types';
import { normalizeDate } from '@/lib/dateUtils';

const SHEET_ID = process.env.SHEET_ID!;

// 各分頁名稱
const TAB_PATIENTS = '工作表1';
const TAB_DRUGS = '藥品清單';
const TAB_TRANSACTIONS = '借還紀錄';
const TAB_PERFORMANCE = '業績記錄';

// ===== 認證 =====
function getAuth() {
  const raw = process.env.GOOGLE_CREDENTIALS;
  if (!raw) throw new Error('缺少 GOOGLE_CREDENTIALS 環境變數');
  const credentials = JSON.parse(raw);
  return new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
}

async function getSheetsClient() {
  const auth = getAuth();
  const authClient = await auth.getClient();
  return google.sheets({ version: 'v4', auth: authClient as Parameters<typeof google.sheets>[0]['auth'] });
}

// ===== 取得分頁數字 ID（刪除列時需要） =====
async function getTabId(tabName: string): Promise<number> {
  const sheets = await getSheetsClient();
  const res = await sheets.spreadsheets.get({ spreadsheetId: SHEET_ID });
  const tab = res.data.sheets?.find(s => s.properties?.title === tabName);
  const sheetId = tab?.properties?.sheetId;
  if (sheetId == null) throw new Error(`找不到分頁：${tabName}`);
  return sheetId;
}

// ===== 讀取範圍 =====
async function readRange(range: string): Promise<string[][]> {
  const sheets = await getSheetsClient();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range,
  });
  return (res.data.values as string[][] | undefined) ?? [];
}

// ===== 新增一列 =====
async function appendRow(tab: string, values: (string | number | boolean)[]) {
  const sheets = await getSheetsClient();
  await sheets.spreadsheets.values.append({
    spreadsheetId: SHEET_ID,
    range: `${tab}!A1`,
    valueInputOption: 'RAW',
    requestBody: { values: [values] },
  });
}

// ===== 更新指定列 =====
async function updateRow(tab: string, rowIndex: number, values: (string | number | boolean)[]) {
  const sheets = await getSheetsClient();
  const colEnd = String.fromCharCode(64 + values.length); // A=65
  await sheets.spreadsheets.values.update({
    spreadsheetId: SHEET_ID,
    range: `${tab}!A${rowIndex}:${colEnd}${rowIndex}`,
    valueInputOption: 'RAW',
    requestBody: { values: [values] },
  });
}

// ===== 刪除指定列 =====
async function deleteRow(tab: string, rowIndex: number) {
  const sheets = await getSheetsClient();
  const tabId = await getTabId(tab);
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: SHEET_ID,
    requestBody: {
      requests: [{
        deleteDimension: {
          range: {
            sheetId: tabId,
            dimension: 'ROWS',
            startIndex: rowIndex - 1, // 0-based
            endIndex: rowIndex,
          },
        },
      }],
    },
  });
}

// ===== 確保分頁存在（第一次執行時建立標題） =====
export async function ensureDrugTabs() {
  const sheets = await getSheetsClient();
  const res = await sheets.spreadsheets.get({ spreadsheetId: SHEET_ID });
  const existingTabs = res.data.sheets?.map(s => s.properties?.title ?? '') ?? [];

  const requests: object[] = [];

  if (!existingTabs.includes(TAB_DRUGS)) {
    requests.push({ addSheet: { properties: { title: TAB_DRUGS } } });
  }
  if (!existingTabs.includes(TAB_TRANSACTIONS)) {
    requests.push({ addSheet: { properties: { title: TAB_TRANSACTIONS } } });
  }

  if (requests.length > 0) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SHEET_ID,
      requestBody: { requests },
    });

    // 建立標題列
    if (!existingTabs.includes(TAB_DRUGS)) {
      await appendRow(TAB_DRUGS, ['藥品名稱', '劑量', '廠牌', '備注']);
    }
    if (!existingTabs.includes(TAB_TRANSACTIONS)) {
      await appendRow(TAB_TRANSACTIONS, ['日期', '藥品名稱', '劑量', '廠牌', '類型', '借方', '數量', '預計歸還日', '備注']);
    }
  }
}

// ============================================================
// 慢箋個案 CRUD
// ============================================================

export async function getPatients(): Promise<Patient[]> {
  const rows = await readRange(`${TAB_PATIENTS}!A2:J10000`);
  // 先記住原始列位置（row 2 起），再過濾空列，避免 rowIndex 因空白列而偏移
  return rows
    .map((row, i) => ({ row, rowIndex: i + 2 }))
    .filter(({ row }) => row[0])
    .map(({ row, rowIndex }) => ({
      rowIndex,
      name: row[0] ?? '',
      phone: row[1] ?? '',
      dob: normalizeDate(row[2] ?? ''),
      district: row[3] ?? '',
      firstPickupDate: normalizeDate(row[4] ?? ''),
      pickedSecond: row[5] === 'TRUE' || row[5] === 'true',
      pickedThird: row[6] === 'TRUE' || row[6] === 'true',
      returnVisit: normalizeDate(row[7] ?? ''),
      completed: row[8] === 'TRUE' || row[8] === 'true',
      lineId: row[9] ?? '',
    }));
}

export async function addPatient(p: Omit<Patient, 'rowIndex'>) {
  await appendRow(TAB_PATIENTS, [
    p.name, p.phone, p.dob, p.district,
    p.firstPickupDate, p.pickedSecond, p.pickedThird,
    p.returnVisit, p.completed, p.lineId,
  ]);
}

export async function updatePatient(p: Patient) {
  await updateRow(TAB_PATIENTS, p.rowIndex, [
    p.name, p.phone, p.dob, p.district,
    p.firstPickupDate, p.pickedSecond, p.pickedThird,
    p.returnVisit, p.completed, p.lineId,
  ]);
}

export async function deletePatient(rowIndex: number) {
  await deleteRow(TAB_PATIENTS, rowIndex);
}

// ============================================================
// 藥品清單 CRUD
// ============================================================

export async function getDrugs(): Promise<Drug[]> {
  const rows = await readRange(`${TAB_DRUGS}!A2:D10000`);
  return rows.map((row, i) => ({
    rowIndex: i + 2,
    name: row[0] ?? '',
    dosage: row[1] ?? '',
    brand: row[2] ?? '',
    note: row[3] ?? '',
  }));
}

export async function addDrug(d: Omit<Drug, 'rowIndex'>) {
  await appendRow(TAB_DRUGS, [d.name, d.dosage, d.brand, d.note]);
}

export async function deleteDrug(rowIndex: number) {
  await deleteRow(TAB_DRUGS, rowIndex);
}

// ============================================================
// 借還紀錄 CRUD
// ============================================================

export async function getTransactions(): Promise<Transaction[]> {
  const rows = await readRange(`${TAB_TRANSACTIONS}!A2:I10000`);
  return rows.map((row, i) => ({
    rowIndex: i + 2,
    date: row[0] ?? '',
    drugName: row[1] ?? '',
    dosage: row[2] ?? '',
    brand: row[3] ?? '',
    type: (row[4] as '借出' | '歸還') ?? '借出',
    person: row[5] ?? '',
    quantity: parseInt(row[6] ?? '0', 10),
    expectedReturn: row[7] ?? '',
    note: row[8] ?? '',
  }));
}

export async function addTransaction(t: Omit<Transaction, 'rowIndex'>) {
  await appendRow(TAB_TRANSACTIONS, [
    t.date, t.drugName, t.dosage, t.brand, t.type,
    t.person, t.quantity, t.expectedReturn, t.note,
  ]);
}

export async function updateTransaction(t: Transaction) {
  await updateRow(TAB_TRANSACTIONS, t.rowIndex, [
    t.date, t.drugName, t.dosage, t.brand, t.type,
    t.person, t.quantity, t.expectedReturn, t.note,
  ]);
}

export async function deleteTransaction(rowIndex: number) {
  await deleteRow(TAB_TRANSACTIONS, rowIndex);
}

// ============================================================
// 業績 CRUD（統一寫入 YYYYMM 分頁，如 202604）
// ============================================================

// ── 輔助：日期字串轉 "X月X日" 格式 ──
function formatDayForTab(dateStr: string): string {
  const m = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return dateStr;
  return `${parseInt(m[2])}月${parseInt(m[3])}日`;
}

// ── 輔助：日期字串取得星期中文 ──
function getWeekdayStr(dateStr: string): string {
  const labels = ['日', '一', '二', '三', '四', '五', '六'];
  const d = new Date(dateStr);
  return isNaN(d.getTime()) ? '' : labels[d.getDay()];
}

// ── 輔助：UTC 安全的星期計算（Server 環境，避免時區偏移） ──
function getWeekdayStrUTC(dateStr: string): string {
  const labels = ['日', '一', '二', '三', '四', '五', '六'];
  const [ys, ms, ds] = dateStr.split('-');
  const y = parseInt(ys), m = parseInt(ms), d = parseInt(ds);
  if (!y || !m || !d) return '';
  return labels[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
}

// ── 輔助：解析 YYYYMM 分頁的「X月X日」→ YYYY-MM-DD ──
function parseDateFromMonthlyTab(tabName: string, dayStr: string): string {
  if (!/^\d{6}$/.test(tabName) || !dayStr) return '';
  const year  = tabName.slice(0, 4);
  const month = tabName.slice(4, 6);
  const match = dayStr.match(/\d+月(\d+)日/) ?? dayStr.match(/^(\d+)日$/) ?? dayStr.match(/^(\d+)$/);
  if (!match) return '';
  const day = match[1].padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// ── 輔助：若 YYYYMM 分頁不存在則建立（含標題列）──
async function ensureYearMonthTab(tabName: string): Promise<void> {
  const sheets = await getSheetsClient();
  const res    = await sheets.spreadsheets.get({ spreadsheetId: SHEET_ID });
  const exists = (res.data.sheets ?? []).some(s => s.properties?.title === tabName);
  if (!exists) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SHEET_ID,
      requestBody: { requests: [{ addSheet: { properties: { title: tabName } } }] },
    });
    await appendRow(tabName, [
      '日期', '星期', '天氣', '總人數',
      '立健首次慢箋', '2/3次慢箋人數', '立健慢箋', '外來慢箋人數', '牙科箋人數',
      '營業額', '銷售人數',
    ]);
  }
}

/**
 * 初始化 YYYYMM 分頁：建立分頁並預填全月日期與星期（含備注欄）。
 * 若分頁已存在，只補寫缺少的日期列。
 */
export async function initMonthTabWithDates(
  tabName: string,
): Promise<{ created: boolean; rowsAdded: number }> {
  if (!/^\d{6}$/.test(tabName)) throw new Error(`無效分頁名稱：${tabName}`);

  const year  = parseInt(tabName.slice(0, 4));
  const month = parseInt(tabName.slice(4, 6));
  // 取得該月天數（Date.UTC 的 day=0 會回到上個月最後一天）
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();

  const sheets = await getSheetsClient();
  const res    = await sheets.spreadsheets.get({ spreadsheetId: SHEET_ID });
  const existingTab = (res.data.sheets ?? []).find(
    s => s.properties?.title === tabName,
  );

  let created = false;
  const existingDayStrs = new Set<string>();

  if (!existingTab) {
    // 建立新分頁
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SHEET_ID,
      requestBody: {
        requests: [{ addSheet: { properties: { title: tabName } } }],
      },
    });
    // 寫標題列（含備注欄）
    await sheets.spreadsheets.values.update({
      spreadsheetId: SHEET_ID,
      range: `${tabName}!A1:L1`,
      valueInputOption: 'RAW',
      requestBody: {
        values: [[
          '日期', '星期', '天氣', '總人數',
          '立健首次慢箋', '2/3次慢箋人數', '立健慢箋', '外來慢箋人數', '牙科箋人數',
          '營業額', '銷售人數', '備注',
        ]],
      },
    });
    created = true;
  } else {
    // 讀取已存在的日期字串，避免重複
    const rows = await readRange(`${tabName}!A2:A100`);
    rows.forEach(r => { if (r[0]) existingDayStrs.add(r[0]); });
  }

  // 產生所有缺少的日期列
  const newRows: (string | number)[][] = [];
  for (let day = 1; day <= daysInMonth; day++) {
    const dayStr  = `${month}月${day}日`;
    if (existingDayStrs.has(dayStr)) continue;
    const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const weekday = getWeekdayStrUTC(dateStr);
    newRows.push([dayStr, weekday, '', '', '', '', '', '', '', '', '', '']);
  }

  if (newRows.length > 0) {
    await sheets.spreadsheets.values.append({
      spreadsheetId: SHEET_ID,
      range: `${tabName}!A1`,
      valueInputOption: 'RAW',
      requestBody: { values: newRows },
    });
  }

  return { created, rowsAdded: newRows.length };
}

/** 讀取所有 YYYYMM 分頁，回傳完整業績紀錄（含 sourceTab 與正確 rowIndex） */
export async function getPerformanceRecords(): Promise<PerformanceRecord[]> {
  const sheets     = await getSheetsClient();
  const sheetsMeta = await sheets.spreadsheets.get({ spreadsheetId: SHEET_ID });
  const allTitles  = sheetsMeta.data.sheets?.map(s => s.properties?.title ?? '') ?? [];
  const monthTabs  = allTitles.filter(t => /^\d{6}$/.test(t)).sort();
  if (monthTabs.length === 0) return [];

  // 一次批次讀取所有月份分頁
  const batchRes = await sheets.spreadsheets.values.batchGet({
    spreadsheetId: SHEET_ID,
    ranges: monthTabs.map(t => `${t}!A2:L1000`),
  });

  const allRecords: PerformanceRecord[] = [];
  const seenDates: Record<string, boolean> = {};

  (batchRes.data.valueRanges ?? []).forEach((vr, idx) => {
    const tabName = monthTabs[idx];
    const rows    = (vr.values as string[][] | undefined) ?? [];
    rows
      .map((row, i) => ({ row, rowIndex: i + 2 }))
      .filter(({ row }) => row[0])
      .forEach(({ row, rowIndex }) => {
        const date = parseDateFromMonthlyTab(tabName, row[0]);
        if (!date || seenDates[date]) return;
        seenDates[date] = true;
        allRecords.push({
          rowIndex,
          sourceTab:      tabName,
          date,
          weather:        (row[2] as WeatherType) || '晴',
          totalCustomers: parseInt(row[3]  ?? '0', 10) || 0,
          firstRxLijian:  parseInt(row[4]  ?? '0', 10) || 0,
          rx23Lijian:     parseInt(row[5]  ?? '0', 10) || 0,
          lijianRx:       parseInt(row[6]  ?? '0', 10) || 0,
          externalRx:     parseInt(row[7]  ?? '0', 10) || 0,
          dentalRx:       parseInt(row[8]  ?? '0', 10) || 0,
          revenue:        parseFloat(row[9] ?? '0')    || 0,
          salesCount:     parseInt(row[10] ?? '0', 10) || 0,
          note:           row[11] ?? '',
        });
      });
  });

  return allRecords.sort((a, b) => a.date.localeCompare(b.date));
}

/** 新增業績：依日期決定 YYYYMM 分頁（不存在時自動建立） */
export async function addPerformanceRecord(
  r: Omit<PerformanceRecord, 'rowIndex' | 'sourceTab'>,
) {
  const tabName = r.date.replace(/-/g, '').slice(0, 6); // "2026-04-17" → "202604"
  await ensureYearMonthTab(tabName);
  await appendRow(tabName, [
    formatDayForTab(r.date),  // "4月17日"
    getWeekdayStr(r.date),    // "三"
    r.weather,
    r.totalCustomers, r.firstRxLijian, r.rx23Lijian,
    r.lijianRx, r.externalRx, r.dentalRx, r.revenue, r.salesCount,
    r.note ?? '',
  ]);
}

/** 更新業績：寫回 sourceTab 的同一列（YYYYMM 格式） */
export async function updatePerformanceRecord(r: PerformanceRecord) {
  await updateRow(r.sourceTab, r.rowIndex, [
    formatDayForTab(r.date),
    getWeekdayStr(r.date),
    r.weather,
    r.totalCustomers, r.firstRxLijian, r.rx23Lijian,
    r.lijianRx, r.externalRx, r.dentalRx, r.revenue, r.salesCount,
    r.note ?? '',
  ]);
}

/** 刪除業績：從 sourceTab 刪除指定列 */
export async function deletePerformanceRecord(rowIndex: number, sourceTab: string) {
  await deleteRow(sourceTab, rowIndex);
}

// ============================================================
// 歷史月度業績（YYYYMM 格式分頁，如 202601、202602）
// ============================================================

/** 列出所有符合 YYYYMM 格式的分頁名稱，升序排列 */
export async function listHistoricalTabs(): Promise<string[]> {
  const sheets = await getSheetsClient();
  const res = await sheets.spreadsheets.get({ spreadsheetId: SHEET_ID });
  return (res.data.sheets ?? [])
    .map(s => s.properties?.title ?? '')
    .filter(t => /^\d{6}$/.test(t))
    .sort();
}

/** 讀取指定 YYYYMM 分頁的每日業績資料 */
export async function getHistoricalMonthData(tab: string): Promise<HistoricalDayRecord[]> {
  if (!/^\d{6}$/.test(tab)) throw new Error(`無效分頁名稱：${tab}`);
  const year  = parseInt(tab.slice(0, 4));
  const month = parseInt(tab.slice(4, 6));

  const rows = await readRange(`${tab}!A2:L100`);
  return rows
    .filter(row => row[0] && /\d+月\d+日/.test(row[0]))
    .map(row => {
      // 解析「1月1日」→ day 數字，年月從分頁名取得
      const dayMatch = row[0].match(/\d+月(\d+)日/);
      const day = dayMatch ? parseInt(dayMatch[1]) : 0;
      const date = day > 0
        ? `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
        : '';
      const note = row[11] ?? '';
      return {
        date,
        weekday:        row[1] ?? '',
        weather:        row[2] ?? '晴',
        totalCustomers: parseInt(row[3]  ?? '0') || 0,
        firstRxLijian:  parseInt(row[4]  ?? '0') || 0,
        rx23Lijian:     parseInt(row[5]  ?? '0') || 0,
        lijianRx:       parseInt(row[6]  ?? '0') || 0,
        externalRx:     parseInt(row[7]  ?? '0') || 0,
        dentalRx:       parseInt(row[8]  ?? '0') || 0,
        revenue:        parseFloat(row[9] ?? '0') || 0,
        salesCount:     parseInt(row[10] ?? '0') || 0,
        note,
        isHoliday: note.includes('休診'),
      };
    })
    .filter(r => r.date);
}

// ============================================================
// 慢箋月度統計（從 工作表1 個案紀錄彙算）
// ============================================================

export interface ChronicMonthStat {
  month: string;       // YYYY-MM
  newPatients: number; // 當月首次領藥個案數
  completed: number;   // 已結案個案中首次在該月的數
}

export async function getMonthlyChronicStats(): Promise<ChronicMonthStat[]> {
  const patients = await getPatients();
  const map: Record<string, { newPatients: number; completed: number }> = {};

  patients.forEach(p => {
    if (!p.firstPickupDate) return;
    const month = p.firstPickupDate.slice(0, 7);
    if (!month.match(/^\d{4}-\d{2}$/)) return;
    if (!map[month]) map[month] = { newPatients: 0, completed: 0 };
    map[month].newPatients++;
    if (p.completed) map[month].completed++;
  });

  return Object.entries(map)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, s]) => ({ month, ...s }));
}
