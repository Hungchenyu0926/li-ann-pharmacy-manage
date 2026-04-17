import { NextRequest, NextResponse } from 'next/server';
import { getTransactions, addTransaction, updateTransaction, deleteTransaction } from '@/lib/sheets';
import type { Transaction } from '@/types';

export async function GET() {
  try {
    const transactions = await getTransactions();
    return NextResponse.json({ success: true, data: transactions });
  } catch (err) {
    console.error('[GET /api/transactions]', err);
    return NextResponse.json({ success: false, error: String(err) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body: Omit<Transaction, 'rowIndex'> = await req.json();
    await addTransaction(body);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[POST /api/transactions]', err);
    return NextResponse.json({ success: false, error: String(err) }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body: Transaction = await req.json();
    await updateTransaction(body);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[PUT /api/transactions]', err);
    return NextResponse.json({ success: false, error: String(err) }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { rowIndex } = await req.json();
    await deleteTransaction(rowIndex);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[DELETE /api/transactions]', err);
    return NextResponse.json({ success: false, error: String(err) }, { status: 500 });
  }
}
