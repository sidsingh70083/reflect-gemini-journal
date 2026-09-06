import React from 'react';
import { LineChart, BarChart3, Calendar, Sparkles } from 'lucide-react';

export const TrendsPlaceholder: React.FC = () => {
  return (
    <div
      id="trends-placeholder-view"
      className="max-w-3xl mx-auto py-12 px-4 sm:px-6 flex flex-col items-center justify-center text-center min-h-[50vh]"
    >
      <div className="w-14 h-14 rounded-2xl bg-[#EAE8E0] dark:bg-[#282621] text-[#4A4A38] dark:text-[#D4D0C2] flex items-center justify-center mb-5 border border-[#D5D2C7] dark:border-[#423F36] shadow-2xs">
        <LineChart className="w-7 h-7" />
      </div>

      <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-[#EAE8E0] dark:bg-[#2A2823] text-[#5A5A40] dark:text-[#D4D0C2] mb-3 border border-[#D5D2C7] dark:border-[#423F36]">
        <Sparkles className="w-3 h-3 text-amber-600 dark:text-amber-400" />
        <span>Coming Soon</span>
      </div>

      <h2 className="font-serif text-2xl sm:text-3xl font-medium text-[#3A3A35] dark:text-[#EDEAE2] mb-2 tracking-tight">
        Emotional Trends & Heatmaps
      </h2>

      <p className="font-sans text-sm text-[#757469] dark:text-[#A6A498] max-w-md mb-8 leading-relaxed">
        Mood and activity heatmaps, reflective cadence, and emotional insights over time.
      </p>

      {/* Decorative Blueprint Mock Frame */}
      <div className="w-full max-w-md p-6 rounded-2xl border border-dashed border-[#D5D2C7] dark:border-[#3E3C34] bg-[#FFFFFF]/60 dark:bg-[#201F1B]/60">
        <div className="flex justify-between items-center mb-4">
          <div className="h-3 w-24 bg-[#EAE8E0] dark:bg-[#2E2C26] rounded" />
          <div className="h-3 w-12 bg-[#EAE8E0] dark:bg-[#2E2C26] rounded" />
        </div>
        <div className="grid grid-cols-7 gap-1.5 mb-4">
          {Array.from({ length: 28 }).map((_, i) => (
            <div
              key={i}
              className={`h-4 rounded-xs ${
                i % 4 === 0
                  ? 'bg-emerald-600/30 dark:bg-emerald-700/40'
                  : i % 3 === 0
                  ? 'bg-amber-600/30 dark:bg-amber-700/40'
                  : 'bg-[#EAE8E0] dark:bg-[#2E2C26]'
              }`}
            />
          ))}
        </div>
        <div className="flex items-center justify-center gap-2 text-[11px] text-[#858376] dark:text-[#8E8C7F]">
          <Calendar className="w-3 h-3" />
          <span>Longitudinal mood tracking in development</span>
        </div>
      </div>
    </div>
  );
};
