import BackButton from "@/components/BackButton";

export default function ForgotPasswordPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-white">
        {/* Back Arrow */}
        <div className="absolute top-4 left-8 z-10">
          <BackButton />
        </div>

        {/* Forgot Password Form */}
        <div className="max-w-md w-full bg-[#E0F7FA] border border-[#059DC0] px-8 py-10 rounded-lg shadow-md ">
            <h1 className="text-2xl font-bold mb-4">Forgot Password</h1>
            <p className="text-gray-600 mb-6">Enter your email address to reset your password.</p>
            <form>
            <div className="mb-4">
                <label className="block text-sm font-medium text-black mb-2">Email Address</label>
                <input
                type="email"
                placeholder="name@company.com"
                className="w-full px-3 py-2 bg-white text-black border border-black rounded-md focus:ring-2 focus:ring-[#059DC0] focus:outline-none"
                required
                />
            </div>
            <button
                type="submit"
                className="cursor-pointer w-full py-2 px-4 bg-[#059DC0] border border-black text-white font-semibold rounded-md transition"
            >
                Send Reset Link
            </button>
            </form>
        </div>
    </div>
  );
}