'use client';

import { useState, useRef, useEffect } from 'react';
import { FaPlus } from 'react-icons/fa';
import { OPTIONS, SourceType } from '@/types/source';

interface AddSourceProps {
  onSelect: (selected: SourceType) => void;
}

export default function AddSource({ onSelect }: AddSourceProps) {
  const [open, setOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState<number | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const handleSelect = (option: SourceType) => {
    onSelect(option);
    setOpen(false);
  };

  const toggleDropdown = () => {
    if (!open) {
      setHighlightedIndex(0);  // Default highlight first item
    }
    setOpen(!open);
  };

  // Click outside to close
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="relative inline-block" ref={dropdownRef}>
      <button
        onClick={toggleDropdown}
        className="cursor-pointer flex items-center border-2 border-[#059DC0] text-black font-semibold px-6 py-3 text-base rounded-lg focus:outline-none"
      >
        <FaPlus className="mr-4 text-2xl text-gray-700" />
        Add Source
      </button>

      {open && (
        <div className="absolute z-10 mt-2 w-56 bg-white border border-black rounded-md shadow-lg top-10 left-4 overflow-hidden">
          {OPTIONS.map((option, index) => (
            <button
              key={index}
              onClick={() => handleSelect(option)}
              onMouseEnter={() => setHighlightedIndex(index)}
              className={`cursor-pointer w-full text-left px-4 py-2 text-sm
                ${index !== 0 ? 'border-t border-black' : ''}
                ${highlightedIndex === index ? 'bg-[#E0F7FA]' : ''}
              `}
            >
              {option}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}