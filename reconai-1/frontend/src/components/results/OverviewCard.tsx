'use client';

interface OverviewCardProps {
  title: string;
  value: number;
  icon?: React.ReactNode;
}

export default function OverviewCard({ title, value, icon }: OverviewCardProps) {
  return (
    <div className="flex flex-col items-center justify-center bg-[#E0F7FA] border border-[#059DC0] rounded-lg px-6 py-10 w-full md:w-48">
      <div className="text-3xl font-bold mb-2 flex items-center gap-2">
        {value}
        {icon && icon}
      </div>
      <p className="text-sm text-center font-medium">{title}</p>
    </div>
  );
}