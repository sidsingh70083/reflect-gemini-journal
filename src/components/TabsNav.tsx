import React from 'react';
import { BookOpen, LineChart, Mail } from 'lucide-react';

export type TabType = 'my-space' | 'trends' | 'letter-to-future';

interface TabsNavProps {
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
}

export const TabsNav: React.FC<TabsNavProps> = ({ activeTab, onTabChange }) => {
  const tabs = [
    {
      id: 'my-space' as TabType,
      label: 'My Space',
      icon: <BookOpen className="w-4 h-4" />,
    },
    {
      id: 'trends' as TabType,
      label: 'Patterns',
      icon: <LineChart className="w-4 h-4" />,
    },
    {
      id: 'letter-to-future' as TabType,
      label: 'Dear Future Me',
      icon: <Mail className="w-4 h-4" />,
    },
  ];

  return (
    <nav
      id="dashboard-tabs-nav"
      aria-label="Dashboard navigation tabs"
      className="sticky top-0 z-30 w-full border-b border-[#E6E4DD] dark:border-[#2E2C26] bg-[#F8F7F3]/95 dark:bg-[#1A1916]/95 backdrop-blur-md shadow-2xs"
    >
      <div className="max-w-5xl mx-auto px-4 sm:px-6">
        <div className="flex gap-2 sm:gap-6 overflow-x-auto py-2 scrollbar-none">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                id={`tab-${tab.id}`}
                type="button"
                onClick={() => onTabChange(tab.id)}
                className={`relative flex items-center gap-2 py-2.5 px-3 rounded-lg text-xs sm:text-sm font-medium transition-all cursor-pointer whitespace-nowrap ${
                  isActive
                    ? 'text-[#3A3A35] dark:text-[#EDEAE2] bg-[#EAE8E0] dark:bg-[#2A2823] shadow-2xs font-semibold'
                    : 'text-[#757469] dark:text-[#A6A498] hover:text-[#3A3A35] dark:hover:text-[#EDEAE2] hover:bg-[#F0EEE6] dark:hover:bg-[#252420]'
                }`}
              >
                {tab.icon}
                <span>{tab.label}</span>
                {isActive && (
                  <span className="absolute bottom-0 left-3 right-3 h-0.5 bg-[#4A4A38] dark:bg-[#D4D0C2] rounded-full" />
                )}
              </button>
            );
          })}
        </div>
      </div>
    </nav>
  );
};
