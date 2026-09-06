import React, { useState, useMemo } from 'react';
import {
  Calendar,
  Clock,
  Sparkles,
  Sun,
  Moon,
  Sunrise,
  Sunset,
  BarChart3,
  Flame,
  Info,
  TrendingUp,
} from 'lucide-react';
import { JournalEntry, JournalCategory, CATEGORY_CONFIG, JOURNAL_CATEGORIES } from '../types';
import { getLocalDateKey, formatLocalDate, formatLocalTime } from '../lib/dateUtils';

interface CadenceHeatmapProps {
  entries: JournalEntry[];
}

interface DayData {
  date: Date;
  dateKey: string;
  isToday: boolean;
  isFuture: boolean;
  entries: JournalEntry[];
  dominantCategory: JournalCategory | null;
  count: number;
}

export const CadenceHeatmap: React.FC<CadenceHeatmapProps> = ({ entries }) => {
  const [activeTooltip, setActiveTooltip] = useState<DayData | null>(null);
  const [activeHourTooltip, setActiveHourTooltip] = useState<{
    hour: number;
    count: number;
    period: string;
  } | null>(null);

  // Group entries by local date key
  const entriesByDate = useMemo(() => {
    const map = new Map<string, JournalEntry[]>();
    entries.forEach((e) => {
      if (!e.createdAtMillis) return;
      const key = getLocalDateKey(e.createdAtMillis);
      const existing = map.get(key) || [];
      existing.push(e);
      map.set(key, existing);
    });
    return map;
  }, [entries]);

  // Determine dominant category for an array of entries
  const getDominantCategory = (dayEntries: JournalEntry[]): JournalCategory | null => {
    if (!dayEntries || dayEntries.length === 0) return null;
    const counts: Partial<Record<JournalCategory, number>> = {};
    dayEntries.forEach((e) => {
      const cat = e.userCategory || e.aiCategory || 'Reflection';
      counts[cat] = (counts[cat] || 0) + 1;
    });

    let topCat: JournalCategory = dayEntries[0].userCategory || dayEntries[0].aiCategory || 'Reflection';
    let maxCount = 0;
    Object.entries(counts).forEach(([cat, cnt]) => {
      if (cnt && cnt > maxCount) {
        maxCount = cnt;
        topCat = cat as JournalCategory;
      }
    });
    return topCat;
  };

  // Build calendar matrix (16 weeks x 7 days)
  const { weeks, monthLabels, totalDaysRecorded, activeDaysCount } = useMemo(() => {
    const today = new Date();
    today.setHours(23, 59, 59, 999);

    const WEEKS_COUNT = 16;
    const totalDays = WEEKS_COUNT * 7;

    // Start date is adjusted to begin on Sunday of the oldest week
    const currentDayOfWeek = today.getDay(); // 0 = Sun, 6 = Sat
    const daysSinceStart = (WEEKS_COUNT - 1) * 7 + currentDayOfWeek;

    const startDate = new Date(today);
    startDate.setDate(today.getDate() - daysSinceStart);
    startDate.setHours(0, 0, 0, 0);

    const generatedWeeks: DayData[][] = [];
    const months: { label: string; colIndex: number }[] = [];
    let lastMonth = -1;
    let recordedDays = 0;

    for (let w = 0; w < WEEKS_COUNT; w++) {
      const currentWeek: DayData[] = [];
      for (let d = 0; d < 7; d++) {
        const cellDate = new Date(startDate);
        cellDate.setDate(startDate.getDate() + (w * 7 + d));

        const dateKey = getLocalDateKey(cellDate);
        const dayEntries = entriesByDate.get(dateKey) || [];
        const isToday = getLocalDateKey(new Date()) === dateKey;
        const isFuture = cellDate.getTime() > today.getTime();

        if (dayEntries.length > 0) {
          recordedDays++;
        }

        // Track month label at the first column where month changes
        if (d === 0) {
          const monthIndex = cellDate.getMonth();
          if (monthIndex !== lastMonth) {
            months.push({
              label: cellDate.toLocaleDateString(undefined, { month: 'short' }),
              colIndex: w,
            });
            lastMonth = monthIndex;
          }
        }

        currentWeek.push({
          date: cellDate,
          dateKey,
          isToday,
          isFuture,
          entries: dayEntries,
          dominantCategory: getDominantCategory(dayEntries),
          count: dayEntries.length,
        });
      }
      generatedWeeks.push(currentWeek);
    }

    return {
      weeks: generatedWeeks,
      monthLabels: months,
      totalDaysRecorded: totalDays,
      activeDaysCount: recordedDays,
    };
  }, [entriesByDate]);

  // Circadian & Hourly pattern calculations
  const { hourlyDistribution, periodBreakdown, peakHour, peakPeriodName } = useMemo(() => {
    const hourly = Array.from({ length: 24 }, () => 0);
    const periods = {
      morning: 0, // 6 AM - 11 AM
      afternoon: 0, // 12 PM - 5 PM
      evening: 0, // 6 PM - 10 PM
      night: 0, // 11 PM - 5 AM
    };

    entries.forEach((e) => {
      if (!e.createdAtMillis) return;
      const d = new Date(e.createdAtMillis);
      const hour = d.getHours();
      hourly[hour]++;

      if (hour >= 6 && hour < 12) {
        periods.morning++;
      } else if (hour >= 12 && hour < 18) {
        periods.afternoon++;
      } else if (hour >= 18 && hour < 23) {
        periods.evening++;
      } else {
        periods.night++;
      }
    });

    let topHour = 20; // default 8 PM
    let maxHourCount = 0;
    hourly.forEach((count, h) => {
      if (count > maxHourCount) {
        maxHourCount = count;
        topHour = h;
      }
    });

    let topPeriod = 'Evening';
    let maxPeriodCount = periods.evening;
    if (periods.morning > maxPeriodCount) {
      topPeriod = 'Morning';
      maxPeriodCount = periods.morning;
    }
    if (periods.afternoon > maxPeriodCount) {
      topPeriod = 'Afternoon';
      maxPeriodCount = periods.afternoon;
    }
    if (periods.night > maxPeriodCount) {
      topPeriod = 'Night';
      maxPeriodCount = periods.night;
    }

    return {
      hourlyDistribution: hourly,
      periodBreakdown: periods,
      peakHour: maxHourCount > 0 ? topHour : null,
      peakPeriodName: maxHourCount > 0 ? topPeriod : null,
    };
  }, [entries]);

  // Max count in an hour for bar heights
  const maxHourlyCount = Math.max(...hourlyDistribution, 1);

  // Helper to format hour label (e.g. 14 -> "2 PM")
  const formatHourLabel = (h: number) => {
    const period = h >= 12 ? 'PM' : 'AM';
    const displayHour = h % 12 === 0 ? 12 : h % 12;
    return `${displayHour} ${period}`;
  };

  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  return (
    <section
      id="trends-heatmap-section"
      className="rounded-2xl border border-[#E6E4DD] dark:border-[#2E2C26] bg-[#FFFFFF] dark:bg-[#22211C] p-5 sm:p-7 shadow-xs space-y-7"
    >
      {/* Section Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#F0EEE6] dark:border-[#2E2C26] pb-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-[#5A5A40] dark:text-[#D4D0C2]" />
            <h3 className="font-serif text-lg sm:text-xl font-medium text-[#3A3A35] dark:text-[#EDEAE2]">
              Cadence & Emotional Heatmap
            </h3>
          </div>
          <p className="text-xs sm:text-sm text-[#757469] dark:text-[#A6A498] max-w-xl">
            Longitudinal reflection frequency, dominant mood distribution, and circadian journaling patterns across your history.
          </p>
        </div>

        {/* Stats summary chip */}
        <div className="flex items-center gap-2 flex-wrap text-xs text-[#757469] dark:text-[#A6A498]">
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#FAF9F5] dark:bg-[#1D1C18] border border-[#E6E4DD] dark:border-[#2E2C26]">
            <Calendar className="w-3.5 h-3.5 text-[#5A5A40] dark:text-[#D4D0C2]" />
            <span>
              <strong className="text-[#3A3A35] dark:text-[#EDEAE2]">{activeDaysCount}</strong> active {activeDaysCount === 1 ? 'day' : 'days'} (16 wks)
            </span>
          </div>
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#FAF9F5] dark:bg-[#1D1C18] border border-[#E6E4DD] dark:border-[#2E2C26]">
            <Flame className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
            <span>
              <strong className="text-[#3A3A35] dark:text-[#EDEAE2]">{entries.length}</strong> total {entries.length === 1 ? 'reflection' : 'reflections'}
            </span>
          </div>
        </div>
      </div>

      {/* Sparse / Guidance Notice if few entries */}
      {entries.length < 5 && (
        <div
          id="cadence-sparse-state-notice"
          className="p-3.5 rounded-xl bg-[#FAF9F5] dark:bg-[#1D1C18] border border-[#E6E4DD] dark:border-[#2E2C26] flex items-start gap-2.5 text-xs text-[#757469] dark:text-[#A6A498]"
        >
          <Sparkles className="w-4 h-4 text-[#5A5A40] dark:text-[#D4D0C2] flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-[#3A3A35] dark:text-[#EDEAE2]">
              {entries.length === 0
                ? 'Your reflection calendar is ready to begin'
                : 'Your patterns are starting to form'}
            </p>
            <p className="mt-0.5 text-[11px] leading-relaxed">
              {entries.length === 0
                ? 'Every time you complete a journal session in My Space, its dominant emotion and time will illuminate on this grid.'
                : 'Keep journaling regularly to see circadian rhythms, multi-week emotional heatmaps, and habit consistency emerge.'}
            </p>
          </div>
        </div>
      )}

      {/* 1. Calendar Heatmap View */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-bold uppercase tracking-wider text-[#5A5A40] dark:text-[#A6A498] font-sans">
            16-Week Activity & Mood Calendar
          </span>
          <span className="text-[11px] text-[#858376] dark:text-[#8E8C7F]">
            Hover or tap a day for reflection details
          </span>
        </div>

        {/* Scrollable Heatmap Grid Container */}
        <div className="overflow-x-auto pb-2 scrollbar-thin">
          <div className="min-w-[620px] select-none">
            {/* Month Labels Row */}
            <div className="flex text-[10px] text-[#858376] dark:text-[#8E8C7F] mb-1.5 pl-7">
              {weeks.map((_, wIdx) => {
                const monthMatch = monthLabels.find((m) => m.colIndex === wIdx);
                return (
                  <div key={wIdx} className="w-3.5 sm:w-4 flex-shrink-0 mr-1 text-left">
                    {monthMatch ? monthMatch.label : ''}
                  </div>
                );
              })}
            </div>

            {/* Heatmap Grid: 7 Rows (Sun to Sat) */}
            <div className="flex">
              {/* Day-of-week labels on left (Mon, Wed, Fri) */}
              <div className="flex flex-col justify-between pr-2 text-[9px] text-[#858376] dark:text-[#8E8C7F] font-mono h-[116px] sm:h-[128px]">
                <span className="h-3.5 sm:h-4 leading-3.5 sm:leading-4">Sun</span>
                <span className="h-3.5 sm:h-4 leading-3.5 sm:leading-4">Tue</span>
                <span className="h-3.5 sm:h-4 leading-3.5 sm:leading-4">Thu</span>
                <span className="h-3.5 sm:h-4 leading-3.5 sm:leading-4">Sat</span>
              </div>

              {/* Columns of weeks */}
              <div className="flex gap-1">
                {weeks.map((week, wIdx) => (
                  <div key={wIdx} className="flex flex-col gap-1 flex-shrink-0">
                    {week.map((day, dIdx) => {
                      const hasEntries = day.count > 0;
                      const catConfig = day.dominantCategory
                        ? CATEGORY_CONFIG[day.dominantCategory]
                        : null;

                      // Color and styling based on entry count and category
                      let cellStyle: React.CSSProperties = {};
                      let cellClass =
                        'w-3.5 h-3.5 sm:w-4 sm:h-4 rounded-xs transition-all duration-150 relative cursor-pointer';

                      if (day.isFuture) {
                        cellClass += ' opacity-20 bg-[#EAE8E0] dark:bg-[#282621] cursor-default';
                      } else if (!hasEntries) {
                        cellClass +=
                          ' bg-[#EAE8E0] hover:bg-[#DDD9CE] dark:bg-[#282621] dark:hover:bg-[#34322C] border border-transparent hover:border-[#C5C2B6] dark:hover:border-[#423F36]';
                      } else if (catConfig) {
                        // Styled with category color and intensity scaling
                        const opacity = day.count === 1 ? '0.7' : day.count === 2 ? '0.88' : '1';
                        cellStyle = {
                          backgroundColor: catConfig.color,
                          opacity: Number(opacity),
                        };
                        cellClass +=
                          ' hover:scale-125 shadow-2xs hover:z-20 ring-1 ring-black/10 dark:ring-white/10';
                      }

                      if (day.isToday) {
                        cellClass += ' ring-1.5 ring-[#4A4A38] dark:ring-[#D4D0C2]';
                      }

                      return (
                        <div
                          key={dIdx}
                          id={`heatmap-cell-${day.dateKey}`}
                          style={cellStyle}
                          className={cellClass}
                          onMouseEnter={() => !day.isFuture && setActiveTooltip(day)}
                          onMouseLeave={() => setActiveTooltip(null)}
                          onClick={() => !day.isFuture && setActiveTooltip(day)}
                        />
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Interactive Cell Tooltip Banner */}
        <div className="min-h-[48px] p-2.5 rounded-xl bg-[#FAF9F5] dark:bg-[#1D1C18] border border-[#E6E4DD] dark:border-[#2E2C26] flex items-center justify-between text-xs flex-wrap gap-2">
          {activeTooltip ? (
            <div className="flex items-center gap-2.5 animate-in fade-in duration-100 flex-wrap">
              <span className="font-semibold text-[#3A3A35] dark:text-[#EDEAE2]">
                {formatLocalDate(activeTooltip.date)}
              </span>
              <span className="text-[#858376] dark:text-[#8E8C7F]">·</span>
              {activeTooltip.count > 0 ? (
                <div className="flex items-center gap-2">
                  <span className="font-medium text-[#3A3A35] dark:text-[#EDEAE2]">
                    {activeTooltip.count} {activeTooltip.count === 1 ? 'reflection' : 'reflections'}
                  </span>
                  {activeTooltip.dominantCategory && (
                    <span
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold text-white shadow-2xs"
                      style={{
                        backgroundColor:
                          CATEGORY_CONFIG[activeTooltip.dominantCategory]?.color || '#5A5A40',
                      }}
                    >
                      {activeTooltip.dominantCategory}
                    </span>
                  )}
                </div>
              ) : (
                <span className="text-[#858376] dark:text-[#8E8C7F] italic">
                  No reflections recorded on this day
                </span>
              )}
            </div>
          ) : (
            <div className="text-[#858376] dark:text-[#8E8C7F] text-xs flex items-center gap-1.5">
              <Info className="w-3.5 h-3.5" />
              <span>Hover or tap any square on the 16-week grid to inspect that day's entries and mood tags.</span>
            </div>
          )}

          {/* Intensity Key */}
          <div className="flex items-center gap-1.5 text-[10px] text-[#858376] dark:text-[#8E8C7F] self-end sm:self-center ml-auto">
            <span>Fewer</span>
            <div className="w-2.5 h-2.5 rounded-xs bg-[#EAE8E0] dark:bg-[#282621]" />
            <div className="w-2.5 h-2.5 rounded-xs bg-[#059669]/50" />
            <div className="w-2.5 h-2.5 rounded-xs bg-[#059669]/80" />
            <div className="w-2.5 h-2.5 rounded-xs bg-[#059669]" />
            <span>More</span>
          </div>
        </div>

        {/* Category Mood Color Legend */}
        <div className="pt-2 flex items-center gap-3 flex-wrap text-xs">
          <span className="text-[10px] uppercase font-bold text-[#858376] dark:text-[#8E8C7F] font-sans">
            Mood Colors:
          </span>
          <div className="flex items-center gap-2 flex-wrap">
            {JOURNAL_CATEGORIES.map((cat) => {
              const cfg = CATEGORY_CONFIG[cat];
              return (
                <div key={cat} className="flex items-center gap-1 text-[11px] text-[#757469] dark:text-[#A6A498]">
                  <span
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: cfg.color }}
                  />
                  <span>{cat}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* 2. Circadian & Time-of-Day Journaling Pattern */}
      <div className="pt-4 border-t border-[#F0EEE6] dark:border-[#2E2C26] space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-[#5A5A40] dark:text-[#D4D0C2]" />
              <h4 className="font-serif text-base font-medium text-[#3A3A35] dark:text-[#EDEAE2]">
                Circadian & Time-of-Day Pattern
              </h4>
            </div>
            <p className="text-xs text-[#757469] dark:text-[#A6A498] mt-0.5">
              Distribution of your journaling habits across 24 local hours.
            </p>
          </div>

          {peakPeriodName && peakHour !== null && (
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-[#FAF9F5] dark:bg-[#1D1C18] border border-[#E6E4DD] dark:border-[#2E2C26] text-xs">
              <Sparkles className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
              <span>
                Peak Window: <strong className="text-[#3A3A35] dark:text-[#EDEAE2]">{peakPeriodName} ({formatHourLabel(peakHour)})</strong>
              </span>
            </div>
          )}
        </div>

        {/* 4 Diurnal Period Summary Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          {/* Morning */}
          <div className="p-3 rounded-xl bg-[#FAF9F5] dark:bg-[#1D1C18] border border-[#E6E4DD] dark:border-[#2E2C26] space-y-1">
            <div className="flex items-center justify-between text-xs text-[#757469] dark:text-[#A6A498]">
              <div className="flex items-center gap-1">
                <Sunrise className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                <span className="font-medium">Morning</span>
              </div>
              <span className="text-[10px]">6am–12pm</span>
            </div>
            <p className="font-serif text-lg font-medium text-[#3A3A35] dark:text-[#EDEAE2]">
              {periodBreakdown.morning} <span className="text-xs font-normal text-[#858376] dark:text-[#8E8C7F]">entries</span>
            </p>
          </div>

          {/* Afternoon */}
          <div className="p-3 rounded-xl bg-[#FAF9F5] dark:bg-[#1D1C18] border border-[#E6E4DD] dark:border-[#2E2C26] space-y-1">
            <div className="flex items-center justify-between text-xs text-[#757469] dark:text-[#A6A498]">
              <div className="flex items-center gap-1">
                <Sun className="w-3.5 h-3.5 text-orange-500 dark:text-orange-400" />
                <span className="font-medium">Afternoon</span>
              </div>
              <span className="text-[10px]">12pm–6pm</span>
            </div>
            <p className="font-serif text-lg font-medium text-[#3A3A35] dark:text-[#EDEAE2]">
              {periodBreakdown.afternoon} <span className="text-xs font-normal text-[#858376] dark:text-[#8E8C7F]">entries</span>
            </p>
          </div>

          {/* Evening */}
          <div className="p-3 rounded-xl bg-[#FAF9F5] dark:bg-[#1D1C18] border border-[#E6E4DD] dark:border-[#2E2C26] space-y-1">
            <div className="flex items-center justify-between text-xs text-[#757469] dark:text-[#A6A498]">
              <div className="flex items-center gap-1">
                <Sunset className="w-3.5 h-3.5 text-indigo-500 dark:text-indigo-400" />
                <span className="font-medium">Evening</span>
              </div>
              <span className="text-[10px]">6pm–11pm</span>
            </div>
            <p className="font-serif text-lg font-medium text-[#3A3A35] dark:text-[#EDEAE2]">
              {periodBreakdown.evening} <span className="text-xs font-normal text-[#858376] dark:text-[#8E8C7F]">entries</span>
            </p>
          </div>

          {/* Night */}
          <div className="p-3 rounded-xl bg-[#FAF9F5] dark:bg-[#1D1C18] border border-[#E6E4DD] dark:border-[#2E2C26] space-y-1">
            <div className="flex items-center justify-between text-xs text-[#757469] dark:text-[#A6A498]">
              <div className="flex items-center gap-1">
                <Moon className="w-3.5 h-3.5 text-violet-500 dark:text-violet-400" />
                <span className="font-medium">Night</span>
              </div>
              <span className="text-[10px]">11pm–6am</span>
            </div>
            <p className="font-serif text-lg font-medium text-[#3A3A35] dark:text-[#EDEAE2]">
              {periodBreakdown.night} <span className="text-xs font-normal text-[#858376] dark:text-[#8E8C7F]">entries</span>
            </p>
          </div>
        </div>

        {/* 24-Hour Histogram Chart */}
        <div className="space-y-2 pt-2">
          <div className="flex items-center justify-between text-xs text-[#858376] dark:text-[#8E8C7F]">
            <span>24-Hour Hourly Histogram</span>
            {activeHourTooltip ? (
              <span className="font-medium text-[#3A3A35] dark:text-[#EDEAE2] animate-in fade-in">
                {formatHourLabel(activeHourTooltip.hour)}: <strong>{activeHourTooltip.count}</strong> {activeHourTooltip.count === 1 ? 'reflection' : 'reflections'}
              </span>
            ) : (
              <span>Hover over a bar to inspect volume</span>
            )}
          </div>

          <div className="h-24 flex items-end gap-1 sm:gap-1.5 pt-3 pb-1 px-1 bg-[#FAF9F5] dark:bg-[#1D1C18] rounded-xl border border-[#E6E4DD] dark:border-[#2E2C26] overflow-x-auto">
            {hourlyDistribution.map((count, hour) => {
              const heightPercent = count > 0 ? Math.max(16, (count / maxHourlyCount) * 100) : 6;
              const isPeak = count > 0 && count === maxHourlyCount;
              const isHovered = activeHourTooltip?.hour === hour;

              return (
                <div
                  key={hour}
                  className="flex-1 min-w-[14px] sm:min-w-[18px] flex flex-col items-center h-full justify-end group cursor-pointer"
                  onMouseEnter={() =>
                    setActiveHourTooltip({
                      hour,
                      count,
                      period: formatHourLabel(hour),
                    })
                  }
                  onMouseLeave={() => setActiveHourTooltip(null)}
                >
                  <div
                    style={{ height: `${heightPercent}%` }}
                    className={`w-full rounded-xs transition-all duration-150 ${
                      count === 0
                        ? 'bg-[#EAE8E0] dark:bg-[#282621]'
                        : isPeak
                        ? 'bg-[#4A4A38] dark:bg-[#D4D0C2] shadow-2xs'
                        : isHovered
                        ? 'bg-[#5A5A40] dark:text-[#D4D0C2]'
                        : 'bg-[#5A5A40]/70 dark:bg-[#D4D0C2]/70 hover:bg-[#4A4A38] dark:hover:bg-[#EDEAE2]'
                    }`}
                  />
                </div>
              );
            })}
          </div>

          {/* 24-Hour X-Axis Markers */}
          <div className="flex justify-between text-[10px] text-[#858376] dark:text-[#8E8C7F] px-1 font-mono">
            <span>12 AM</span>
            <span>4 AM</span>
            <span>8 AM</span>
            <span>12 PM</span>
            <span>4 PM</span>
            <span>8 PM</span>
            <span>11 PM</span>
          </div>
        </div>
      </div>
    </section>
  );
};
