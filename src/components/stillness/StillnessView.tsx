import React, { useState } from 'react';
import { Sparkles, Compass, ArrowLeft, ArrowUpRight, Feather } from 'lucide-react';
import { ConstellationActivity } from './ConstellationActivity';
import { UntangleActivity } from './UntangleActivity';

export type StillnessActivityType = 'constellation' | 'untangle';

interface StillnessViewProps {
  onNavigateTab?: (tabId: string) => void;
  defaultActivity?: StillnessActivityType | null;
}

export const StillnessView: React.FC<StillnessViewProps> = ({
  onNavigateTab,
  defaultActivity = null,
}) => {
  const [activeActivity, setActiveActivity] = useState<StillnessActivityType | null>(
    defaultActivity
  );

  return (
    <div id="stillness-view" className="space-y-6 animate-in fade-in duration-200">
      {/* 1. View Header or Active Activity Top Bar */}
      {activeActivity === null ? (
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 border-b border-[#E6E4DD] dark:border-[#2E2C26] pb-5">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-[#5A5A40] dark:text-[#D4D0C2] uppercase tracking-wider font-sans">
                Quiet Corner
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-serif font-medium text-[#20201D] dark:text-[#F2EFE9] tracking-tight">
              Stillness
            </h1>
            <p className="text-sm text-[#757469] dark:text-[#A6A498] max-w-xl leading-relaxed">
              A calm space to decompress and pause between thoughts. No scores, no countdowns, and no rush.
            </p>
          </div>

          {onNavigateTab && (
            <button
              type="button"
              onClick={() => onNavigateTab('my-space')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#D5D2C7] dark:border-[#3E3C34] bg-[#FFFFFF] dark:bg-[#22211C] hover:bg-[#F4F1E8] dark:hover:bg-[#2E2C26] text-[#5A5A40] dark:text-[#D4D0C2] text-xs font-medium transition-colors cursor-pointer self-start sm:self-end shadow-2xs"
            >
              <span>Return to My Space</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      ) : (
        <div className="flex items-center justify-between border-b border-[#E6E4DD] dark:border-[#2E2C26] pb-4">
          <div className="flex items-center gap-3">
            <button
              id="back-to-stillness-btn"
              type="button"
              onClick={() => setActiveActivity(null)}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-[#D5D2C7] dark:border-[#3E3C34] bg-[#FAF9F5] dark:bg-[#1D1C18] hover:bg-[#EAE8E0] dark:hover:bg-[#2A2823] text-[#3A3A35] dark:text-[#EDEAE2] text-xs font-medium transition-colors cursor-pointer shadow-2xs"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Stillness Chooser</span>
            </button>

            <div>
              <h2 className="font-serif text-base sm:text-lg font-medium text-[#20201D] dark:text-[#F2EFE9]">
                {activeActivity === 'constellation' ? 'Constellation' : 'Untangle'}
              </h2>
            </div>
          </div>

          {onNavigateTab && (
            <button
              type="button"
              onClick={() => onNavigateTab('my-space')}
              className="text-xs text-[#757469] hover:text-[#3A3A35] dark:text-[#A6A498] dark:hover:text-[#EDEAE2] transition-colors cursor-pointer hidden sm:inline-flex items-center gap-1"
            >
              <span>Leave Stillness</span>
              <ArrowUpRight className="w-3 h-3" />
            </button>
          )}
        </div>
      )}

      {/* 2. Chooser Screen */}
      {activeActivity === null && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-2">
          {/* Constellation Card */}
          <div
            id="choose-constellation-card"
            onClick={() => setActiveActivity('constellation')}
            className="group p-6 rounded-2xl border border-[#E6E4DD] dark:border-[#2E2C26] bg-[#FFFFFF] dark:bg-[#22211C] hover:border-[#5A5A40] dark:hover:border-[#D4D0C2] hover:bg-[#FAF9F5] dark:hover:bg-[#282620] transition-all duration-200 cursor-pointer shadow-xs flex flex-col justify-between space-y-6 active:scale-[0.99]"
          >
            <div className="space-y-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 border border-indigo-100 dark:border-indigo-900/60 text-indigo-700 dark:text-indigo-300 flex items-center justify-center">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[11px] font-semibold text-[#858376] dark:text-[#8E8C7F] uppercase tracking-wider font-sans">
                  Celestial Tracing
                </span>
                <h3 className="font-serif text-xl font-medium text-[#20201D] dark:text-[#F2EFE9] group-hover:text-indigo-950 dark:group-hover:text-indigo-200 transition-colors">
                  Constellation
                </h3>
              </div>
              <p className="text-sm text-[#555449] dark:text-[#B8B5A9] leading-relaxed">
                Connect real stars to trace ancient constellations across the night sky, or switch to Free Sky to draw gently without evaluation.
              </p>
            </div>

            <div className="flex items-center gap-1.5 text-xs font-medium text-[#5A5A40] dark:text-[#D4D0C2] group-hover:translate-x-0.5 transition-transform">
              <span>Open the sky</span>
              <span>→</span>
            </div>
          </div>

          {/* Untangle Card */}
          <div
            id="choose-untangle-card"
            onClick={() => setActiveActivity('untangle')}
            className="group p-6 rounded-2xl border border-[#E6E4DD] dark:border-[#2E2C26] bg-[#FFFFFF] dark:bg-[#22211C] hover:border-[#5A5A40] dark:hover:border-[#D4D0C2] hover:bg-[#FAF9F5] dark:hover:bg-[#282620] transition-all duration-200 cursor-pointer shadow-xs flex flex-col justify-between space-y-6 active:scale-[0.99]"
          >
            <div className="space-y-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-100 dark:border-emerald-900/60 text-emerald-700 dark:text-emerald-300 flex items-center justify-center">
                <Compass className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[11px] font-semibold text-[#858376] dark:text-[#8E8C7F] uppercase tracking-wider font-sans">
                  Peaceful Focus
                </span>
                <h3 className="font-serif text-xl font-medium text-[#20201D] dark:text-[#F2EFE9] group-hover:text-emerald-950 dark:group-hover:text-emerald-200 transition-colors">
                  Untangle
                </h3>
              </div>
              <p className="text-sm text-[#555449] dark:text-[#B8B5A9] leading-relaxed">
                A quiet puzzle of moving points until all intersecting lines are cleared. Always solvable, with no timer or penalties.
              </p>
            </div>

            <div className="flex items-center gap-1.5 text-xs font-medium text-[#5A5A40] dark:text-[#D4D0C2] group-hover:translate-x-0.5 transition-transform">
              <span>Begin untangling</span>
              <span>→</span>
            </div>
          </div>
        </div>
      )}

      {/* 3. Active Activity Full-Width Container */}
      {activeActivity !== null && (
        <div className="rounded-2xl border border-[#E6E4DD] dark:border-[#2E2C26] bg-[#FFFFFF] dark:bg-[#22211C] p-5 sm:p-7 shadow-xs">
          {activeActivity === 'constellation' ? (
            <ConstellationActivity />
          ) : (
            <UntangleActivity />
          )}
        </div>
      )}
    </div>
  );
};
