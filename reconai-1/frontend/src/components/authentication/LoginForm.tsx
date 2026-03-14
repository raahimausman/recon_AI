'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FiEye, FiEyeOff } from 'react-icons/fi';
import { loginWithEmail, signInWithGoogle } from '@/lib/authentication';

export default function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false); 

  // Handle login form submission
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { user } = await loginWithEmail(email, password);
      console.log(user)
      router.push('/dashboard');
    } // eslint-disable-next-line @typescript-eslint/no-explicit-any
    catch (err: any) {
        console.error('Login error:', err);
        alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Handle Google login
  const handleGoogleLogin = async () => {
    setLoading(true);
    try {
      const { user } = await signInWithGoogle();
      router.push('/dashboard')
    } // eslint-disable-next-line @typescript-eslint/no-explicit-any
    catch (err: any) {
        console.error('Google login error:', err);
        alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center rounded-xl bg-[#E0F7FA] border border-[#059DC0] py-4 px-4">
      <div className="w-full max-w-md space-y-12 text-black">
        <div className="text-center">
          <h1 className="text-2xl font-bold">Welcome Back</h1>
          <p className="mt-1 text-sm text-gray-600">
            New to Recon AI?{' '}
            <Link href="/signup" className="text-[#059DC0] underline">Create an account</Link>
          </p>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-black mb-1">Email address</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@company.com"
              className="w-full px-3 py-2 bg-white text-black border border-black rounded-md focus:ring-2 focus:ring-[#059DC0] focus:outline-none"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-black mb-1">Password</label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-3 py-2 bg-white text-black border border-black rounded-md focus:ring-2 focus:ring-[#059DC0] focus:outline-none pr-10"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 px-3 flex items-center text-gray-400 hover:text-black"
                tabIndex={-1}
              >
                {showPassword ? <FiEyeOff size={18} /> : <FiEye size={18} />}
              </button>
            </div>
          </div>

          <div className="flex justify-end text-sm">
            <button onClick={() => router.push('/forgot-password')} className="cursor-pointer text-[#059DC0] hover:underline">Forgot your password?</button>
          </div>

          <div className="flex items-center my-6">
            <hr className="flex-grow border-gray-700" />
            <span className="mx-2 text-sm text-gray-600">or</span>
            <hr className="flex-grow border-gray-700" />
          </div>

          <button
            type="button"
            onClick={handleGoogleLogin}
            className="cursor-pointer w-full flex items-center justify-center gap-2 px-4 py-2 border border-black rounded-md text-black transition"
          >
            <img src="/assets/google-icon.svg" alt="Google" className="w-5 h-5" />
            Continue with Google
          </button>

          <button
            type="submit"
            disabled={loading}
            className="cursor-pointer w-full py-2 px-4 bg-[#059DC0] border border-black text-white font-semibold rounded-md transition"
          >
            {loading ? 'Logging in...' : 'Login'}
          </button>
        </form>
      </div>
    </div>
  );
}