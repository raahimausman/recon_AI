'use client';
import Image from 'next/image';
import Link from 'next/link';

export default function HeroSection() {
  return (
    <section className="bg-white py-6 px-4 text-center">
      <div className="max-w-3xl mx-auto">
        <div className="flex flex-col md:flex-row items-center justify-center mb-6 gap-2">
          <h1 className="text-3xl md:text-5xl font-extrabold text-gray-900 mb-4 md:mb-0">
            AI-Powered Document Reconciliation
          </h1>
        </div>
        <p className="text-gray-700 text-base md:text-lg mb-8 max-w-2xl mx-auto">
          Upload, match, and reconcile your financial documents with our intelligent toolkit—no manual spreadsheet wrangling required.
        </p>
        <Link
          href="/reconciliation-mode"
          className="inline-block bg-[#059DC0] border border-black text-white font-semibold px-6 py-3 rounded-lg shadow hover:bg-[#047a99] transition"
        >
          Get Started
        </Link>
      </div>
    </section>
  );
}
