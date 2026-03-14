'use client';
import OverviewCard   from './OverviewCard';
import { MdReceiptLong, MdReportProblem } from 'react-icons/md';
import { FaCheckCircle, FaExclamationCircle, FaUpload } from 'react-icons/fa';

interface Props { stats: Record<string, number>; }


function toTitleCase(str: string) {
  return str
    .replace(/([A-Z])/g, ' $1') // Add space before capital letters
    .replace(/_/g, ' ')         // Replace underscores with spaces
    .replace(/\s+/g, ' ')       // Remove extra spaces
    .trim()
    .toLowerCase()
    .replace(/\b\w/g, c => c.toUpperCase()); // Capitalize first letter of each word
}

export default function ResultsOverview({ stats }: Props) {
  /* choose icons for the first three keys, fall back afterward */
  
  const iconFor = (label: string) => {
    const lower = label.toLowerCase();
    if (lower.includes('total'))    return <MdReceiptLong className="text-blue-500" />;
    if (lower.includes('upload'))   return <FaUpload className="text-purple-500" />;
    if (lower.includes('missing'))  return <FaExclamationCircle className="text-red-500" />;
    if (lower.includes('matched'))  return <FaCheckCircle className="text-green-500" />;
    if (lower.includes('issue'))    return <MdReportProblem className="text-orange-500" />;
    return undefined;
  };

  const entries = Object.entries(stats);   // preserves order we put in adapter

  return (
    <>
      <h2 className="text-xl font-bold mb-12">Overview</h2>
      <div className="flex flex-col md:flex-row flex-wrap gap-x-16 gap-y-8 justify-center mb-12">
        {entries.map(([label, value]) => (
          <OverviewCard
            key={label}
            title={toTitleCase(label)}
            value={value}
            icon={iconFor(label)}
          />
        ))}
      </div>
    </>
  );
}
