import { NextRequest, NextResponse } from 'next/server';
import {
  getPatients,
  addPatient,
  updatePatient,
  deletePatient,
} from '@/lib/sheets';
import type { Patient } from '@/types';

export async function GET() {
  try {
    const patients = await getPatients();
    return NextResponse.json({ success: true, data: patients });
  } catch (err) {
    console.error('[GET /api/patients]', err);
    return NextResponse.json({ success: false, error: String(err) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body: Omit<Patient, 'rowIndex'> = await req.json();
    await addPatient(body);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[POST /api/patients]', err);
    return NextResponse.json({ success: false, error: String(err) }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body: Patient = await req.json();
    await updatePatient(body);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[PUT /api/patients]', err);
    return NextResponse.json({ success: false, error: String(err) }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { rowIndex } = await req.json();
    await deletePatient(rowIndex);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[DELETE /api/patients]', err);
    return NextResponse.json({ success: false, error: String(err) }, { status: 500 });
  }
}
