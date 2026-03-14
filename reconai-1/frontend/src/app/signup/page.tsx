'use client';

import BackButton from '@/components/BackButton';
import SignUpForm from '@/components/authentication/SignUpForm';

export default function SignUpPage() {
  return (
    <main className="relative min-h-screen bg-white flex items-center justify-center py-12">
      {/* Back Arrow */}
      <div className="absolute top-4 left-8 z-10">
        <BackButton />
      </div>

      {/* Centered Sign Up Form */}
      <div className="w-full max-w-2xl overflow-hidden px-16">
        <SignUpForm />
      </div>
    </main>
  );
}