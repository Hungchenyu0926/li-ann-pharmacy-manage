import { NextResponse } from 'next/server';
import { getMonthlyChronicStats } from '@/lib/sheets';

export async function GET() {
  try {
    const stats = await getMonthlyChronicStats();
    return NextResponse.json({ success: true, data: stats });
  } catch (err) {
    console.error('[GET /api/chronic-stats]', err);
    return NextResponse.json({ success: false, error: String(err) }, { status: 500 });
  }
}
