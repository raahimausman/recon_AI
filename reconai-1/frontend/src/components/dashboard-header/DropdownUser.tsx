'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import ClickOutside from './ClickOutside';
import { logout } from '@/lib/authentication';
import { toast } from 'react-toastify';
import { FaUser, FaCog, FaSignOutAlt } from 'react-icons/fa';
import { fetchUserProfile } from '@/lib/profile';

const DropdownUser = () => {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const router = useRouter();

  const [fullName, setFullName] = useState('Loading...');
  const [profileImage, setProfileImage] = useState('/assets/user-profile.png');

  useEffect(() => {
    const loadUser = async () => {
      try {
        const profile = await fetchUserProfile();
        setFullName(profile.fullName || 'Unnamed User');
        setProfileImage(profile.profileImage || '/assets/user-profile.png');
      } catch (err) {
        console.error('Failed to load user profile:', err);
      }
    };

    loadUser();
  }, []);

  const handleLogout = async () => {
    try {
      await logout();
      toast.success('Logged out successfully!');
      router.push('/login');
    } // eslint-disable-next-line @typescript-eslint/no-explicit-any
    catch (error: any) {
      toast.error('Failed to log out.');
      console.error(error);
    }
  };

  return (
    <ClickOutside onClick={() => setDropdownOpen(false)} className="relative">
      <button
        onClick={() => setDropdownOpen(!dropdownOpen)}
        className="flex items-center gap-3"
      >
        <span className="hidden lg:block text-base font-medium text-black">
          {fullName}
        </span>

        <span className="h-10 w-10 rounded-full overflow-hidden border border-[#059DC0]">
          <Image src={profileImage} alt="Current User Profile" width={40} height={40} />
        </span>
      </button>

      {dropdownOpen && (
        <div className="absolute right-0 top-8 mt-3 w-64 rounded-md border border-gray-200 bg-white shadow-lg z-50">
          <ul className="flex flex-col">
            <li>
              <Link
                href="/profile"
                className="flex items-center gap-3 px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 transition"
              >
                <FaUser className="text-gray-600" />
                My Profile
              </Link>
            </li>
            <li>
              <Link
                href="/settings"
                className="flex items-center gap-3 px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 transition"
              >
                <FaCog className="text-gray-600" />
                Account Settings
              </Link>
            </li>
          </ul>

          <button
            onClick={handleLogout}
            className="cursor-pointer flex items-center gap-3 w-full text-left px-4 py-3 text-sm font-medium text-gray-900 hover:bg-gray-50 transition border-t border-gray-200"
          >
            <FaSignOutAlt className="text-gray-600" />
            Log Out
          </button>
        </div>
      )}
    </ClickOutside>
  );
};

export default DropdownUser;
