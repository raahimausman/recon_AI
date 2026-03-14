import Image from 'next/image';
import Link from 'next/link';

const Footer = () => {

  return (
    <footer className="bg-[#F6FDFF] border-t border-gray-200">
      <div className="mx-auto w-full max-w-screen-xl p-4 py-6 lg:py-8 lg:px-8">
        <div className="md:flex md:justify-between">
          <div className="mb-6 md:mb-0">
            <Link href="/" className="flex items-center">
              <Image src="/assets/recon-logo.png" alt="Recon AI Logo" width={64} height={64} />
              <span className="self-center text-black text-xl ml-2 font-semibold whitespace-nowrap">
                Recon AI
              </span>
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-8 sm:gap-6 sm:grid-cols-3">
          </div>
        </div>

        <hr className="my-6 border-gray-300 sm:mx-auto lg:my-8" />

        <div className='flex flex-col items-center justify-between sm:flex-row sm:items-center'>
            <div className="sm:flex sm:items-center sm:justify-between">
                <span className="text-sm text-[#059DC0] sm:text-center">
                    © 2025 <Link href="/" className="hover:underline">ReconAI™</Link>. All Rights Reserved.
                </span>
            </div>

            <div className='flex flex-row gap-x-4 text-sm text-[#059DC0] sm:text-center'>
                <Link href="/docs" className="hover:underline">Documentation</Link> | 
                <Link href="/privacy-policy" className="hover:underline"> Privacy Policy</Link>
            </div>

        </div>
      </div>
    </footer>
  );
};

export default Footer;