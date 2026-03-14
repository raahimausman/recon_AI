'use client';

import BackButton from '@/components/BackButton';
import LoginForm from '@/components/authentication/LoginForm';

export default function LoginPage() {
  return (
    <main className="relative min-h-screen bg-white flex items-center justify-center py-12">
      {/* Back Arrow */}
      <div className="absolute top-4 left-8 z-10">
        <BackButton />
      </div>

      {/* Centered Login Form */}
      <div className="w-full max-w-2xl overflow-hidden px-16">
        <LoginForm />
      </div>
    </main>
  );
}