import { google } from 'googleapis';
import type { Patient, Drug, Transaction } from '@/types';
import { normalizeDate } from '@/lib/dateUtils';

const SHEET_ID = process.env.SHEET_ID!;

// 各分頁名稱
const TAB_PATIENTS = '工作表1';
const TAB_DRUGS = '藥品清單';
const TAB_TRANSACTIONS = '借還紀錄';

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
  if (!tab?.properties?.sheetId) throw new Error(`找不到分頁：${tabName}`);
  return tab.properties.sheetId;
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
  return rows
    .filter(row => row[0]) // 跳過空列
    .map((row, i) => ({
      rowIndex: i + 2,
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

export async function deleteTransaction(rowIndex: number) {
  await deleteRow(TAB_TRANSACTIONS, rowIndex);
}
