import type { Metadata } from 'next';
import './globals.css';
import Sidebar from '@/components/Sidebar';

export const metadata: Metadata = {
  title: '立安藥局 管理系統',
  description: '立安藥局慢箋提醒與藥品借還管理平台',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-TW">
      <body>
        <Sidebar />
        {/* 桌面版：左移 224px（側邊欄寬度）；手機版：上移 52px（Hamburger 列） */}
        <main className="lg:ml-56 pt-[52px] lg:pt-0 min-h-screen">
          <div className="p-4 md:p-6 lg:p-8 max-w-[1400px] mx-auto">
            {children}
          </div>
        </main>
      </body>
    </html>
  );
}
