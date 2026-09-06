import React, { useState, useEffect } from 'react';
import {
  UserProfile,
  JournalEntry,
} from './types';
import {
  subscribeToAuth,
  signInWithGoogle,
  logOut,
  subscribeToUserEntries,
  calculateStreak,
} from './lib/firebase';
import { Header } from './components/Header';
import { TabsNav, TabType } from './components/TabsNav';
import { LandingPage } from './components/LandingPage';
import { MySpaceView } from './components/MySpaceView';
import { TrendsView } from './components/TrendsView';
import { LetterToFutureView } from './components/LetterToFutureView';
import { ReflectionProvider } from './context/ReflectionContext';

export default function App() {
  // Authentication state
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);

  // Active navigation tab
  const [activeTab, setActiveTab] = useState<TabType>('my-space');

  // Firestore Journal Entries & Streak
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [streak, setStreak] = useState<number>(0);

  // Dark Mode Theme State
  const [isDark, setIsDark] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('reflect_theme');
      if (saved) return saved === 'dark';
      return window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    return false;
  });

  // Apply dark mode class to root document
  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('reflect_theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('reflect_theme', 'light');
    }
  }, [isDark]);

  const toggleDarkMode = () => {
    setIsDark((prev) => !prev);
  };

  // Auth State Listener
  useEffect(() => {
    const unsubscribe = subscribeToAuth((fbUser) => {
      if (fbUser) {
        setUser({
          uid: fbUser.uid,
          displayName: fbUser.displayName,
          email: fbUser.email,
          photoURL: fbUser.photoURL,
        });
      } else {
        setUser(null);
        setEntries([]);
        setStreak(0);
      }
      setIsAuthLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Subscribe to Firestore Entries when authenticated
  useEffect(() => {
    if (!user) return;

    const unsubscribe = subscribeToUserEntries(
      user.uid,
      (userEntries) => {
        setEntries(userEntries);
        const calculated = calculateStreak(userEntries);
        setStreak(calculated);
      },
      (err) => {
        console.error('Failed to subscribe to entries:', err);
      }
    );

    return () => unsubscribe();
  }, [user]);

  // Sign In Handler
  const handleSignIn = async () => {
    setIsAuthLoading(true);
    setAuthError(null);
    try {
      await signInWithGoogle();
    } catch (err: any) {
      console.error('Google Sign-In failed:', err);
      setAuthError(
        err.message || 'Unable to complete sign-in. Please try again.'
      );
    } finally {
      setIsAuthLoading(false);
    }
  };

  // Sign Out Handler
  const handleSignOut = async () => {
    try {
      await logOut();
    } catch (err) {
      console.error('Sign-out failed:', err);
    }
  };

  // Loading Splash Screen
  if (isAuthLoading && !user) {
    return (
      <div className="min-h-screen bg-[#F8F7F3] dark:bg-[#1A1916] flex flex-col items-center justify-center text-[#757469] dark:text-[#A6A498]">
        <div className="w-8 h-8 border-2 border-[#D5D2C7] border-t-[#4A4A38] dark:border-t-[#D4D0C2] rounded-full animate-spin mb-3" />
        <p className="text-xs font-serif italic tracking-wide text-[#5A5A40] dark:text-[#C5C2B6]">Opening Reflect...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#F8F7F3] dark:bg-[#1A1916] text-[#3A3A35] dark:text-[#EDEAE2] selection:bg-[#E6E4DD] dark:selection:bg-[#36342E] transition-colors duration-200">
      {/* Unauthenticated View: Minimal Serene Landing Page */}
      {!user ? (
        <main className="flex-1 flex flex-col justify-center">
          <LandingPage
            onSignIn={handleSignIn}
            isLoading={isAuthLoading}
            error={authError}
          />
        </main>
      ) : (
        /* Authenticated View: Header, Tabs, & Screen Views */
        <ReflectionProvider user={user}>
          <Header
            user={user}
            streak={streak}
            isDark={isDark}
            onToggleDark={toggleDarkMode}
            onSignOut={handleSignOut}
          />

          <TabsNav activeTab={activeTab} onTabChange={setActiveTab} />

          <main className="flex-1 pb-16">
            <div className={activeTab === 'my-space' ? 'block' : 'hidden'}>
              <MySpaceView user={user} entries={entries} streak={streak} />
            </div>
            <div className={activeTab === 'trends' ? 'block' : 'hidden'}>
              <TrendsView user={user} entries={entries} />
            </div>
            <div className={activeTab === 'letter-to-future' ? 'block' : 'hidden'}>
              <LetterToFutureView user={user} />
            </div>
          </main>
        </ReflectionProvider>
      )}
    </div>
  );
}
