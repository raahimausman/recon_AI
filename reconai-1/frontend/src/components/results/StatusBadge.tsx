'use client';

/* Accept any status string now */
interface StatusBadgeProps {
  status: string;
}

export default function StatusBadge({ status }: StatusBadgeProps) {
  /* normalise (optional - makes the switch easier) */
  const s = status.trim();

  let colorClasses = '';

  switch (s) {
    case 'Matched':
    case 'Fully Matched':
      colorClasses = 'bg-green-100 text-green-800 border-green-400';
      break;

    case 'Mismatch':
    case 'Amount Mismatch':
    case 'Vendor Mismatch':
    case 'Over/Under Applied':
      colorClasses = 'bg-red-100 text-red-800 border-red-400';
      break;

    case 'Unused':
    case 'Unused Cheque':
      colorClasses = 'bg-yellow-100 text-yellow-800 border-yellow-400';
      break;

    case 'Missing Proof':
    case 'Missing GRN':
    case 'Missing in Summary':
      colorClasses = 'bg-orange-100 text-orange-800 border-orange-400';
      break;

    default:
      colorClasses = 'bg-gray-100 text-gray-800 border-gray-400';
  }

  return (
    <span
      className={`inline-block text-xs font-semibold px-3 py-1 border rounded-full whitespace-nowrap ${colorClasses}`}
    >
      {s}
    </span>
  );
}