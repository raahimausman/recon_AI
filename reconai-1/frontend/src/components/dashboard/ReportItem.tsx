'use client';
import { FiDownload, FiTrash2 } from 'react-icons/fi';
import { getFileName } from '@/utils/getFileName';
import { url } from 'inspector/promises';

interface Props {
  filename   : string;
  url        : string;
  completedAt: Date;
  onDownload : () => void;
  onDelete   : () => void;
}

export default function ReportItem({
  filename, url, completedAt, onDownload, onDelete,
}: Props) {

  const fileName = getFileName(url);

  return (
    <div className="border border-[1.5px] border-[#059DC0] rounded-lg py-3 p-4 mb-4 flex items-center">
      {/* NAME (left) */}
      <span className="flex-1 font-medium">{fileName}</span>

      <div className='flex flex-col gap-y-2 items-end'>
        {/* DATE (top-right) */}
        <span className="text-xs text-gray-500">
            {new Date(completedAt).toLocaleString('en-US', {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
            hour12: true,
            })}
        </span>
        {/* ACTIONS (right) */}
        <div className='flex justify-start items-center gap-x-4'>
            <button onClick={onDownload} className="cursor-pointer text-green-600">
                <FiDownload size={20}/>
            </button>
            <button onClick={onDelete}  className="cursor-pointer text-red-600">
                <FiTrash2 size={20}/>
            </button>
        </div>
      </div>

    </div>
  );
}
