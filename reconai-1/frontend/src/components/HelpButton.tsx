'use client';
import Image from 'next/image';

export default function HelpButton() {
  return (
    <button
      onClick={() => alert('Contact support or open help docs')}
      className="cursor-pointer fixed bottom-8 right-8 bg-[#059DC0] text-white px-4 py-2 rounded-lg shadow-lg transition transform hover:scale-110"
    >
    <div className="flex items-center space-x-2 relative">
        <span className="absolute -top-4 -left-4 w-7 h-7">
            <Image
                src="/assets/chatbot-vector.png"
                alt="Help Icon"
                layout="fill"
                objectFit="contain"
                priority
            />
        </span>
        <span className="pl-5 font-semibold">Need Help?</span>
    </div>
    </button>
  );
}