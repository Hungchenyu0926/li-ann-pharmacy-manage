import type { Patient } from '@/types';

export function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

/**
 * 將 Google Sheets 回傳的各種日期格式正規化成 YYYY-MM-DD
 * 支援：2025-01-15 / 2025/1/15 / 2025/01/15
 */
export function normalizeDate(raw: string): string {
  if (!raw) return '';
  const s = raw.trim();
  // 已經是 YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  // YYYY/M/D 或 YYYY/MM/DD
  const slashMatch = s.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})$/);
  if (slashMatch) {
    const [, y, m, d] = slashMatch;
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }
  // 其他：嘗試 Date 解析後重新格式化（用本地年月日避免時區問題）
  const date = new Date(s);
  if (!isNaN(date.getTime())) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  return s;
}

export function formatDate(date: Date): string {
  if (isNaN(date.getTime())) return '';
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function calculateAge(dob: string): number {
  if (!dob) return 0;
  const today = new Date();
  const birth = new Date(normalizeDate(dob));
  if (isNaN(birth.getTime())) return 0;
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  return age;
}

export function calculateDates(firstPickupDate: string, prescriptionDays: number) {
  const normalized = normalizeDate(firstPickupDate);
  const start = new Date(normalized);

  // 日期無效時回傳空字串，讓 checkStatus 顯示「資料不全」
  if (isNaN(start.getTime())) {
    return { secondStart: '', secondEnd: '', thirdStart: '', thirdEnd: '', returnVisit: '' };
  }

  const endCycle1 = addDays(start, prescriptionDays);
  const secondStart = addDays(endCycle1, -9);
  const secondEnd = endCycle1;

  const endCycle2 = addDays(endCycle1, prescriptionDays);
  const thirdStart = addDays(endCycle2, -9);
  const thirdEnd = endCycle2;

  const endCycle3 = addDays(endCycle2, prescriptionDays);
  const returnVisit = addDays(endCycle3, 1);

  return {
    secondStart: formatDate(secondStart),
    secondEnd: formatDate(secondEnd),
    thirdStart: formatDate(thirdStart),
    thirdEnd: formatDate(thirdEnd),
    returnVisit: formatDate(returnVisit),
  };
}

export function checkStatus(patient: Patient): string {
  try {
    if (patient.completed) return '🏁 已結案';
    if (!patient.firstPickupDate) return '資料不全';

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const dates = calculateDates(patient.firstPickupDate, patient.prescriptionDays);
    if (!dates.secondStart) return '資料不全';

    const toDate = (s: string) => {
      const d = new Date(s);
      d.setHours(0, 0, 0, 0);
      return d;
    };

    if (!patient.pickedSecond) {
      const remindStart = addDays(toDate(dates.secondStart), -7);
      const secondEnd = toDate(dates.secondEnd);
      const secondStart = toDate(dates.secondStart);
      if (remindStart <= today && today <= secondEnd) {
        return today < secondStart ? '⚠️ 即將進入第二次領藥期' : '🔴 請領取第二次藥物';
      }
      if (today > secondEnd) return '❌ 第二次領藥已過期';
    }

    if (!patient.pickedThird) {
      const remindStart = addDays(toDate(dates.thirdStart), -7);
      const thirdEnd = toDate(dates.thirdEnd);
      const thirdStart = toDate(dates.thirdStart);
      if (remindStart <= today && today <= thirdEnd) {
        return today < thirdStart ? '⚠️ 即將進入第三次領藥期' : '🔴 請領取第三次藥物';
      }
      if (today > thirdEnd && patient.pickedSecond) return '❌ 第三次領藥已過期';
    }

    if (patient.pickedSecond && patient.pickedThird) {
      const reviewRemind = addDays(toDate(dates.returnVisit), -7);
      if (today >= reviewRemind) return '🏥 建議準備回診';
      return '✅ 完成領藥';
    }

    return '🔵 一般追蹤中';
  } catch {
    return '資料不全';
  }
}
