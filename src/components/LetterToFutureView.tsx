import React, { useState, useEffect, useRef } from 'react';
import {
  Mail,
  Lock,
  Unlock,
  Calendar,
  Sparkles,
  Send,
  Trash2,
  Clock,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Eye,
  ChevronDown,
  ChevronUp,
  ChevronRight,
  Heart,
  BookOpen,
} from 'lucide-react';
import { UserProfile, LetterToFuture } from '../types';
import {
  subscribeToUserLetters,
  saveLetterToFuture,
  unlockLetter,
  deleteLetter,
} from '../lib/firebase';
import {
  getLocalDateKey,
  localDateStrToMillis,
  formatLocalDate,
} from '../lib/dateUtils';
import {
  DEAR_FUTURE_ME_THEMES,
  ALL_RICH_FUTURE_LETTER_PROMPTS,
  getNonRepeatingPrompts,
  fetchPersonalizedPrompt,
  getRandomDistinctPrompts,
} from '../lib/promptData';

interface LetterToFutureViewProps {
  user: UserProfile;
}

export const LetterToFutureView: React.FC<LetterToFutureViewProps> = ({ user }) => {
  // Letters state from Firestore
  const [letters, setLetters] = useState<LetterToFuture[]>([]);
  const [isLoadingLetters, setIsLoadingLetters] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Compose State
  const [letterContent, setLetterContent] = useState('');
  const [scheduledDate, setScheduledDate] = useState<string>('');
  const [selectedPrompt, setSelectedPrompt] = useState<string>('');
  const [isScheduling, setIsScheduling] = useState(false);
  const [scheduleSuccess, setScheduleSuccess] = useState(false);
  const [scheduleError, setScheduleError] = useState<string | null>(null);

  // Prompt suggestions & categories
  const [prompts, setPrompts] = useState<string[]>([]);
  const [activePromptCategory, setActivePromptCategory] = useState<string>('all');
  const [isSparkingAiPrompts, setIsSparkingAiPrompts] = useState(false);

  // Prompt suggestions collapsible state (defaults expanded if 0 letters, collapsed if letters > 0)
  const [isPromptsExpanded, setIsPromptsExpanded] = useState<boolean>(() => {
    try {
      const stored = localStorage.getItem('mindful_journal_prompts_expanded_future');
      if (stored !== null) {
        return stored === 'true';
      }
    } catch {}
    return true;
  });
  const [hasUserToggledPrompts, setHasUserToggledPrompts] = useState(false);

  // Track session shown prompts to prevent repeats until exhaustion
  const shownFuturePromptsRef = useRef<Set<string>>(new Set());

  // Toggle prompts expansion and persist user choice
  const togglePromptsExpanded = () => {
    setHasUserToggledPrompts(true);
    setIsPromptsExpanded((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('mindful_journal_prompts_expanded_future', String(next));
      } catch {}
      return next;
    });
  };

  // Newly unlocked spotlight state
  const [newlyArrivedIds, setNewlyArrivedIds] = useState<Set<string>>(new Set());
  const [expandedLetterIds, setExpandedLetterIds] = useState<Set<string>>(new Set());
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // Unlocking tracking to prevent duplicate API requests
  const unlockingInProgressRef = useRef<Set<string>>(new Set());

  // Helper for tomorrow's date string (min for custom date input)
  const getTomorrowStr = () => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return getLocalDateKey(d);
  };

  // Preset Date helper
  const setPresetDate = (daysAhead: number) => {
    const d = new Date();
    d.setDate(d.getDate() + daysAhead);
    const dateStr = getLocalDateKey(d);
    setScheduledDate(dateStr);
  };

  // Shuffle prompts from rich library — non-repeating until pool exhaustion, with async Gemini blending (~1/3 of the time)
  const shufflePrompts = (categoryKey = activePromptCategory) => {
    let pool = ALL_RICH_FUTURE_LETTER_PROMPTS;
    if (categoryKey !== 'all') {
      const theme = DEAR_FUTURE_ME_THEMES.find((t) => t.key === categoryKey);
      if (theme && theme.prompts.length > 0) {
        pool = theme.prompts;
      }
    }

    // 1. Guaranteed non-repeating from hand-written pool
    const { prompts: nextPrompts, updatedShown } = getNonRepeatingPrompts(
      pool,
      3,
      shownFuturePromptsRef.current
    );
    shownFuturePromptsRef.current = updatedShown;
    setPrompts(nextPrompts);

    // 2. ~1/3 of the time, fire an asynchronous, non-blocking request to Gemini
    if (Math.random() < 0.35) {
      let themeLabel = 'introspective letters to future self';
      if (categoryKey !== 'all') {
        const found = DEAR_FUTURE_ME_THEMES.find((t) => t.key === categoryKey);
        if (found) themeLabel = `${found.label} - ${found.description}`;
      }
      fetchPersonalizedPrompt('future_letter', [themeLabel]).then((freshPrompt) => {
        if (freshPrompt) {
          setPrompts((current) => {
            if (current.length >= 3 && !current.includes(freshPrompt)) {
              return [current[0], current[1], freshPrompt];
            }
            return current;
          });
          shownFuturePromptsRef.current.add(freshPrompt);
        }
      });
    }
  };

  // Dynamically generate bespoke future-letter prompts with Gemini on explicit user trigger
  const sparkAiLetterPrompts = async () => {
    if (isSparkingAiPrompts) return;
    setIsSparkingAiPrompts(true);

    try {
      let themeLabel = 'introspective letters to future self';
      if (activePromptCategory !== 'all') {
        const found = DEAR_FUTURE_ME_THEMES.find((t) => t.key === activePromptCategory);
        if (found) themeLabel = `${found.label} - ${found.description}`;
      }

      const res = await fetch('/api/prompts/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'future_letter',
          theme: themeLabel,
          count: 3,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.prompts) && data.prompts.length > 0) {
          setPrompts(data.prompts.slice(0, 3));
          data.prompts.forEach((p: string) => shownFuturePromptsRef.current.add(p));
          return;
        }
      }
    } catch (e) {
      console.warn('AI future prompt generation failed, falling back to rich pool:', e);
    } finally {
      setIsSparkingAiPrompts(false);
    }

    shufflePrompts();
  };

  const handleSelectPromptCategory = (key: string) => {
    setActivePromptCategory(key);
    shufflePrompts(key);
  };

  useEffect(() => {
    // Initial page load: drawn directly from hand-written pool without calling Gemini
    const { prompts: initialPrompts, updatedShown } = getNonRepeatingPrompts(
      ALL_RICH_FUTURE_LETTER_PROMPTS,
      3,
      shownFuturePromptsRef.current
    );
    shownFuturePromptsRef.current = updatedShown;
    setPrompts(initialPrompts);

    // Default preset date: 1 month (30 days) from now
    setPresetDate(30);
  }, []);

  // Real-time subscription to letters
  useEffect(() => {
    setIsLoadingLetters(true);
    const unsubscribe = subscribeToUserLetters(
      user.uid,
      (userLetters) => {
        setLetters(userLetters);
        setIsLoadingLetters(false);
        checkAndUnlockLetters(userLetters);

        // Default to expanded for first-time user (0 letters), collapsed thereafter
        try {
          const stored = localStorage.getItem('mindful_journal_prompts_expanded_future');
          if (stored === null && !hasUserToggledPrompts) {
            setIsPromptsExpanded(userLetters.length === 0);
          }
        } catch {}
      },
      (err) => {
        console.error('Failed to subscribe to letters:', err);
        setError('Could not load your letters. Please refresh.');
        setIsLoadingLetters(false);
      }
    );

    return () => unsubscribe();
  }, [user.uid]);

  // Check for arrived letters and trigger unlocking flow
  const checkAndUnlockLetters = async (userLetters: LetterToFuture[]) => {
    const todayStr = getLocalDateKey(new Date());
    const nowMillis = Date.now();

    for (const letter of userLetters) {
      if (!letter.unlocked) {
        const isArrived =
          letter.scheduledDate <= todayStr || letter.scheduledMillis <= nowMillis;

        if (isArrived && !unlockingInProgressRef.current.has(letter.id)) {
          unlockingInProgressRef.current.add(letter.id);
          try {
            // Request AI reflection prompt for this arrived letter
            let reflectionPrompt: string | null = null;
            try {
              const res = await fetch('/api/letter/unlock-reflection', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  content: letter.content,
                  scheduledDate: letter.scheduledDate,
                  createdDate: formatLocalDate(letter.createdAtMillis),
                }),
              });
              if (res.ok) {
                const data = await res.json();
                if (data.reflectionPrompt) {
                  reflectionPrompt = data.reflectionPrompt;
                }
              }
            } catch (aiErr) {
              console.warn('Could not generate unlock reflection:', aiErr);
            }

            await unlockLetter(user.uid, letter.id, reflectionPrompt);
            setNewlyArrivedIds((prev) => new Set([...prev, letter.id]));
          } catch (unlockErr) {
            console.error('Failed to unlock letter:', unlockErr);
            unlockingInProgressRef.current.delete(letter.id);
          }
        }
      }
    }
  };

  // Handle Schedule Letter Submit
  const handleScheduleLetter = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = letterContent.trim();
    if (!trimmed || !scheduledDate || isScheduling) return;

    // Validate future date
    const tomorrowStr = getTomorrowStr();
    if (scheduledDate < tomorrowStr) {
      setScheduleError('Please choose a date at least 1 day in the future.');
      return;
    }

    setIsScheduling(true);
    setScheduleError(null);
    setScheduleSuccess(false);

    try {
      const scheduledMillis = localDateStrToMillis(scheduledDate);

      await saveLetterToFuture(user.uid, {
        content: trimmed,
        scheduledDate,
        scheduledMillis,
      });

      setLetterContent('');
      setScheduleSuccess(true);
      setTimeout(() => setScheduleSuccess(false), 5000);
      shufflePrompts();
    } catch (err: any) {
      console.error('Failed to schedule letter:', err);
      setScheduleError(err?.message || 'Failed to schedule letter. Please try again.');
    } finally {
      setIsScheduling(false);
    }
  };

  // Handle Delete Letter
  const handleDeleteLetter = async (letterId: string) => {
    setDeletingId(letterId);
    try {
      await deleteLetter(user.uid, letterId);
      setConfirmDeleteId(null);
    } catch (err) {
      console.error('Failed to delete letter:', err);
    } finally {
      setDeletingId(null);
    }
  };

  // Toggle letter expanded state
  const toggleExpand = (letterId: string) => {
    setExpandedLetterIds((prev) => {
      const next = new Set(prev);
      if (next.has(letterId)) {
        next.delete(letterId);
      } else {
        next.add(letterId);
      }
      return next;
    });
  };

  // Separate letters into locked and unlocked
  const unlockedLetters = letters.filter((l) => l.unlocked);
  const lockedLetters = letters.filter((l) => !l.unlocked);

  // Format date helper
  const formatDateString = (dateStr: string) => {
    try {
      const millis = localDateStrToMillis(dateStr);
      return formatLocalDate(millis);
    } catch (e) {}
    return dateStr;
  };

  const getDaysRemaining = (scheduledMillis: number) => {
    const diff = scheduledMillis - Date.now();
    const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
    if (days <= 0) return 'Opens today';
    if (days === 1) return 'Opens tomorrow';
    return `Opens in ${days} days`;
  };

  return (
    <div id="letter-to-future-view" className="max-w-4xl mx-auto px-4 sm:px-6 py-8 space-y-10">
      {/* 1. Header Section */}
      <section id="letter-header" className="space-y-2">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-[#EAE8E0] dark:bg-[#282621] text-[#4A4A38] dark:text-[#D4D0C2] flex items-center justify-center shadow-2xs">
            <Mail className="w-4 h-4" />
          </div>
          <span className="text-xs font-semibold uppercase tracking-wider text-[#5A5A40] dark:text-[#A6A498] font-sans">
            Introspective Time Capsule
          </span>
        </div>
        <h2 className="font-serif text-2xl sm:text-3xl font-medium tracking-tight text-[#3A3A35] dark:text-[#EDEAE2]">
          Dear Future Me
        </h2>
        <p className="font-serif italic text-sm text-[#757469] dark:text-[#A6A498] leading-relaxed max-w-2xl">
          Write a gentle, honest message to the person you are becoming. Sealed and kept safe until your chosen date arrives.
        </p>
      </section>

      {/* 2. Newly Arrived Unlocked Letters Spotlight (Warm "A letter from your past self has arrived" reveal) */}
      {unlockedLetters.some((l) => newlyArrivedIds.has(l.id)) && (
        <section
          id="newly-arrived-letters-spotlight"
          className="rounded-2xl border border-amber-300 dark:border-amber-700/60 bg-[#FAF6EE] dark:bg-[#28231A] p-5 sm:p-6 shadow-sm animate-in fade-in slide-in-from-top-3 duration-300 space-y-4"
        >
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-amber-200/80 dark:bg-amber-900/60 text-amber-900 dark:text-amber-200 flex items-center justify-center shadow-2xs">
              <Sparkles className="w-4 h-4 animate-pulse" />
            </div>
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-amber-800 dark:text-amber-300 font-sans">
                A Moment of Reflection
              </span>
              <h3 className="font-serif text-lg font-medium text-[#3A3A35] dark:text-[#EDEAE2]">
                A letter from your past self has arrived
              </h3>
            </div>
          </div>

          <div className="space-y-4">
            {unlockedLetters
              .filter((l) => newlyArrivedIds.has(l.id))
              .map((letter) => (
                <div
                  key={letter.id}
                  className="p-5 rounded-xl bg-[#FFFFFF] dark:bg-[#1E1C18] border border-amber-200 dark:border-amber-900/40 shadow-xs space-y-3"
                >
                  <div className="flex items-center justify-between text-xs text-[#757469] dark:text-[#A6A498] border-b border-[#E6E4DD] dark:border-[#2E2C26] pb-2.5">
                    <div className="flex items-center gap-1.5">
                      <span className="font-medium">
                        Written on {formatLocalDate(letter.createdAtMillis)}
                      </span>
                      <span className="text-[#B0AEA4] dark:text-[#5E5C54]">·</span>
                      <span className="font-semibold text-amber-800 dark:text-amber-300">
                        Arrived on {formatDateString(letter.scheduledDate)}
                      </span>
                    </div>
                    <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-400 font-medium">
                      <Unlock className="w-3.5 h-3.5" />
                      <span>Unlocked</span>
                    </span>
                  </div>

                  <p className="font-serif text-base text-[#3A3A35] dark:text-[#EDEAE2] leading-relaxed whitespace-pre-wrap">
                    {letter.content}
                  </p>

                  {letter.reflectionPrompt && (
                    <div className="mt-3 p-3.5 rounded-xl bg-[#FAF9F5] dark:bg-[#25241F] border border-[#E6E4DD] dark:border-[#38362F] flex items-start gap-2.5 text-xs text-[#5A5A40] dark:text-[#D4D0C2]">
                      <Sparkles className="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                      <div className="space-y-0.5">
                        <span className="font-semibold text-[10px] uppercase tracking-wider text-[#757469] dark:text-[#A6A498]">
                          Reflection on how you've grown
                        </span>
                        <p className="font-serif italic leading-relaxed text-[#3A3A35] dark:text-[#EDEAE2]">
                          {letter.reflectionPrompt}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              ))}
          </div>
        </section>
      )}

      {/* 3. Compose & Schedule Section */}
      <section
        id="compose-letter-section"
        className="rounded-2xl border border-[#E6E4DD] dark:border-[#2E2C26] bg-[#FFFFFF] dark:bg-[#22211C] shadow-xs overflow-hidden"
      >
        <div className="px-5 py-4 border-b border-[#E6E4DD] dark:border-[#2E2C26] bg-[#FAF9F5] dark:bg-[#1D1C18] flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <Lock className="w-4 h-4 text-[#5A5A40] dark:text-[#D4D0C2]" />
            <span className="text-xs font-semibold text-[#5A5A40] dark:text-[#D4D0C2] uppercase tracking-wider font-sans">
              Compose Sealed Letter
            </span>
          </div>
          <span className="text-xs text-[#858376] dark:text-[#8E8C7F]">
            Only you can read this once it unlocks
          </span>
        </div>

        <form onSubmit={handleScheduleLetter} className="p-5 sm:p-6 space-y-5">
          {/* Inspiration Prompts Bar (Collapsible with clear toggle, non-repeating shuffle, optional async AI) */}
          <div className="space-y-3 p-4 rounded-xl bg-[#FAF9F5] dark:bg-[#1D1C18] border border-[#E6E4DD] dark:border-[#2E2C26]">
            <div className="flex items-center justify-between gap-2">
              {/* Expand / Collapse Header Toggle */}
              <button
                type="button"
                id="toggle-future-prompts-btn"
                onClick={togglePromptsExpanded}
                className="flex items-center gap-2 text-left group cursor-pointer select-none rounded-lg -ml-1 px-1 py-0.5 hover:bg-[#EAE8E0]/70 dark:hover:bg-[#282620] transition-colors"
                title={isPromptsExpanded ? 'Collapse prompt suggestions' : 'Expand prompt suggestions'}
              >
                {isPromptsExpanded ? (
                  <ChevronDown className="w-3.5 h-3.5 text-[#5A5A40] dark:text-[#D4D0C2] transition-transform" />
                ) : (
                  <ChevronRight className="w-3.5 h-3.5 text-[#858376] dark:text-[#8E8C7F] transition-transform" />
                )}
                <span className="text-[11px] font-semibold text-[#5A5A40] dark:text-[#A6A498] uppercase tracking-wider font-sans group-hover:text-[#3A3A35] dark:group-hover:text-[#EDEAE2] transition-colors">
                  Inspiration Prompts
                </span>
                {!isPromptsExpanded && (
                  <span className="text-[11px] text-[#858376] dark:text-[#8E8C7F] font-normal font-sans">
                    · {prompts.length} ideas available
                  </span>
                )}
              </button>

              {/* Shuffle Button (Visible when expanded) */}
              {isPromptsExpanded && (
                <button
                  id="future-shuffle-prompts-btn"
                  type="button"
                  onClick={() => shufflePrompts('all')}
                  className="px-2.5 py-1 rounded-lg text-[#757469] hover:text-[#3A3A35] dark:text-[#A6A498] dark:hover:text-[#EDEAE2] hover:bg-[#EAE8E0] dark:hover:bg-[#2A2823] text-xs flex items-center gap-1.5 transition-colors cursor-pointer border border-transparent hover:border-[#D5D2C7] dark:hover:border-[#3E3C34]"
                  title="Shuffle for new introspective prompts"
                >
                  <RefreshCw className="w-3 h-3" />
                  <span>Shuffle</span>
                </button>
              )}
            </div>

            {/* Prompts Cards (Rendered when expanded) */}
            {isPromptsExpanded && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-0.5 animate-in fade-in duration-200">
                {prompts.map((pText, idx) => (
                  <button
                    key={idx}
                    id={`future-prompt-suggestion-${idx}`}
                    type="button"
                    onClick={() => {
                      setSelectedPrompt(pText);
                      setLetterContent((prev) =>
                        prev.trim() ? `${prev}\n\n${pText}\n` : `${pText}\n\n`
                      );
                    }}
                    className="text-left p-3.5 rounded-xl border border-[#D5D2C7] dark:border-[#3E3C34] bg-[#FFFFFF] dark:bg-[#22211C] text-[#3A3A35] dark:text-[#EDEAE2] hover:border-[#5A5A40] dark:hover:border-[#D4D0C2] hover:bg-[#F4F1E8] dark:hover:bg-[#282621] transition-all cursor-pointer shadow-2xs active:scale-[0.98]"
                  >
                    <p className="font-serif leading-relaxed text-[13px] text-[#3A3A35] dark:text-[#EDEAE2]">
                      {pText}
                    </p>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Letter Textarea */}
          <div className="relative">
            <textarea
              id="letter-content-input"
              rows={6}
              value={letterContent}
              onChange={(e) => setLetterContent(e.target.value)}
              placeholder="Dear Future Me,&#10;&#10;Right now, as I write this, here is how I feel..."
              required
              className="w-full rounded-xl border border-[#D5D2C7] dark:border-[#3E3C34] bg-[#FAF9F5] dark:bg-[#1D1C18] p-4 text-sm text-[#3A3A35] dark:text-[#EDEAE2] placeholder:text-[#858376] dark:placeholder:text-[#8E8C7F] focus:outline-none focus:border-[#5A5A40] dark:focus:border-[#D4D0C2] font-serif leading-relaxed"
            />
          </div>

          {/* Date Picker & Preset Options */}
          <div className="space-y-2.5">
            <label className="block text-xs font-semibold text-[#5A5A40] dark:text-[#A6A498] uppercase tracking-wider font-sans">
              When should this letter arrive?
            </label>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setPresetDate(7)}
                className="px-3 py-1.5 rounded-lg text-xs border border-[#D5D2C7] dark:border-[#3E3C34] bg-[#FAF9F5] dark:bg-[#1D1C18] hover:bg-[#F4F1E8] dark:hover:bg-[#2E2C26] text-[#3A3A35] dark:text-[#EDEAE2] transition-colors cursor-pointer"
              >
                In 1 Week
              </button>
              <button
                type="button"
                onClick={() => setPresetDate(30)}
                className="px-3 py-1.5 rounded-lg text-xs border border-[#D5D2C7] dark:border-[#3E3C34] bg-[#FAF9F5] dark:bg-[#1D1C18] hover:bg-[#F4F1E8] dark:hover:bg-[#2E2C26] text-[#3A3A35] dark:text-[#EDEAE2] transition-colors cursor-pointer"
              >
                In 1 Month
              </button>
              <button
                type="button"
                onClick={() => setPresetDate(90)}
                className="px-3 py-1.5 rounded-lg text-xs border border-[#D5D2C7] dark:border-[#3E3C34] bg-[#FAF9F5] dark:bg-[#1D1C18] hover:bg-[#F4F1E8] dark:hover:bg-[#2E2C26] text-[#3A3A35] dark:text-[#EDEAE2] transition-colors cursor-pointer"
              >
                In 3 Months
              </button>
              <button
                type="button"
                onClick={() => setPresetDate(180)}
                className="px-3 py-1.5 rounded-lg text-xs border border-[#D5D2C7] dark:border-[#3E3C34] bg-[#FAF9F5] dark:bg-[#1D1C18] hover:bg-[#F4F1E8] dark:hover:bg-[#2E2C26] text-[#3A3A35] dark:text-[#EDEAE2] transition-colors cursor-pointer"
              >
                In 6 Months
              </button>
              <button
                type="button"
                onClick={() => setPresetDate(365)}
                className="px-3 py-1.5 rounded-lg text-xs border border-[#D5D2C7] dark:border-[#3E3C34] bg-[#FAF9F5] dark:bg-[#1D1C18] hover:bg-[#F4F1E8] dark:hover:bg-[#2E2C26] text-[#3A3A35] dark:text-[#EDEAE2] transition-colors cursor-pointer"
              >
                In 1 Year
              </button>

              {/* Custom Date Input */}
              <div className="flex items-center gap-1.5 ml-auto">
                <Calendar className="w-4 h-4 text-[#858376] dark:text-[#8E8C7F]" />
                <input
                  id="scheduled-date-picker"
                  type="date"
                  min={getTomorrowStr()}
                  value={scheduledDate}
                  onChange={(e) => setScheduledDate(e.target.value)}
                  required
                  className="px-3 py-1.5 rounded-lg border border-[#D5D2C7] dark:border-[#3E3C34] bg-[#FAF9F5] dark:bg-[#1D1C18] text-xs text-[#3A3A35] dark:text-[#EDEAE2] focus:outline-none focus:border-[#5A5A40] dark:focus:border-[#D4D0C2]"
                />
              </div>
            </div>
          </div>

          {/* Feedback Banners */}
          {scheduleError && (
            <div className="p-3 text-xs bg-rose-50 dark:bg-rose-950/40 text-rose-800 dark:text-rose-300 border border-rose-200 dark:border-rose-900/60 rounded-xl flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{scheduleError}</span>
            </div>
          )}

          {scheduleSuccess && (
            <div className="p-3 text-xs bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-900/60 rounded-xl flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 flex-shrink-0 text-emerald-600" />
              <span>Your letter has been sealed and scheduled for {formatDateString(scheduledDate)}.</span>
            </div>
          )}

          {/* Schedule Button */}
          <div className="flex items-center justify-between pt-2">
            <span className="text-xs text-[#858376] dark:text-[#8E8C7F]">
              Scheduled for: <strong className="text-[#3A3A35] dark:text-[#EDEAE2]">{scheduledDate ? formatDateString(scheduledDate) : 'Select a date'}</strong>
            </span>

            <button
              id="schedule-letter-btn"
              type="submit"
              disabled={!letterContent.trim() || !scheduledDate || isScheduling}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#4A4A38] hover:bg-[#38382A] text-[#F8F7F3] dark:bg-[#D4D0C2] dark:hover:bg-[#E2DFD6] dark:text-[#1A1916] text-xs font-semibold transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed shadow-2xs active:scale-98"
            >
              <Lock className="w-3.5 h-3.5" />
              <span>{isScheduling ? 'Sealing Letter...' : 'Seal & Schedule Letter'}</span>
            </button>
          </div>
        </form>
      </section>

      {/* 4. Still-Locked Letters List */}
      <section id="locked-letters-section" className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-[#5A5A40] dark:text-[#D4D0C2]" />
            <h3 className="font-serif text-lg font-medium text-[#3A3A35] dark:text-[#EDEAE2]">
              Sealed in Time ({lockedLetters.length})
            </h3>
          </div>
          <span className="text-xs text-[#858376] dark:text-[#8E8C7F]">
            Contents remain sealed until delivery date
          </span>
        </div>

        {lockedLetters.length === 0 ? (
          <div className="p-8 text-center rounded-2xl border border-dashed border-[#D5D2C7] dark:border-[#3E3C34] bg-[#FFFFFF]/40 dark:bg-[#201F1B]/40 text-xs text-[#858376] dark:text-[#8E8C7F]">
            No pending sealed letters. Compose one above to surprise your future self.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {lockedLetters.map((letter) => (
              <div
                key={letter.id}
                className="p-4 rounded-xl border border-[#E6E4DD] dark:border-[#2E2C26] bg-[#FFFFFF] dark:bg-[#22211C] shadow-2xs space-y-3 flex flex-col justify-between"
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#5A5A40] dark:text-[#D4D0C2]">
                      <Lock className="w-3.5 h-3.5" />
                      <span>{getDaysRemaining(letter.scheduledMillis)}</span>
                    </span>
                    <span className="text-[11px] text-[#858376] dark:text-[#8E8C7F]">
                      Arrives {formatDateString(letter.scheduledDate)}
                    </span>
                  </div>

                  {/* Sealed Visual Placeholder */}
                  <div className="p-3 rounded-lg bg-[#FAF9F5] dark:bg-[#1D1C18] border border-dashed border-[#D5D2C7] dark:border-[#38362F] flex items-center justify-center gap-2 text-xs text-[#858376] dark:text-[#8E8C7F] italic">
                    <Mail className="w-3.5 h-3.5 opacity-60" />
                    <span>Sealed message ({letter.content.length} characters)</span>
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs pt-2 border-t border-[#E6E4DD] dark:border-[#2E2C26]">
                  <span className="text-[11px] text-[#858376] dark:text-[#8E8C7F]">
                    Written {formatLocalDate(letter.createdAtMillis)}
                  </span>

                  {confirmDeleteId === letter.id ? (
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleDeleteLetter(letter.id)}
                        disabled={deletingId === letter.id}
                        className="px-2 py-0.5 rounded bg-rose-600 hover:bg-rose-700 text-white text-[11px] font-medium cursor-pointer"
                      >
                        {deletingId === letter.id ? 'Deleting...' : 'Confirm'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteId(null)}
                        className="px-2 py-0.5 rounded bg-stone-200 dark:bg-stone-800 text-stone-700 dark:text-stone-300 text-[11px] font-medium cursor-pointer"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setConfirmDeleteId(letter.id)}
                      className="text-[#858376] hover:text-rose-700 dark:hover:text-rose-400 flex items-center gap-1 text-[11px] transition-colors cursor-pointer"
                      title="Cancel and delete this sealed letter"
                    >
                      <Trash2 className="w-3 h-3" />
                      <span>Cancel</span>
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* 5. Delivered & Unlocked Letters Archive */}
      {unlockedLetters.length > 0 && (
        <section id="delivered-letters-archive" className="space-y-4 pt-4 border-t border-[#E6E4DD] dark:border-[#2E2C26]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-[#5A5A40] dark:text-[#D4D0C2]" />
              <h3 className="font-serif text-lg font-medium text-[#3A3A35] dark:text-[#EDEAE2]">
                Delivered Letters ({unlockedLetters.length})
              </h3>
            </div>
            <span className="text-xs text-[#858376] dark:text-[#8E8C7F]">
              Messages from your past self
            </span>
          </div>

          <div className="space-y-4">
            {unlockedLetters.map((letter) => {
              const isExpanded = expandedLetterIds.has(letter.id);
              return (
                <div
                  key={letter.id}
                  className="rounded-xl border border-[#E6E4DD] dark:border-[#2E2C26] bg-[#FFFFFF] dark:bg-[#22211C] shadow-2xs overflow-hidden transition-all"
                >
                  <div
                    onClick={() => toggleExpand(letter.id)}
                    className="p-4 flex items-center justify-between cursor-pointer hover:bg-[#FAF9F5] dark:hover:bg-[#1D1C18] transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-7 h-7 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 flex items-center justify-center flex-shrink-0">
                        <Unlock className="w-3.5 h-3.5" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-1.5 text-xs">
                          <span className="font-medium text-[#757469] dark:text-[#A6A498]">
                            Written on {formatLocalDate(letter.createdAtMillis)}
                          </span>
                          <span className="text-[#B0AEA4] dark:text-[#5E5C54]">·</span>
                          <span className="font-semibold text-emerald-700 dark:text-emerald-400">
                            Arrived on {formatDateString(letter.scheduledDate)}
                          </span>
                        </div>
                        <p className="text-xs text-[#757469] dark:text-[#A6A498] truncate font-serif italic max-w-md mt-0.5">
                          "{letter.content}"
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 flex-shrink-0">
                      <button
                        type="button"
                        className="p-1 text-[#858376] hover:text-[#3A3A35] dark:text-[#A6A498] dark:hover:text-[#EDEAE2]"
                      >
                        {isExpanded ? (
                          <ChevronUp className="w-4 h-4" />
                        ) : (
                          <ChevronDown className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="px-5 pb-5 pt-2 border-t border-[#E6E4DD] dark:border-[#2E2C26] bg-[#FAF9F5] dark:bg-[#1D1C18] space-y-4">
                      <div className="p-4 rounded-xl bg-[#FFFFFF] dark:bg-[#22211C] border border-[#E6E4DD] dark:border-[#38362F]">
                        <p className="font-serif text-sm text-[#3A3A35] dark:text-[#EDEAE2] leading-relaxed whitespace-pre-wrap">
                          {letter.content}
                        </p>
                      </div>

                      {letter.reflectionPrompt && (
                        <div className="p-3.5 rounded-xl bg-amber-50/70 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 flex items-start gap-2.5 text-xs text-[#5A5A40] dark:text-[#D4D0C2]">
                          <Sparkles className="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                          <div className="space-y-0.5">
                            <span className="font-semibold text-[10px] uppercase tracking-wider text-amber-800 dark:text-amber-300 font-sans">
                              Reflection Question
                            </span>
                            <p className="font-serif italic leading-relaxed text-[#3A3A35] dark:text-[#EDEAE2]">
                              {letter.reflectionPrompt}
                            </p>
                          </div>
                        </div>
                      )}

                      <div className="flex justify-end pt-1">
                        {confirmDeleteId === letter.id ? (
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleDeleteLetter(letter.id)}
                              disabled={deletingId === letter.id}
                              className="px-2.5 py-1 rounded bg-rose-600 hover:bg-rose-700 text-white text-xs font-medium cursor-pointer"
                            >
                              {deletingId === letter.id ? 'Deleting...' : 'Delete Letter'}
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteId(null)}
                              className="px-2.5 py-1 rounded bg-stone-200 dark:bg-stone-800 text-stone-700 dark:text-stone-300 text-xs font-medium cursor-pointer"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteId(letter.id)}
                            className="text-[#858376] hover:text-rose-700 dark:hover:text-rose-400 flex items-center gap-1 text-xs transition-colors cursor-pointer"
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
        </section>
      )}
    </div>
  );
};
