'use client';

import { useRouter } from 'next/navigation';
import { IoArrowBack } from 'react-icons/io5';

export default function BackButton() {
  const router = useRouter();

  return (
    <button
      onClick={() => router.back()}
      className="cursor-pointer text-black text-3xl px-0 pt-4 pb-2 md:pt-6 md:pb-2 focus:outline-none"
      aria-label="Back"
    >
      <IoArrowBack size={32}/>
    </button>
  );
}
