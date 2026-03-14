'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FiEye, FiEyeOff } from 'react-icons/fi';
import { signUpWithEmail, signInWithGoogle } from '@/lib/authentication';

export default function SignUpForm() {
  const router = useRouter();

  const [formData, setFormData] = useState({
    email: '',
    fullName: '',
    password: '',
    confirmPassword: '',
  });

  const [agreePolicy, setAgreePolicy] = useState(false);
  const [loading, setLoading] = useState(false);

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  // Handle sign up form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!agreePolicy) {
      return;
    }
    const { email, fullName, password, confirmPassword } = formData;
    if (password !== confirmPassword) {
      return;
    }
    setLoading(true);
    try {
      const { user } = await signUpWithEmail(email, password, fullName);
      router.push('/login');
    } // eslint-disable-next-line @typescript-eslint/no-explicit-any
    catch (err: any) {
        console.error(err);
        alert(err.message);
    } finally {
        setLoading(false);
    }
 };

  // Handle Google Sign Up
  const handleGoogleSignUp = async () => {
    setLoading(true);
    try {
        const { user } = await signInWithGoogle();
        router.push('/login')
    } // eslint-disable-next-line @typescript-eslint/no-explicit-any
    catch (err: any) {
        console.error(err);
        alert(err.message);
    } finally {
        setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center rounded-xl bg-[#E0F7FA] border border-[#059DC0] py-12 px-4">
      <div className="w-full max-w-md space-y-16 text-black">
        {/* Heading */}
        <div className="text-center">
          <h1 className="text-2xl font-bold">Create your Account</h1>
          <p className="mt-1 text-sm text-gray-600">
            Already have an account?{' '}
            <Link href="/login" className="text-[#059DC0] underline">
              Login here
            </Link>
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-black mb-1">Your email</label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                placeholder="name@company.com"
                className="w-full px-3 py-2 bg-white text-black border border-black rounded-md focus:ring-2 focus:ring-[#059DC0] focus:outline-none"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-black mb-1">Full Name</label>
              <input
                type="text"
                name="fullName"
                value={formData.fullName}
                onChange={handleChange}
                placeholder="e.g. Ayesha Gull"
                className="w-full px-3 py-2 bg-white text-black border border-black rounded-md focus:ring-2 focus:ring-[#059DC0] focus:outline-none"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Password */}
            <div>
              <label className="block text-sm font-medium text-black mb-1">Password</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  placeholder="••••••••"
                  className="w-full px-3 py-2 pr-10 bg-white text-black border border-black rounded-md focus:ring-2 focus:ring-[#059DC0] focus:outline-none"
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

            {/* Confirm Password */}
            <div>
              <label className="block text-sm font-medium text-black mb-1">Confirm Password</label>
              <div className="relative">
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  name="confirmPassword"
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  placeholder="••••••••"
                  className="w-full px-3 py-2 pr-10 bg-white text-black border border-black rounded-md focus:ring-2 focus:ring-[#059DC0] focus:outline-none"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute inset-y-0 right-0 px-3 flex items-center text-gray-400 hover:text-black"
                  tabIndex={-1}
                >
                  {showConfirmPassword ? <FiEyeOff size={18} /> : <FiEye size={18} />}
                </button>
              </div>
            </div>
          </div>

          {/* Divider */}
          <div className="flex items-center my-6">
            <hr className="flex-grow border-gray-700" />
            <span className="mx-2 text-sm text-gray-600">or</span>
            <hr className="flex-grow border-gray-700" />
          </div>

          {/* Google Sign Up */}
          <button
            type="button"
            onClick={handleGoogleSignUp}
            className="cursor-pointer w-full flex items-center justify-center gap-2 px-4 py-2 mb-12 border border-black rounded-md text-black transition"
          >
            <img src="/assets/google-icon.svg" alt="Google" className="w-5 h-5" />
            Sign up with Google
          </button>

          {/* Terms */}
          <div className="space-y-4 mt-4 text-sm text-gray-600">
            <label className="flex items-start gap-2">
              <input
                type="checkbox"
                className="mt-1"
                checked={agreePolicy}
                onChange={(e) => setAgreePolicy(e.target.checked)}
                required
              />
              <span>
                By signing up, you agree to Recon AI’s{' '}
                <Link href="#" className="text-[#059DC0] hover:underline">Terms of Use</Link>{' '}
                and{' '}
                <Link href="#" className="text-[#059DC0] hover:underline">Privacy Policy</Link>.
              </span>
            </label>

            <label className="flex items-center">
              <input type="checkbox" className="mr-2" />
              Email me about product updates and tips.
            </label>
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={loading}
            className="cursor-pointer w-full py-2 px-4 bg-[#059DC0] border border-black text-white font-semibold rounded-md transition"
          >
            {loading ? 'Creating account...' : 'Create an account'}
          </button>
        </form>
      </div>
    </div>
  );
}