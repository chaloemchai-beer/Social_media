"use client"

import React, { useState } from 'react';
import ArrowDropDownIcon from "@mui/icons-material/ArrowDropDown";
import { useRouter } from 'next/navigation';

interface DropdownProps {
  signOut: (options: { callbackUrl: string }) => void;
}

const Dropdown: React.FC<DropdownProps> = ({ signOut }) => {
  const [isOpen, setIsOpen] = useState(false);
  const router = useRouter();

  const handleSignOut = () => {
    signOut({ callbackUrl: '/login' });
    setIsOpen(false); // Close dropdown after sign out
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center p-2 h-10 w-10 bg-gray-200 rounded-full text-gray-700 cursor-pointer hover:bg-gray-300"
      >
        <ArrowDropDownIcon />
      </button>
      {isOpen && (
        <div className="absolute right-0 mt-2 w-48 bg-white border border-gray-300 rounded-lg shadow-lg">
          <ul className="py-1">
            <li>
              <button
                onClick={() => router.push('/profile')}
                className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 w-full"
              >
                Profile
              </button>
            </li>
            <li>
              <button
                onClick={handleSignOut}
                className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 w-full"
              >
                Sign Out
              </button>
            </li>
          </ul>
        </div>
      )}
    </div>
  );
};

export default Dropdown;
