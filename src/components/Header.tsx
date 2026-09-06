import React from 'react';
import { Sparkles, Moon, Sun, LogOut, Compass, User as UserIcon } from 'lucide-react';
import { UserProfile } from '../types';
import { StreakBadge } from './StreakBadge';

interface HeaderProps {
  user: UserProfile | null;
  streak: number;
  isDark: boolean;
  onToggleDark: () => void;
  onSignOut: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  user,
  streak,
  isDark,
  onToggleDark,
  onSignOut,
}) => {
  return (
    <header
      id="app-header"
      className="sticky top-0 z-40 w-full border-b border-[#E6E4DD] dark:border-[#2E2C26] bg-[#F8F7F3]/90 dark:bg-[#1A1916]/90 backdrop-blur-md transition-colors"
    >
      <div className="max-w-5xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
        {/* Left: Brand Identity */}
        <div id="brand-identity" className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-[#4A4A38] dark:bg-[#D4D0C2] flex items-center justify-center text-[#F8F7F3] dark:text-[#1A1916] shadow-xs">
            <Compass className="w-4 h-4" />
          </div>
          <div>
            <h1 className="font-serif text-xl font-medium tracking-tight text-[#3A3A35] dark:text-[#EDEAE2]">
              Reflect
            </h1>
          </div>
        </div>

        {/* Right: Controls & User Info */}
        <div id="header-actions" className="flex items-center gap-3 sm:gap-4">
          {/* Streak Indicator (visible only when authenticated) */}
          {user && <StreakBadge streak={streak} />}

          {/* Dark Mode Toggle */}
          <button
            id="dark-mode-toggle"
            type="button"
            onClick={onToggleDark}
            aria-label="Toggle dark mode"
            className="p-2 rounded-lg text-[#757469] dark:text-[#A6A498] hover:bg-[#EAE8E0] dark:hover:bg-[#282621] transition-colors cursor-pointer"
            title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {isDark ? (
              <Sun className="w-4 h-4 text-amber-300" />
            ) : (
              <Moon className="w-4 h-4 text-[#5A5A40]" />
            )}
          </button>

          {/* User Profile & Sign Out (when authenticated) */}
          {user && (
            <div id="user-profile-section" className="flex items-center gap-2.5 pl-2 border-l border-[#E6E4DD] dark:border-[#2E2C26]">
              {user.photoURL ? (
                <img
                  src={user.photoURL}
                  alt={user?.displayName || 'User profile'}
                  className="w-8 h-8 rounded-full border border-[#D5D2C7] dark:border-[#423F36] object-cover"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="w-8 h-8 rounded-full bg-[#EAE8E0] dark:bg-[#282621] flex items-center justify-center text-[#5A5A40] dark:text-[#D4D0C2] text-xs font-serif font-semibold">
                  {user?.displayName ? user.displayName.charAt(0).toUpperCase() : <UserIcon className="w-4 h-4" />}
                </div>
              )}

              <span className="hidden md:inline text-xs font-medium text-[#5A5A40] dark:text-[#C5C2B6] max-w-[120px] truncate font-sans">
                {user?.displayName || user?.email || 'Reflector'}
              </span>

              <button
                id="sign-out-btn"
                type="button"
                onClick={onSignOut}
                className="p-1.5 text-[#858376] hover:text-rose-700 dark:text-[#A6A498] dark:hover:text-rose-400 rounded-lg hover:bg-[#EAE8E0] dark:hover:bg-[#282621] transition-colors cursor-pointer"
                title="Sign out"
                aria-label="Sign out"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
