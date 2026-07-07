// 共用空狀態區塊
export function EmptyState({ icon, message }: { icon: React.ReactNode; message: string }) {
  return (
    <div className="text-center py-8 text-[#94a3b8] text-sm">
      <div className="text-2xl mb-2">{icon}</div>
      {message}
    </div>
  );
}
