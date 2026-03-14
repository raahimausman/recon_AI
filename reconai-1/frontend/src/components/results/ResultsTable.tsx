'use client';
import StatusBadge from './StatusBadge';

/* rows arrive exactly as adapter produced them (array of objects) */
interface Props { rows: Record<string, any>[]; title?: string; }

export default function ResultsTable({ rows, title }: Props) {
  if (!rows || rows.length === 0) return null;

  const cols = Object.keys(rows[0]);

  return (
    <>
      {title && <h2 className="text-xl font-bold mb-8">{title}</h2>}

      <div className="overflow-x-auto border border-[#059DC0] rounded-lg mb-12">
        <table className="min-w-full text-sm">
          <thead className="bg-[#E0F7FA] border-b">
            <tr>
              {cols.map(c => (
                <th key={c} className="text-left px-4 py-4 capitalize">
                  {c.replace(/_/g, ' ')}
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {rows.map((row, i) => (
              <tr key={i} className="border-b hover:bg-gray-50">
                {cols.map(col => {
                  const val = row[col];

                  /* tiny helper – recognise common status field */
                  if (col === 'status' || col === 'issues')
                    return (
                      <td key={col} className="px-4 py-3">
                        <StatusBadge status={String(val)} />
                      </td>
                    );

                  return (
                    <td key={col} className="px-4 py-3">
                      {typeof val === 'number' ? val.toLocaleString() : String(val)}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
