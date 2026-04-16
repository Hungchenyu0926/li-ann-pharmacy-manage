import { NextRequest, NextResponse } from 'next/server';
import { listHistoricalTabs, getHistoricalMonthData } from '@/lib/sheets';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const tab = searchParams.get('tab');

    if (tab) {
      // 取得單一月份資料
      const data = await getHistoricalMonthData(tab);
      return NextResponse.json({ success: true, data });
    } else {
      // 列出所有 YYYYMM 分頁名稱
      const tabs = await listHistoricalTabs();
      return NextResponse.json({ success: true, data: tabs });
    }
  } catch (err) {
    console.error('[GET /api/historical-performance]', err);
    return NextResponse.json({ success: false, error: String(err) }, { status: 500 });
  }
}
