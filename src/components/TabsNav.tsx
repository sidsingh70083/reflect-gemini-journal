import React, { useEffect, useRef } from 'react';
import { BookOpen, LineChart, Mail, Sparkles } from 'lucide-react';

export type TabType = 'my-space' | 'trends' | 'letter-to-future' | 'stillness';

interface TabsNavProps {
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
}

export const TabsNav: React.FC<TabsNavProps> = ({ activeTab, onTabChange }) => {
  const containerRef = useRef<HTMLDivElement>(null);

  const tabs = [
    {
      id: 'my-space' as TabType,
      label: 'My Space',
      shortLabel: 'My Space',
      icon: <BookOpen className="w-4 h-4 shrink-0" />,
      mobileIcon: <BookOpen className="w-5 h-5 shrink-0" />,
    },
    {
      id: 'trends' as TabType,
      label: 'Patterns',
      shortLabel: 'Patterns',
      icon: <LineChart className="w-4 h-4 shrink-0" />,
      mobileIcon: <LineChart className="w-5 h-5 shrink-0" />,
    },
    {
      id: 'letter-to-future' as TabType,
      label: 'Dear Future Me',
      shortLabel: 'Future Me',
      icon: <Mail className="w-4 h-4 shrink-0" />,
      mobileIcon: <Mail className="w-5 h-5 shrink-0" />,
    },
    {
      id: 'stillness' as TabType,
      label: 'Stillness',
      shortLabel: 'Stillness',
      icon: <Sparkles className="w-4 h-4 shrink-0" />,
      mobileIcon: <Sparkles className="w-5 h-5 shrink-0" />,
    },
  ];

  // Ensure active tab is scrolled into view when switching tabs on desktop
  useEffect(() => {
    const activeEl = document.getElementById(`tab-desktop-${activeTab}`);
    if (activeEl && containerRef.current) {
      activeEl.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    }
  }, [activeTab]);

  return (
    <>
      {/* Desktop Horizontal Tab Ribbon (Visible on md and above) */}
      <nav
        id="dashboard-tabs-nav"
        aria-label="Dashboard navigation tabs"
        className="hidden md:block sticky top-16 z-30 w-full border-b border-[#E6E4DD] dark:border-[#2E2C26] bg-[#F8F7F3]/95 dark:bg-[#1A1916]/95 backdrop-blur-md shadow-2xs"
      >
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <div
            ref={containerRef}
            className="flex items-center gap-2 overflow-x-auto py-2 scrollbar-none scroll-smooth justify-start"
          >
            {tabs.map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  id={`tab-desktop-${tab.id}`}
                  type="button"
                  onClick={() => onTabChange(tab.id)}
                  className={`relative shrink-0 flex items-center gap-2 py-2 px-3.5 rounded-lg text-sm font-medium transition-all cursor-pointer whitespace-nowrap ${
                    isActive
                      ? 'text-[#3A3A35] dark:text-[#EDEAE2] bg-[#EAE8E0] dark:bg-[#2A2823] shadow-2xs font-semibold'
                      : 'text-[#757469] dark:text-[#A6A498] hover:text-[#3A3A35] dark:hover:text-[#EDEAE2] hover:bg-[#F0EEE6] dark:hover:bg-[#252420]'
                  }`}
                >
                  {tab.icon}
                  <span>{tab.label}</span>
                  {isActive && (
                    <span className="absolute bottom-0 left-3.5 right-3.5 h-0.5 bg-[#4A4A38] dark:bg-[#D4D0C2] rounded-full" />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </nav>

      {/* Mobile Bottom Navigation Bar (Visible below md) */}
      <nav
        id="mobile-bottom-nav"
        aria-label="Mobile bottom navigation"
        className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#F8F7F3]/95 dark:bg-[#1A1916]/95 backdrop-blur-md border-t border-[#E6E4DD] dark:border-[#2E2C26] pb-[env(safe-area-inset-bottom)] shadow-[0_-4px_12px_rgba(0,0,0,0.05)] transition-colors"
      >
        <div className="grid grid-cols-4 h-16 max-w-md mx-auto items-center px-1">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                id={`tab-mobile-${tab.id}`}
                type="button"
                onClick={() => onTabChange(tab.id)}
                className={`relative flex flex-col items-center justify-center py-1 px-1 h-full rounded-xl transition-all select-none cursor-pointer group ${
                  isActive
                    ? 'text-[#3A3A35] dark:text-[#EDEAE2]'
                    : 'text-[#757469] dark:text-[#A6A498] hover:text-[#3A3A35] dark:hover:text-[#EDEAE2]'
                }`}
                aria-current={isActive ? 'page' : undefined}
              >
                {/* Active Indicator Bar at Top of Button */}
                {isActive && (
                  <span className="absolute top-0 w-8 h-0.5 bg-[#4A4A38] dark:bg-[#D4D0C2] rounded-full" />
                )}

                <div
                  className={`p-1 rounded-lg transition-transform ${
                    isActive ? 'scale-110 bg-[#EAE8E0]/70 dark:bg-[#282621]' : 'group-active:scale-95'
                  }`}
                >
                  {tab.mobileIcon}
                </div>

                <span
                  className={`text-[11px] leading-tight tracking-tight mt-0.5 transition-colors whitespace-nowrap ${
                    isActive ? 'font-semibold text-[#3A3A35] dark:text-[#EDEAE2]' : 'font-normal'
                  }`}
                >
                  {tab.shortLabel}
                </span>
              </button>
            );
          })}
        </div>
      </nav>
    </>
  );
};
