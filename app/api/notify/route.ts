import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const { message } = await req.json();

    const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
    const adminId = process.env.LINE_ADMIN_USER_ID;

    if (!token || !adminId) {
      return NextResponse.json(
        { success: false, error: 'LINE Bot 環境變數未設定' },
        { status: 400 }
      );
    }

    const res = await fetch('https://api.line.me/v2/bot/message/push', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        to: adminId,
        messages: [{ type: 'text', text: message }],
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`LINE API 錯誤: ${err}`);
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[POST /api/notify]', err);
    return NextResponse.json({ success: false, error: String(err) }, { status: 500 });
  }
}
