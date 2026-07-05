// 共用讀取中動畫元件
export function Spinner() {
  return (
    <svg className="animate-spin w-6 h-6 mr-2" viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
    </svg>
  );
}

// 置中的讀取區塊（預設文字「讀取資料中...」）
export function LoadingBlock({ label = '讀取資料中...' }: { label?: string }) {
  return (
    <div className="flex items-center justify-center h-64 text-[#4e7397]">
      <Spinner />
      {label}
    </div>
  );
}
