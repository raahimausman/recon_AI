'use client';
import Image from 'next/image';

import React from 'react';

interface IngestionOptionCardProps {
  title: string;
  icon: string;
  onClick: () => void;
}

export default function IngestionOptionCard({
  title,
  icon,
  onClick,
}: IngestionOptionCardProps) {
  return (
    <button
      onClick={onClick}
      className="cursor-pointer flex flex-col items-center justify-center px-6 py-2 border border-[#059DC0] rounded-lg bg-[#E0F7FA] focus:outline-none w-56 h-32 transition-transform duration-200 ease-in-out hover:scale-105"
    >
      <Image
        src={icon}
        alt={title}
        width={32}
        height={32}
        className="w-8 h-8 mb-4"
      />
      <h3 className="text-base font-semibold mb-2">{title}</h3>
    </button>
  );
}
