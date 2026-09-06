import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  Calendar,
  ChevronDown,
  ChevronUp,
  Clock,
  BookOpen,
  Trash2,
  AlertCircle,
  BarChart3,
  Flame,
  ArrowRight,
  RefreshCw,
  CheckCircle2,
  Layers,
} from 'lucide-react';
import { UserProfile, JournalEntry, WeeklyDigest, JournalCategory } from '../types';
import {
  subscribeToUserDigests,
  saveWeeklyDigest,
  deleteWeeklyDigest,
} from '../lib/firebase';
import {
  formatLocalDate,
  formatLocalMonthDay,
  formatLocalDateTime,
} from '../lib/dateUtils';
import { CadenceHeatmap } from './CadenceHeatmap';

interface TrendsViewProps {
  user: UserProfile;
  entries: JournalEntry[];
}

export const TrendsView: React.FC<TrendsViewProps> = ({ user, entries }) => {
  const [digests, setDigests] = useState<WeeklyDigest[]>([]);
  const [expandedDigestId, setExpandedDigestId] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // Subscribe to digests from Firestore
  useEffect(() => {
    if (!user) return;
    const unsubscribe = subscribeToUserDigests(
      user.uid,
      (userDigests) => {
        setDigests(userDigests);
        // Expand the first one if none expanded
        if (userDigests.length > 0 && !expandedDigestId) {
          setExpandedDigestId(userDigests[0].id);
        }
      },
      (err) => {
        console.error('Failed to subscribe to digests:', err);
      }
    );
    return () => unsubscribe();
  }, [user]);

  // Determine window of entries since the most recent digest
  const latestDigest = digests.length > 0 ? digests[0] : null;
  const lastDigestCutoffMillis = latestDigest
    ? latestDigest.dateRange?.endMillis || latestDigest.createdAtMillis
    : 0;

  // Entries created after the latest digest
  const newEntries = entries.filter((e) => {
    const millis =
      e.createdAtMillis ||
      (e.createdAt?.toMillis ? e.createdAt.toMillis() : 0);
    return millis > lastDigestCutoffMillis;
  });

  // Calculate days elapsed since last digest (or since first entry if no digest yet)
  const oldestNewEntry =
    newEntries.length > 0
      ? newEntries.reduce((oldest, current) => {
          const m = current.createdAtMillis || 0;
          return m < (oldest.createdAtMillis || Infinity) ? current : oldest;
        }, newEntries[0])
      : null;

  const referenceStartMillis = lastDigestCutoffMillis > 0
    ? lastDigestCutoffMillis
    : oldestNewEntry?.createdAtMillis || Date.now();

  const daysElapsed = Math.max(
    0,
    Math.floor((Date.now() - referenceStartMillis) / (1000 * 60 * 60 * 24))
  );

  // Trigger Logic:
  // Eligible if 7+ new entries OR (7+ calendar days elapsed and at least 1 new entry)
  const isEligible =
    newEntries.length >= 7 || (daysElapsed >= 7 && newEntries.length >= 1);

  // Category counts across current window
  const currentCategoryCounts: Partial<Record<JournalCategory, number>> = {};
  newEntries.forEach((e) => {
    const cat = e.userCategory || e.aiCategory || 'Reflection';
    currentCategoryCounts[cat] = (currentCategoryCounts[cat] || 0) + 1;
  });

  // Generate Retrospective Digest
  const handleGenerateDigest = async () => {
    if (newEntries.length === 0 || isGenerating) return;
    setIsGenerating(true);
    setGenerateError(null);

    try {
      // 1. Request synthesis from Gemini API
      const response = await fetch('/api/digest/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entries: newEntries,
          previousDigest: latestDigest,
        }),
      });

      if (!response.ok) {
        const errJson = await response.json().catch(() => ({}));
        throw new Error(errJson.error || `Server error: ${response.status}`);
      }

      const data = await response.json();

      // 2. Format date range
      const sortedNew = [...newEntries].sort(
        (a, b) => (a.createdAtMillis || 0) - (b.createdAtMillis || 0)
      );
      const startEntry = sortedNew[0];
      const endEntry = sortedNew[sortedNew.length - 1];

      const startMillis = startEntry.createdAtMillis || Date.now();
      const endMillis = endEntry.createdAtMillis || Date.now();

      const startDateStr = formatLocalMonthDay(startMillis);
      const endDateStr = formatLocalDate(endMillis);

      // 3. Save to Firestore
      const newDigestPayload: Omit<WeeklyDigest, 'id' | 'createdAt'> = {
        createdAtMillis: Date.now(),
        dateRange: {
          startDate: startDateStr,
          endDate: endDateStr,
          startMillis,
          endMillis,
        },
        entryCount: newEntries.length,
        title: data.title || 'Weekly Reflection Digest',
        themes: Array.isArray(data.themes) ? data.themes : ['Quiet Reflection'],
        moodShift: data.moodShift || '',
        categoryBreakdown: currentCategoryCounts,
        observations: Array.isArray(data.observations) ? data.observations : [],
        encouragement: data.encouragement || '',
      };

      const newId = await saveWeeklyDigest(user.uid, newDigestPayload);
      setExpandedDigestId(newId);
    } catch (err: any) {
      console.error('Failed to generate weekly digest:', err);
      setGenerateError(
        err?.message ||
          'Unable to synthesize your weekly retrospective right now. Please try again.'
      );
    } finally {
      setIsGenerating(false);
    }
  };

  // Delete digest
  const handleExecuteDeleteDigest = async (digestId: string) => {
    setDeletingId(digestId);
    try {
      await deleteWeeklyDigest(user.uid, digestId);
      if (expandedDigestId === digestId) {
        setExpandedDigestId(null);
      }
      setConfirmDeleteId(null);
    } catch (err) {
      console.error('Failed to delete digest:', err);
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div
      id="trends-view-container"
      className="max-w-4xl mx-auto px-4 sm:px-6 py-8 space-y-8"
    >
      {/* 1. View Header */}
      <section id="trends-header" className="space-y-1.5">
        <div className="flex items-center gap-2">
          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold tracking-wide uppercase bg-[#EAE8E0] dark:bg-[#2A2823] text-[#5A5A40] dark:text-[#D4D0C2] border border-[#D5D2C7] dark:border-[#3E3C34]">
            Longitudinal Intelligence
          </span>
        </div>
        <h2 className="font-serif text-2xl sm:text-3xl font-medium tracking-tight text-[#3A3A35] dark:text-[#EDEAE2]">
          Emotional Patterns & Weekly Retrospective
        </h2>
        <p className="font-sans text-sm text-[#757469] dark:text-[#A6A498] max-w-2xl leading-relaxed">
          Reflect uncovers recurring themes, emotional patterns, and compassionate observations across your reflections every 7 entries or 7 days.
        </p>
      </section>

      {/* 2. Active Digest Synthesis Card / Status */}
      <section
        id="digest-trigger-card"
        className="rounded-2xl border border-[#E6E4DD] dark:border-[#2E2C26] bg-[#FFFFFF] dark:bg-[#22211C] p-5 sm:p-6 shadow-xs relative overflow-hidden"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-5">
          <div className="space-y-2 flex-1">
            <div className="flex items-center gap-2">
              <div
                className={`w-2.5 h-2.5 rounded-full ${
                  isEligible
                    ? 'bg-emerald-500 animate-pulse'
                    : 'bg-amber-500/80'
                }`}
              />
              <h3 className="font-serif text-lg font-medium text-[#3A3A35] dark:text-[#EDEAE2]">
                {isEligible
                  ? 'Your New Weekly Retrospective is Ready'
                  : 'Weekly Retrospective in Progress'}
              </h3>
            </div>

            <p className="text-xs sm:text-sm text-[#757469] dark:text-[#A6A498] leading-relaxed max-w-xl">
              {isEligible
                ? `You have accumulated ${newEntries.length} new reflection${
                    newEntries.length > 1 ? 's' : ''
                  }. Synthesize a compassionate summary of your themes, emotional arc, and growth.`
                : `Your retrospective compiles every 7 entries or 7 days. You currently have ${newEntries.length} of 7 reflections saved.`}
            </p>

            {/* Progress indicators */}
            <div className="pt-2 flex flex-wrap items-center gap-4 text-xs text-[#858376] dark:text-[#8E8C7F]">
              <div className="flex items-center gap-1.5 font-medium">
                <BookOpen className="w-3.5 h-3.5 text-[#5A5A40] dark:text-[#D4D0C2]" />
                <span>
                  {newEntries.length} / 7 reflections
                </span>
              </div>
              <div className="w-24 bg-[#EAE8E0] dark:bg-[#2E2C26] rounded-full h-1.5 overflow-hidden">
                <div
                  className="bg-[#4A4A38] dark:bg-[#D4D0C2] h-full rounded-full transition-all duration-300"
                  style={{
                    width: `${Math.min(100, (newEntries.length / 7) * 100)}%`,
                  }}
                />
              </div>
              <div className="flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-[#858376] dark:text-[#8E8C7F]" />
                <span>{daysElapsed} / 7 days active</span>
              </div>
            </div>
          </div>

          {/* Action Button */}
          <div className="flex flex-col sm:items-end gap-2 flex-shrink-0">
            <button
              id="generate-retrospective-btn"
              type="button"
              disabled={newEntries.length === 0 || isGenerating}
              onClick={handleGenerateDigest}
              className={`inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-medium text-xs sm:text-sm transition-all shadow-2xs cursor-pointer ${
                isEligible
                  ? 'bg-[#4A4A38] hover:bg-[#38382A] text-[#F8F7F3] dark:bg-[#D4D0C2] dark:hover:bg-[#E2DFD6] dark:text-[#1A1916] ring-2 ring-[#4A4A38]/20'
                  : 'bg-[#FAF9F5] hover:bg-[#F0EEE6] dark:bg-[#2A2823] dark:hover:bg-[#32302A] text-[#3A3A35] dark:text-[#EDEAE2] border border-[#D5D2C7] dark:border-[#3E3C34]'
              } disabled:opacity-40 disabled:cursor-not-allowed active:scale-98`}
            >
              {isGenerating ? (
                <>
                  <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                  <span>Synthesizing Digest...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 text-amber-500" />
                  <span>
                    {isEligible ? 'Generate Retrospective' : 'Generate Early Retrospective'}
                  </span>
                </>
              )}
            </button>
            {newEntries.length === 0 && (
              <span className="text-[10px] text-[#858376] dark:text-[#8E8C7F]">
                Complete at least 1 reflection in My Space first
              </span>
            )}
          </div>
        </div>

        {/* Error notification */}
        {generateError && (
          <div className="mt-4 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 flex items-center gap-2 text-xs text-rose-800 dark:text-rose-200">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span className="flex-1">{generateError}</span>
            <button
              type="button"
              onClick={handleGenerateDigest}
              className="font-semibold underline hover:no-underline cursor-pointer"
            >
              Retry
            </button>
          </div>
        )}
      </section>

      {/* 3. Retrospectives Archives Section */}
      <section id="retrospectives-archive" className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-[#5A5A40] dark:text-[#D4D0C2]" />
            <h3 className="font-serif text-lg font-medium text-[#3A3A35] dark:text-[#EDEAE2]">
              Past Weekly Retrospectives
            </h3>
          </div>
          <span className="text-xs text-[#858376] dark:text-[#8E8C7F]">
            {digests.length} digest{digests.length === 1 ? '' : 's'} recorded
          </span>
        </div>

        {digests.length === 0 ? (
          /* Empty / Friendly Welcome Placeholder */
          <div
            id="empty-digests-placeholder"
            className="p-8 sm:p-10 rounded-2xl border border-dashed border-[#D5D2C7] dark:border-[#3E3C34] bg-[#FFFFFF]/60 dark:bg-[#201F1B]/60 text-center space-y-3"
          >
            <div className="w-12 h-12 rounded-2xl bg-[#EAE8E0] dark:bg-[#282621] text-[#5A5A40] dark:text-[#D4D0C2] flex items-center justify-center mx-auto shadow-2xs">
              <Sparkles className="w-6 h-6" />
            </div>
            <h4 className="font-serif text-base sm:text-lg font-medium text-[#3A3A35] dark:text-[#EDEAE2]">
              Your first weekly retrospective will appear once you've journaled a bit more
            </h4>
            <p className="text-xs sm:text-sm text-[#757469] dark:text-[#A6A498] max-w-md mx-auto leading-relaxed">
              As you write in <em>My Space</em>, Reflect gently tracks recurring thoughts, emotional balance, and personal milestones to craft an introspective summary for you.
            </p>
          </div>
        ) : (
          /* List of past digests */
          <div className="space-y-4" id="digests-list">
            {digests.map((digest) => {
              const isExpanded = expandedDigestId === digest.id;
              const dateRangeText = digest.dateRange
                ? `${digest.dateRange.startDate} – ${digest.dateRange.endDate}`
                : formatLocalDate(digest.createdAtMillis);

              return (
                <div
                  key={digest.id}
                  id={`digest-card-${digest.id}`}
                  className="rounded-2xl border border-[#E6E4DD] dark:border-[#2E2C26] bg-[#FFFFFF] dark:bg-[#22211C] shadow-xs overflow-hidden transition-all hover:border-[#5A5A40] dark:hover:border-[#423F36]"
                >
                  {/* Digest Summary Header */}
                  <div
                    className="p-5 sm:p-6 cursor-pointer select-none"
                    onClick={() =>
                      setExpandedDigestId(isExpanded ? null : digest.id)
                    }
                  >
                    <div className="flex items-center justify-between gap-2 flex-wrap text-xs text-[#757469] dark:text-[#A6A498] mb-2">
                      <div className="inline-flex items-center gap-1.5 font-medium text-[#5A5A40] dark:text-[#D4D0C2]">
                        <Calendar className="w-3.5 h-3.5" />
                        <span>{dateRangeText}</span>
                      </div>
                      <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-[#EAE8E0] dark:bg-[#2A2823] text-[#5A5A40] dark:text-[#D4D0C2]">
                        {digest.entryCount} reflections
                      </span>
                    </div>

                    <h4 className="font-serif text-xl sm:text-2xl font-medium text-[#3A3A35] dark:text-[#EDEAE2] mb-2.5">
                      {digest.title}
                    </h4>

                    <p className="text-xs sm:text-sm text-[#5A5A40] dark:text-[#C5C2B6] leading-relaxed mb-3">
                      {digest.moodShift}
                    </p>

                    {/* Recurring Themes Chips */}
                    {digest.themes && digest.themes.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {digest.themes.map((theme, tIdx) => (
                          <span
                            key={tIdx}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs bg-[#FAF9F5] dark:bg-[#1A1916] text-[#3A3A35] dark:text-[#EDEAE2] border border-[#E6E4DD] dark:border-[#2E2C26]"
                          >
                            <span className="w-1 h-1 rounded-full bg-[#757469]" />
                            <span>{theme}</span>
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Expand Chevron & Category Breakdown Pill Row */}
                    <div className="flex items-center justify-between gap-2 mt-4 pt-3 border-t border-[#F0EEE6] dark:border-[#2A2823]">
                      <div className="flex flex-wrap gap-1.5 items-center">
                        {Object.entries(digest.categoryBreakdown || {}).map(
                          ([cat, count]) => (
                            <span
                              key={cat}
                              className="text-[10px] px-2 py-0.5 rounded-md bg-[#F4F1E8] dark:bg-[#282621] text-[#757469] dark:text-[#A6A498]"
                            >
                              {cat}: {count}
                            </span>
                          )
                        )}
                      </div>

                      <button
                        type="button"
                        className="p-1 text-[#858376] hover:text-[#3A3A35] dark:hover:text-[#EDEAE2] rounded-lg hover:bg-[#EAE8E0] dark:hover:bg-[#2E2C26] transition-colors cursor-pointer"
                        title={isExpanded ? 'Collapse retrospective' : 'Read full retrospective'}
                        onClick={(e) => {
                          e.stopPropagation();
                          setExpandedDigestId(isExpanded ? null : digest.id);
                        }}
                      >
                        {isExpanded ? (
                          <ChevronUp className="w-4 h-4" />
                        ) : (
                          <ChevronDown className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Expanded Content Section */}
                  {isExpanded && (
                    <div
                      id={`expanded-digest-${digest.id}`}
                      className="border-t border-[#E6E4DD] dark:border-[#2E2C26] bg-[#FAF9F5] dark:bg-[#1A1916] p-5 sm:p-6 space-y-5 animate-in fade-in duration-150"
                    >
                      {/* Observations */}
                      {digest.observations && digest.observations.length > 0 && (
                        <div className="space-y-2">
                          <span className="text-[11px] font-semibold uppercase tracking-wider text-[#5A5A40] dark:text-[#A6A498]">
                            Gentle Observations
                          </span>
                          <div className="space-y-2">
                            {digest.observations.map((obs, oIdx) => (
                              <div
                                key={oIdx}
                                className="p-3 rounded-xl bg-[#FFFFFF] dark:bg-[#22211C] border border-[#E6E4DD] dark:border-[#2E2C26] text-xs sm:text-sm text-[#3A3A35] dark:text-[#EDEAE2] leading-relaxed flex items-start gap-2.5 shadow-2xs"
                              >
                                <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 flex-shrink-0 mt-0.5" />
                                <span>{obs}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Encouragement */}
                      {digest.encouragement && (
                        <div className="p-4 rounded-xl bg-[#F4F1E8] dark:bg-[#282621] border border-[#D5D2C7] dark:border-[#3E3C34] space-y-1">
                          <span className="text-[11px] font-semibold uppercase tracking-wider text-[#5A5A40] dark:text-[#D4D0C2] flex items-center gap-1.5">
                            <Sparkles className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                            <span>Compassionate Closing</span>
                          </span>
                          <p className="font-serif italic text-sm sm:text-base text-[#3A3A35] dark:text-[#EDEAE2] leading-relaxed">
                            "{digest.encouragement}"
                          </p>
                        </div>
                      )}

                      {/* Delete Digest Row */}
                      <div className="flex items-center justify-between pt-2 border-t border-[#E6E4DD] dark:border-[#2E2C26] text-xs">
                        <span className="text-[#858376] dark:text-[#8E8C7F] text-[11px]">
                          Saved to your personal archives
                        </span>

                        {confirmDeleteId === digest.id ? (
                          <div className="flex items-center gap-1.5 bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-900/80 px-2.5 py-1 rounded-lg text-rose-800 dark:text-rose-200">
                            <span className="text-[11px]">Remove digest?</span>
                            <button
                              type="button"
                              disabled={deletingId === digest.id}
                              onClick={() => handleExecuteDeleteDigest(digest.id)}
                              className="px-2 py-0.5 rounded bg-rose-600 hover:bg-rose-700 text-white font-medium text-[11px] cursor-pointer"
                            >
                              {deletingId === digest.id ? 'Deleting...' : 'Delete'}
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteId(null)}
                              className="px-2 py-0.5 rounded bg-stone-200 dark:bg-stone-800 text-stone-700 dark:text-stone-300 font-medium text-[11px] hover:bg-stone-300 dark:hover:bg-stone-700 cursor-pointer"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            disabled={deletingId === digest.id}
                            onClick={() => setConfirmDeleteId(digest.id)}
                            className="text-[#858376] hover:text-rose-700 dark:hover:text-rose-400 flex items-center gap-1 transition-colors cursor-pointer text-xs"
                            title="Delete this retrospective"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>Delete</span>
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* 4. Real Cadence & Emotional Heatmap Section */}
      <CadenceHeatmap entries={entries} />
    </div>
  );
};
