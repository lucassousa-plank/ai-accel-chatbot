'use client';

import { createClient } from '@/utils/supabase/client';
import { useRouter } from 'next/navigation';
import ThemeToggle from './ThemeToggle';

export default function Navbar() {
  const router = useRouter();
  const supabase = createClient();

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  return (
    <nav className="bg-white dark:bg-gray-800 shadow-md">
      <div className="max-w-full mx-4 px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center">
          {/* Empty div for spacing */}
          <div className="w-24"></div>
          {/* Centered title */}
          <div className="flex-1 flex justify-center">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Interview with the Vampire</h1>
          </div>
          {/* Theme toggle and sign out button */}
          <div className="w-24 flex justify-end items-center space-x-2">
            <button
              onClick={handleSignOut}
              className="px-3 py-1.5 text-sm whitespace-nowrap bg-gray-600 text-white rounded-lg hover:bg-gray-700 dark:bg-gray-700 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-gray-500 transition-colors"
            >
              Sign Out
            </button>
            <ThemeToggle />
          </div>
        </div>
      </div>
    </nav>
  );
} 