import { NextRequest, NextResponse } from 'next/server';
import { getDrugs, addDrug, deleteDrug, ensureDrugTabs } from '@/lib/sheets';
import type { Drug } from '@/types';

export async function GET() {
  try {
    await ensureDrugTabs();
    const drugs = await getDrugs();
    return NextResponse.json({ success: true, data: drugs });
  } catch (err) {
    console.error('[GET /api/drugs]', err);
    return NextResponse.json({ success: false, error: String(err) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body: Omit<Drug, 'rowIndex'> = await req.json();
    await addDrug(body);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[POST /api/drugs]', err);
    return NextResponse.json({ success: false, error: String(err) }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { rowIndex } = await req.json();
    await deleteDrug(rowIndex);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[DELETE /api/drugs]', err);
    return NextResponse.json({ success: false, error: String(err) }, { status: 500 });
  }
}
