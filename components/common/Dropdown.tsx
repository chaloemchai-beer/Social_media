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
        className="flex items-center justify-center p-1.5 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-xl text-gray-400 hover:text-white transition-colors"
      >
        <ArrowDropDownIcon style={{ fontSize: 20 }} />
      </button>
      {isOpen && (
        <div className="absolute right-0 mt-2 w-48 bg-gray-900 border border-gray-700 rounded-xl shadow-xl shadow-black/40 overflow-hidden">
          <ul className="py-1">
            <li>
              <button
                onClick={() => { router.push('/profile'); setIsOpen(false); }}
                className="flex items-center gap-2 px-4 py-2.5 text-sm text-gray-300 hover:text-white hover:bg-gray-800 w-full transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                Profile
              </button>
            </li>
            <li className="border-t border-gray-800">
              <button
                onClick={handleSignOut}
                className="flex items-center gap-2 px-4 py-2.5 text-sm text-red-400 hover:text-red-300 hover:bg-gray-800 w-full transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
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
