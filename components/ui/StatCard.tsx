// 共用統計卡片元件
export function StatCard({
  label,
  value,
  sub,
  color = 'blue',
  icon,
}: {
  label: string;
  value: number | string;
  sub?: string;
  color?: 'blue' | 'green' | 'orange' | 'red';
  icon: React.ReactNode;
}) {
  const colorMap = {
    blue: 'bg-blue-50 text-blue-600',
    green: 'bg-green-50 text-green-600',
    orange: 'bg-orange-50 text-orange-600',
    red: 'bg-red-50 text-red-600',
  };
  return (
    <div className="card flex items-center gap-4">
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${colorMap[color]}`}>
        {icon}
      </div>
      <div>
        <p className="text-xs text-[#4e7397] mb-0.5">{label}</p>
        <p className="text-2xl font-bold text-[#0e141b] leading-none">{value}</p>
        {sub && <p className="text-xs text-[#94a3b8] mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}
