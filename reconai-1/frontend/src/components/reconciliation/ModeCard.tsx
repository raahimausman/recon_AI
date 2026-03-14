'use client';

import React from 'react';

interface ModeCardProps {
  title: string;
  description: string;
  enabled: boolean;
  selected: boolean;
  onSelect: () => void;
}

export default function ModeCard({
  title,
  description,
  enabled,
  selected,
  onSelect,
}: ModeCardProps) {
  return (
    <button
      onClick={() => enabled && onSelect()}
      disabled={!enabled}
      className={`
        w-full text-left border-2 rounded-lg p-4 md:py-6 md:px-4 mb-4
        transition
        ${enabled ? 'border-[#059DC0] hover:bg-[#E0F7FA] cursor-pointer' : 'border-gray-300 opacity-50 cursor-default'}
        ${selected && enabled ? 'border-4 border-[#059DC0] bg-[#E0F7FA]' : ''}
      `}
    >
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-y-4 gap-x-8">
        <h3 className={`text-sm md:text-base font-semibold ${enabled ? 'text-black' : 'text-gray-500'}`}>
          {title}
        </h3>
        <p className={`text-sm text-right md:text-sm ${enabled ? 'text-gray-700' : 'text-gray-400'}`}>
          {description}
        </p>
      </div>
    </button>
  );
}