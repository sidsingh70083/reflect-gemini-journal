import React from 'react';
import { Compass, Sparkles } from 'lucide-react';

interface LandingPageProps {
  onSignIn: () => void;
  isLoading: boolean;
  error?: string | null;
}

export const LandingPage: React.FC<LandingPageProps> = ({
  onSignIn,
  isLoading,
  error,
}) => {
  return (
    <div
      id="landing-page-container"
      className="min-h-[calc(100vh-4rem)] flex flex-col items-center justify-center px-4 py-12 text-center"
    >
      <div className="max-w-md w-full mx-auto flex flex-col items-center">
        {/* Minimal Icon */}
        <div
          id="landing-logo"
          className="w-16 h-16 rounded-2xl bg-[#4A4A38] dark:bg-[#D4D0C2] flex items-center justify-center text-[#F8F7F3] dark:text-[#1A1916] mb-6 shadow-sm"
        >
          <Compass className="w-8 h-8" />
        </div>

        {/* App Name */}
        <h1
          id="landing-title"
          className="font-serif text-4xl sm:text-5xl font-medium tracking-tight text-[#3A3A35] dark:text-[#EDEAE2] mb-3"
        >
          Reflect
        </h1>

        {/* One-line Tagline */}
        <p
          id="landing-tagline"
          className="font-sans text-sm sm:text-base text-[#757469] dark:text-[#A6A498] mb-8 leading-relaxed max-w-sm"
        >
          A quiet, mindful space to untangle your thoughts and converse with your mind.
        </p>

        {/* Error Alert if any */}
        {error && (
          <div
            id="landing-error-banner"
            className="w-full mb-6 p-3 text-xs text-rose-800 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 rounded-xl"
          >
            {error}
          </div>
        )}

        {/* Single "Sign in with Google" button */}
        <button
          id="google-signin-button"
          type="button"
          disabled={isLoading}
          onClick={onSignIn}
          className="w-full max-w-xs flex items-center justify-center gap-3 px-6 py-3.5 rounded-xl border border-[#D5D2C7] dark:border-[#423F36] bg-[#FFFFFF] dark:bg-[#252420] text-[#3A3A35] dark:text-[#EDEAE2] font-medium text-sm shadow-xs hover:bg-[#F4F1E8] dark:hover:bg-[#2E2C26] active:scale-[0.98] transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isLoading ? (
            <div className="w-4 h-4 border-2 border-[#5A5A40] dark:border-[#D4D0C2] border-t-transparent rounded-full animate-spin" />
          ) : (
            <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
              />
            </svg>
          )}
          <span>{isLoading ? 'Signing in...' : 'Sign in with Google'}</span>
        </button>
      </div>
    </div>
  );
};
