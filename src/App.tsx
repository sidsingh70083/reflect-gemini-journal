import React, { useState, useEffect } from 'react';
import {
  UserProfile,
  JournalEntry,
  UserSettings,
  DEFAULT_USER_SETTINGS,
} from './types';
import {
  subscribeToAuth,
  signInWithGoogle,
  logOut,
  subscribeToUserEntries,
  calculateStreak,
  subscribeToUserSettings,
  saveUserSettings,
} from './lib/firebase';
import { Header } from './components/Header';
import { TabsNav, TabType } from './components/TabsNav';
import { LandingPage } from './components/LandingPage';
import { MySpaceView } from './components/MySpaceView';
import { TrendsView } from './components/TrendsView';
import { LetterToFutureView } from './components/LetterToFutureView';
import { StillnessView } from './components/stillness/StillnessView';
import { SettingsPanel } from './components/SettingsPanel';
import { ReflectionProvider } from './context/ReflectionContext';
import { ambientSound } from './lib/ambientSound';

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

  // User Settings State (Persisted to Firestore users/{uid}/settings/preferences)
  const [userSettings, setUserSettings] = useState<UserSettings>(DEFAULT_USER_SETTINGS);
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);

  // Apply dark mode class to root document based on settings
  useEffect(() => {
    const isDark = userSettings.theme === 'dark';
    if (isDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [userSettings.theme]);

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
        setUserSettings(DEFAULT_USER_SETTINGS);
      }
      setIsAuthLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Subscribe to Firestore Entries and User Settings when authenticated
  useEffect(() => {
    if (!user) return;

    // 1. Subscribe to journal entries
    const unsubEntries = subscribeToUserEntries(
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

    // 2. Subscribe to user preferences in Firestore
    const unsubSettings = subscribeToUserSettings(
      user.uid,
      (settings) => {
        setUserSettings(settings);
        // Configure ambient sound engine to match user's saved preferences
        ambientSound.setEnabled(settings.ambientSoundEnabled);
        ambientSound.setVolume(settings.ambientSoundVolume);
        ambientSound.setTexture(settings.ambientSoundTexture);
      },
      (err) => {
        console.error('Failed to subscribe to user settings:', err);
      }
    );

    return () => {
      unsubEntries();
      unsubSettings();
    };
  }, [user]);

  // Handle settings update (optimistic local update + Firestore sync)
  const handleUpdateSettings = async (updates: Partial<UserSettings>) => {
    setUserSettings((prev) => ({ ...prev, ...updates }));

    if (user) {
      try {
        await saveUserSettings(user.uid, updates);
      } catch (err) {
        console.error('Failed to save user settings:', err);
      }
    }
  };

  // Notify ambient sound engine of current screen context
  useEffect(() => {
    ambientSound.setStillnessContext(activeTab === 'stillness');
  }, [activeTab]);

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
      ambientSound.dispose();
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
        <ReflectionProvider user={user} dailyCheckinsEnabled={userSettings.dailyCheckinsEnabled}>
          <Header
            user={user}
            streak={streak}
            customAvatar={userSettings.customAvatar}
            onOpenSettings={() => setIsSettingsOpen(true)}
            onSignOut={handleSignOut}
          />

          <TabsNav activeTab={activeTab} onTabChange={setActiveTab} />

          <main className="flex-1 pb-24 md:pb-16">
            <div className={activeTab === 'my-space' ? 'block' : 'hidden'}>
              <MySpaceView
                user={user}
                entries={entries}
                streak={streak}
                dailyCheckinsEnabled={userSettings.dailyCheckinsEnabled}
                locationEnabled={userSettings.locationEnabled ?? false}
                customAvatar={userSettings.customAvatar}
                onNavigateTab={(tab) => setActiveTab(tab as TabType)}
              />
            </div>
            <div className={activeTab === 'trends' ? 'block' : 'hidden'}>
              <TrendsView user={user} entries={entries} />
            </div>
            <div className={activeTab === 'letter-to-future' ? 'block' : 'hidden'}>
              <LetterToFutureView user={user} />
            </div>
            <div className={activeTab === 'stillness' ? 'block' : 'hidden'}>
              <div className="max-w-4xl mx-auto px-4 sm:px-6 pt-6">
                <StillnessView onNavigateTab={(tab) => setActiveTab(tab as TabType)} />
              </div>
            </div>
          </main>

          {/* Slide-out Settings Panel */}
          <SettingsPanel
            isOpen={isSettingsOpen}
            user={user}
            onClose={() => setIsSettingsOpen(false)}
            settings={userSettings}
            onUpdateSettings={handleUpdateSettings}
          />
        </ReflectionProvider>
      )}
    </div>
  );
}
