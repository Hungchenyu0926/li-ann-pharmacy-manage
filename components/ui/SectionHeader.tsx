import Link from 'next/link';

// 共用區塊標題（可選「查看全部 →」連結）
export function SectionHeader({
  title,
  href,
  linkText = '查看全部 →',
}: {
  title: string;
  href?: string;
  linkText?: string;
}) {
  return (
    <div className="flex items-center justify-between mb-4">
      <h2 className="font-bold text-[#0e141b]">{title}</h2>
      {href && (
        <Link href={href} className="text-xs text-primary hover:underline">
          {linkText}
        </Link>
      )}
    </div>
  );
}
