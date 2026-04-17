import { NextRequest, NextResponse } from 'next/server';
import {
  getPerformanceRecords,
  addPerformanceRecord,
  updatePerformanceRecord,
  deletePerformanceRecord,
} from '@/lib/sheets';
import type { PerformanceRecord } from '@/types';

export async function GET() {
  try {
    const records = await getPerformanceRecords();
    return NextResponse.json({ success: true, data: records });
  } catch (err) {
    console.error('[GET /api/performance]', err);
    return NextResponse.json({ success: false, error: String(err) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body: Omit<PerformanceRecord, 'rowIndex'> = await req.json();
    await addPerformanceRecord(body);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[POST /api/performance]', err);
    return NextResponse.json({ success: false, error: String(err) }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body: PerformanceRecord = await req.json();
    await updatePerformanceRecord(body);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[PUT /api/performance]', err);
    return NextResponse.json({ success: false, error: String(err) }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { rowIndex, sourceTab } = await req.json();
    await deletePerformanceRecord(rowIndex, sourceTab);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[DELETE /api/performance]', err);
    return NextResponse.json({ success: false, error: String(err) }, { status: 500 });
  }
}
