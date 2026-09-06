import React, { useState } from 'react';
import { Sprout, Sparkles, Flame, Flower2, TreePine } from 'lucide-react';

interface StreakBadgeProps {
  streak: number;
}

export const StreakBadge: React.FC<StreakBadgeProps> = ({ streak }) => {
  const [showTooltip, setShowTooltip] = useState(false);

  // Determine stage and icon
  const getGrowthStage = (days: number) => {
    if (days === 0) {
      return {
        label: 'Ready to Bloom',
        icon: <Sprout className="w-4 h-4 text-stone-400 dark:text-stone-500" />,
        desc: 'Complete your first journal reflection today to start your streak!',
        colorClass: 'text-stone-600 dark:text-stone-400 bg-stone-100 dark:bg-stone-800/80 border-stone-200 dark:border-stone-700',
      };
    } else if (days < 3) {
      return {
        label: 'Seedling Sprout',
        icon: <Sprout className="w-4 h-4 text-emerald-500 animate-pulse" />,
        desc: `${days} day${days > 1 ? 's' : ''} in a row. A tender habit is taking root!`,
        colorClass: 'text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800/60',
      };
    } else if (days < 7) {
      return {
        label: 'Flourishing Growth',
        icon: <Flower2 className="w-4 h-4 text-teal-500" />,
        desc: `${days} consecutive days of mindful journaling. Keep the rhythm!`,
        colorClass: 'text-teal-700 dark:text-teal-300 bg-teal-50 dark:bg-teal-950/40 border-teal-200 dark:border-teal-800/60',
      };
    } else if (days < 14) {
      return {
        label: 'Blooming Lotus',
        icon: <Sparkles className="w-4 h-4 text-amber-500" />,
        desc: `${days} day streak! Your reflective practice is radiant and steady.`,
        colorClass: 'text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800/60',
      };
    } else {
      return {
        label: 'Deep-Rooted Tree',
        icon: <TreePine className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />,
        desc: `${days} day streak! A profound sanctuary of personal insight.`,
        colorClass: 'text-emerald-800 dark:text-emerald-200 bg-emerald-100 dark:bg-emerald-900/40 border-emerald-300 dark:border-emerald-700',
      };
    }
  };

  const stage = getGrowthStage(streak);

  return (
    <div
      id="streak-indicator-container"
      className="relative flex items-center"
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
      <div
        id="streak-badge"
        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border transition-all duration-200 cursor-default select-none shadow-xs ${stage.colorClass}`}
      >
        {stage.icon}
        <span className="font-semibold">{streak}</span>
        <span className="hidden sm:inline opacity-80">
          {streak === 1 ? 'day streak' : 'days'}
        </span>
      </div>

      {showTooltip && (
        <div
          id="streak-tooltip"
          className="absolute top-full mt-2 right-0 sm:left-1/2 sm:-translate-x-1/2 z-50 w-56 p-3 bg-[#2D2C26] text-[#EDEAE2] text-xs rounded-xl shadow-xl border border-[#423F36] animate-in fade-in zoom-in-95 duration-150 pointer-events-none font-sans"
        >
          <div className="flex items-center gap-2 mb-1.5 font-serif font-medium text-[#F4F1E8]">
            {stage.icon}
            <span>{stage.label}</span>
          </div>
          <p className="text-[#C5C2B6] leading-relaxed">
            {stage.desc}
          </p>
        </div>
      )}
    </div>
  );
};
