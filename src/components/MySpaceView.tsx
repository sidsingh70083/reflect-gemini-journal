import React, { useState, useEffect, useRef } from 'react';
import {
  Send,
  Mic,
  Sparkles,
  RefreshCw,
  BookmarkCheck,
  Calendar,
  ChevronRight,
  ChevronDown,
  Trash2,
  Clock,
  Compass,
  MessageSquare,
  AlertCircle,
  HelpCircle,
  X,
  History,
  BookOpen,
  CheckCircle2,
  Check,
  Target,
  ArrowUpDown,
  Printer,
  MapPin,
  MapPinOff,
  CheckSquare,
  Square,
  FileDown,
  Layers,
  Loader2,
  ArrowUpRight,
  Plus,
  Video,
} from 'lucide-react';
import {
  UserProfile,
  JournalMessage,
  JournalEntry,
  JournalCategory,
  JournalLocation,
  AudioTranscriptionResult,
  VideoAnalysisResult,
  SUPPORTIVE_GREETINGS,
  CustomAvatarType,
} from '../types';
import { UserAvatar } from './UserAvatar';
import {
  STARTER_PROMPTS_BY_THEME,
  ALL_RICH_STARTER_PROMPTS,
  getNonRepeatingPrompts,
  fetchPersonalizedPrompt,
  getRandomDistinctPrompts,
} from '../lib/promptData';
import { requestCurrentLocation } from '../lib/geolocation';
import { PdfExportModal } from './PdfExportModal';
import { CategoryChip } from './CategoryChip';
import {
  useAudioRecorder,
  AudioRecorderPanel,
  AudioRecordButton,
} from './AudioRecorder';
import {
  useVideoRecorder,
  VideoRecorderStudio,
  VideoRecordButton,
} from './VideoRecorder';
import {
  updateEntryCategory,
  deleteJournalEntry,
  updateJournalEntryCheckin,
} from '../lib/firebase';
import {
  getLocalDateKey,
  formatLocalDateTime,
  formatLocalTime,
  formatLocalDate,
  categorizeDateGroup,
  DateGroupCategory,
} from '../lib/dateUtils';
import { useReflection } from '../context/ReflectionContext';

interface MySpaceViewProps {
  user: UserProfile;
  entries: JournalEntry[];
  streak: number;
  dailyCheckinsEnabled?: boolean;
  locationEnabled?: boolean;
  customAvatar?: CustomAvatarType;
  onNavigateTab?: (tabId: string) => void;
}

export const MySpaceView: React.FC<MySpaceViewProps> = ({
  user,
  entries,
  streak,
  dailyCheckinsEnabled = true,
  locationEnabled = false,
  customAvatar = 'default',
  onNavigateTab,
}) => {
  // Shared Active Chat & Background Reflection Context
  const {
    messages,
    inputText,
    isGenerating,
    isSaving,
    saveError,
    isHistoryOpen,
    expandedEntryId,
    setInputText,
    setIsHistoryOpen,
    setExpandedEntryId,
    handleSendMessage: sendToGemini,
    handleEndAndSaveSession: saveSessionToFirestore,
    handleDiscardDraft: discardSessionDraft,
  } = useReflection();

  // Mobile / touch device detection for keyboard behavior and compact layout
  const [isMobileDevice, setIsMobileDevice] = useState(false);
  useEffect(() => {
    const checkMobile = () => {
      const isTouch = window.matchMedia('(pointer: coarse)').matches;
      const isNarrow = window.innerWidth < 768;
      setIsMobileDevice(isTouch || isNarrow);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Mobile secondary tools popover/menu toggle
  const [isMoreMenuOpen, setIsMoreMenuOpen] = useState(false);

  // Personalized Greeting & Rotating Supportive Message
  const [supportiveQuote, setSupportiveQuote] = useState('');
  
  // Starter Reflections (Streamlined, creative, non-overwhelming)
  const [prompts, setPrompts] = useState<string[]>([]);
  const [isDiscarding, setIsDiscarding] = useState(false);

  // User manually toggled starter reflections ref
  const userManuallyToggledPromptsRef = useRef(false);

  // Prompt suggestions collapsible state (defaults expanded if 0 entries, collapsed if entries > 0)
  const [isPromptsExpanded, setIsPromptsExpanded] = useState<boolean>(() => {
    try {
      const stored = localStorage.getItem('mindful_journal_prompts_expanded_myspace');
      if (stored !== null) {
        return stored === 'true';
      }
    } catch {}
    return entries.length === 0;
  });

  // Sync default expansion when entries load if user hasn't explicitly toggled it
  useEffect(() => {
    if (!userManuallyToggledPromptsRef.current) {
      try {
        const stored = localStorage.getItem('mindful_journal_prompts_expanded_myspace');
        if (stored === null) {
          setIsPromptsExpanded(entries.length === 0);
        }
      } catch {}
    }
  }, [entries.length]);

  // Track session shown prompts to prevent repeats until pool exhaustion
  const shownPromptsRef = useRef<Set<string>>(new Set());

  // Gentle dismissible stress -> Stillness suggestion banner
  const [stressSuggestion, setStressSuggestion] = useState<{
    show: boolean;
    category?: JournalCategory;
  } | null>(null);
  const hasShownStressSuggestionRef = useRef(false);

  // Toggle prompts expansion and persist user choice
  const togglePromptsExpanded = () => {
    userManuallyToggledPromptsRef.current = true;
    setIsPromptsExpanded((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('mindful_journal_prompts_expanded_myspace', String(next));
      } catch {}
      return next;
    });
  };

  // Location context: default is OFF, controlled via Settings.
  const isLocationActive = Boolean(locationEnabled);
  const [currentLocation, setCurrentLocation] = useState<JournalLocation | null>(null);
  const [isLocating, setIsLocating] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);

  // PDF Export Modal State & Selected History Entries
  const [isPdfExportOpen, setIsPdfExportOpen] = useState(false);
  const [pdfExportSelectedIds, setPdfExportSelectedIds] = useState<string[] | undefined>(undefined);
  const [selectedHistoryEntryIds, setSelectedHistoryEntryIds] = useState<Set<string>>(new Set());

  // Check-in response state
  const [isRespondingCheckin, setIsRespondingCheckin] = useState(false);

  // History Drawer & Expanded Entry State
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest'>('newest');
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Chat scroll anchor
  const chatBottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-grow textarea with user input while staying clean single-line at rest without scrollbar
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      if (!inputText) {
        textareaRef.current.style.height = '36px';
        textareaRef.current.style.overflowY = 'hidden';
      } else {
        const scrollHeight = textareaRef.current.scrollHeight;
        const targetHeight = Math.min(Math.max(36, scrollHeight), 160);
        textareaRef.current.style.height = `${targetHeight}px`;
        textareaRef.current.style.overflowY = scrollHeight > 160 ? 'auto' : 'hidden';
      }
    }
  }, [inputText]);

  // MediaRecorder Audio Hook
  const audioRecorder = useAudioRecorder({
    onTranscriptionComplete: (result, autoSend) => handleAudioTranscription(result, autoSend),
    disabled: isGenerating || isSaving,
  });

  // Video Reflection & Multimodal Mood Analysis Hook
  const videoRecorder = useVideoRecorder({
    onAnalysisComplete: (result, autoSend) => handleVideoAnalysis(result, autoSend),
    disabled: isGenerating || isSaving,
  });

  // Micro-commitment check-in loop calculation:
  const todayKey = getLocalDateKey(new Date());

  const pendingCommitmentEntry = dailyCheckinsEnabled
    ? entries.find((entry) => {
        if (!entry.nextDayCommitment || entry.commitmentCheckin) return false;
        const entryDateKey = getLocalDateKey(entry.createdAtMillis);
        return entryDateKey < todayKey;
      })
    : null;

  const handleCheckinResponse = async (status: 'yes' | 'not_yet' | 'skip') => {
    if (!pendingCommitmentEntry || isRespondingCheckin) return;
    setIsRespondingCheckin(true);
    try {
      await updateJournalEntryCheckin(user.uid, pendingCommitmentEntry.id, {
        status,
        respondedAt: Date.now(),
      });
    } catch (err) {
      console.error('Failed to update commitment checkin:', err);
    } finally {
      setIsRespondingCheckin(false);
    }
  };

  // Extract user's first name
  const firstName = user?.displayName
    ? user.displayName.split(' ')[0]
    : 'Friend';

  // Acquire location helper
  const fetchLocation = async () => {
    if (typeof window === 'undefined' || !navigator.geolocation) return;
    setIsLocating(true);
    setLocationError(null);
    try {
      const res = await requestCurrentLocation();
      if (res.error) {
        setLocationError(res.error);
      } else if (res.location) {
        setCurrentLocation(res.location);
        setLocationError(null);
      }
    } catch (err: any) {
      console.warn('Geolocation capture failed:', err);
    } finally {
      setIsLocating(false);
    }
  };

  // Automatically acquire location if enabled in settings
  useEffect(() => {
    if (isLocationActive && !currentLocation && !isLocating) {
      fetchLocation();
    } else if (!isLocationActive && currentLocation) {
      setCurrentLocation(null);
    }
  }, [isLocationActive]);

  // Shuffle prompts from rich library — non-repeating until pool exhaustion, with async Gemini blending (~1/3 of the time)
  const shufflePrompts = () => {
    // 1. Immediately pick from hand-written pool with non-repeating guarantee
    const { prompts: nextPrompts, updatedShown } = getNonRepeatingPrompts(
      ALL_RICH_STARTER_PROMPTS,
      3,
      shownPromptsRef.current
    );
    shownPromptsRef.current = updatedShown;
    setPrompts(nextPrompts);

    // 2. ~1/3 of the time, fire an asynchronous, non-blocking request to Gemini conditioned on recent entries
    if (Math.random() < 0.35) {
      const recentCats = entries.slice(0, 3).map((e) => e.userCategory || e.aiCategory);
      const recentSums = entries
        .slice(0, 2)
        .map((e) => e.summary)
        .filter(Boolean) as string[];

      fetchPersonalizedPrompt('journal', recentCats, recentSums).then((freshPrompt) => {
        if (freshPrompt) {
          setPrompts((current) => {
            if (current.length >= 3 && !current.includes(freshPrompt)) {
              return [current[0], current[1], freshPrompt];
            }
            return current;
          });
          shownPromptsRef.current.add(freshPrompt);
        }
      });
    }
  };

  // Toggle entry selection for PDF export
  const toggleHistoryEntrySelection = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setSelectedHistoryEntryIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  useEffect(() => {
    // Initial page load: drawn directly from local pool (zero latency, no Gemini call on initial mount)
    const { prompts: initialPrompts, updatedShown } = getNonRepeatingPrompts(
      ALL_RICH_STARTER_PROMPTS,
      3,
      shownPromptsRef.current
    );
    shownPromptsRef.current = updatedShown;
    setPrompts(initialPrompts);

    const randomQuote =
      SUPPORTIVE_GREETINGS[
        Math.floor(Math.random() * SUPPORTIVE_GREETINGS.length)
      ];
    setSupportiveQuote(randomQuote);
  }, []);

  // Close history drawer on Escape key press
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isHistoryOpen) {
        setIsHistoryOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isHistoryOpen, setIsHistoryOpen]);

  // Auto-scroll chat to bottom on new message or generation state
  useEffect(() => {
    if (messages.length > 0) {
      chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isGenerating]);

  // Handle MediaRecorder audio transcription & emotional tagging from Gemini
  const handleAudioTranscription = (result: AudioTranscriptionResult, autoSend = false) => {
    const newText = result.transcription.trim();
    if (!newText) return;

    if (autoSend) {
      sendToGemini(newText);
    } else {
      setInputText((prev) => {
        const trimmedPrev = prev.trim();
        if (!trimmedPrev) return newText;
        return `${trimmedPrev}\n\n${newText}`;
      });
      setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.focus();
        }
      }, 50);
    }
  };

  // Handle Video Reflection & Multimodal Mood Analysis
  const handleVideoAnalysis = (result: VideoAnalysisResult, autoSend = false) => {
    const newText = result.transcription.trim();
    if (!newText) return;

    if (autoSend) {
      sendToGemini(newText);
    } else {
      setInputText((prev) => {
        const trimmedPrev = prev.trim();
        if (!trimmedPrev) return newText;
        return `${trimmedPrev}\n\n${newText}`;
      });
      setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.focus();
        }
      }, 50);
    }
  };

  // Handle Icebreaker Prompt Tap
  const handleSelectPrompt = (promptText: string) => {
    setInputText(promptText);
    textareaRef.current?.focus();
  };

  // Handle Discard draft
  const handleDiscardDraft = () => {
    if (audioRecorder.isRecording) {
      audioRecorder.cancelRecording();
    }
    if (videoRecorder.isRecording) {
      videoRecorder.cancelRecording();
    }
    discardSessionDraft();
    if (isLocationActive) {
      fetchLocation();
    } else {
      setCurrentLocation(null);
    }
    setLocationError(null);
    setIsDiscarding(false);
    shufflePrompts();
  };

  // Handle Sending a Message to Gemini
  const handleSendMessage = async () => {
    const trimmed = inputText.trim();
    if (!trimmed || isGenerating) return;

    if (audioRecorder.isRecording) {
      audioRecorder.cancelRecording();
    }
    if (videoRecorder.isRecording) {
      videoRecorder.cancelRecording();
    }

    await sendToGemini();
  };

  // Handle Enter key in textarea (mobile inserts newline; desktop Enter sends)
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (isMobileDevice) {
      // On touch / mobile screens, pressing Enter simply creates a newline
      return;
    }
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // Handle Ending and Saving Session
  const handleEndAndSaveSession = async () => {
    if (messages.length === 0 || isSaving) return;
    if (audioRecorder.isRecording) {
      audioRecorder.cancelRecording();
    }
    if (videoRecorder.isRecording) {
      videoRecorder.cancelRecording();
    }

    const saved = await saveSessionToFirestore(
      streak,
      (savedCategory) => {
        shufflePrompts();
        if (isLocationActive) {
          fetchLocation();
        } else {
          setCurrentLocation(null);
        }

        // Gentle, soft suggestion if session touched on Stress or Sadness
        if (
          (savedCategory === 'Stress' || savedCategory === 'Sadness') &&
          !hasShownStressSuggestionRef.current
        ) {
          setStressSuggestion({ show: true, category: savedCategory });
          hasShownStressSuggestionRef.current = true;
        }
      },
      isLocationActive ? currentLocation : null
    );
  };

  // Handle Category Override for Past Entry
  const handleCategoryOverride = async (
    entryId: string,
    newCategory: JournalCategory
  ) => {
    try {
      await updateEntryCategory(user.uid, entryId, newCategory);
    } catch (err) {
      console.error('Error updating entry category override:', err);
    }
  };

  // Handle Delete Past Entry with inline confirmation
  const handleExecuteDeleteEntry = async (entryId: string) => {
    setDeletingId(entryId);
    setDeleteError(null);
    try {
      await deleteJournalEntry(user.uid, entryId);
      if (expandedEntryId === entryId) {
        setExpandedEntryId(null);
      }
      setConfirmDeleteId(null);
    } catch (err: any) {
      console.error('Failed to delete entry from Firestore:', err);
      setDeleteError(err?.message || 'Failed to delete reflection. Please try again.');
    } finally {
      setDeletingId(null);
    }
  };

  // Format timestamp helpers using local timezone
  const formatEntryDate = (millis?: number) => {
    return formatLocalDateTime(millis);
  };

  return (
    <div id="my-space-container" className="max-w-4xl mx-auto px-4 sm:px-6 py-4 sm:py-8 space-y-4 sm:space-y-8 relative">
      {/* 1. Personalized Greeting Section with History Drawer Toggle */}
      <section id="greeting-section" className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
        <div className="space-y-0.5 sm:space-y-1.5">
          <h2 className="font-serif text-2xl sm:text-3xl font-medium tracking-tight text-[#3A3A35] dark:text-[#EDEAE2]">
            Welcome, {firstName}
          </h2>
          <p className="font-serif italic text-xs sm:text-sm text-[#757469] dark:text-[#A6A498] leading-relaxed">
            {supportiveQuote}
          </p>
        </div>

        {/* History Side Panel Toggle Button */}
        <button
          id="toggle-history-drawer-btn"
          type="button"
          onClick={() => setIsHistoryOpen(true)}
          className="self-start sm:self-center inline-flex items-center gap-2 px-3.5 py-2 rounded-xl border border-[#D5D2C7] dark:border-[#3E3C34] bg-[#FFFFFF] dark:bg-[#22211C] hover:bg-[#F4F1E8] dark:hover:bg-[#2A2823] text-[#3A3A35] dark:text-[#EDEAE2] text-xs font-medium transition-all duration-200 shadow-2xs cursor-pointer active:scale-98 whitespace-nowrap"
          title="Open past reflections history panel"
          aria-label="Open past reflections history panel"
        >
          <History className="w-3.5 h-3.5 text-[#5A5A40] dark:text-[#D4D0C2]" />
          <span>Past Reflections</span>
          <span className="px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-[#EAE8E0] dark:bg-[#2E2C26] text-[#5A5A40] dark:text-[#D4D0C2]">
            {entries.length}
          </span>
        </button>
      </section>

      {/* Feature 1: Next-Day Micro-commitment Check-in Loop */}
      {pendingCommitmentEntry && pendingCommitmentEntry.nextDayCommitment && (
        <section
          id="next-day-commitment-checkin-banner"
          className="rounded-2xl border border-[#D5D2C7] dark:border-[#3E3C34] bg-[#F4F1E8] dark:bg-[#25241F] p-4 sm:p-5 shadow-xs transition-all duration-300 ease-in-out animate-in fade-in slide-in-from-top-2"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3.5">
            <div className="flex items-start gap-3 flex-1 min-w-0">
              <div className="w-8 h-8 rounded-xl bg-[#EAE8E0] dark:bg-[#32302A] text-[#5A5A40] dark:text-[#D4D0C2] flex items-center justify-center flex-shrink-0 mt-0.5 shadow-2xs">
                <Target className="w-4 h-4 text-emerald-700 dark:text-emerald-400" />
              </div>
              <div className="space-y-1 flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#5A5A40] dark:text-[#A6A498] font-sans">
                    Next-Day Check-in
                  </span>
                  <span className="text-[11px] text-[#858376] dark:text-[#8E8C7F]">
                    From reflection on {formatLocalDate(pendingCommitmentEntry.createdAtMillis)}
                  </span>
                </div>
                <p className="text-sm font-serif font-medium text-[#3A3A35] dark:text-[#EDEAE2] leading-snug">
                  Did you get that in? — <span className="italic font-normal text-[#5A5A40] dark:text-[#D4D0C2]">"{pendingCommitmentEntry.nextDayCommitment}"</span>
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 self-end sm:self-center flex-shrink-0">
              <button
                id="checkin-btn-yes"
                type="button"
                disabled={isRespondingCheckin}
                onClick={() => handleCheckinResponse('yes')}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-medium transition-all duration-200 cursor-pointer shadow-2xs active:scale-95 disabled:opacity-50"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Yes</span>
              </button>
              <button
                id="checkin-btn-not-yet"
                type="button"
                disabled={isRespondingCheckin}
                onClick={() => handleCheckinResponse('not_yet')}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[#FAF9F5] dark:bg-[#1D1C18] border border-[#D5D2C7] dark:border-[#3E3C34] hover:bg-[#EAE8E0] dark:hover:bg-[#2A2823] text-[#3A3A35] dark:text-[#EDEAE2] text-xs font-medium transition-all duration-200 cursor-pointer shadow-2xs active:scale-95 disabled:opacity-50"
              >
                <span>Not yet</span>
              </button>
              <button
                id="checkin-btn-skip"
                type="button"
                disabled={isRespondingCheckin}
                onClick={() => handleCheckinResponse('skip')}
                className="p-1.5 rounded-lg text-[#858376] hover:text-[#3A3A35] dark:text-[#8E8C7F] dark:hover:text-[#EDEAE2] hover:bg-[#EAE8E0] dark:hover:bg-[#2A2823] text-xs transition-colors duration-200 cursor-pointer"
                title="Dismiss check-in"
                aria-label="Dismiss check-in"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        </section>
      )}

      {/* Gentle, Dismissible Stress -> Stillness Suggestion Banner */}
      {stressSuggestion?.show && (
        <section
          id="stress-stillness-suggestion-banner"
          className="rounded-2xl border border-indigo-200/70 dark:border-indigo-900/60 bg-indigo-50/80 dark:bg-[#181A26] p-4 sm:p-4.5 shadow-2xs animate-in fade-in duration-300 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
        >
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 flex items-center justify-center flex-shrink-0">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <p className="text-xs sm:text-sm font-serif font-medium text-[#20201D] dark:text-[#EDEAE2]">
                Your reflection carried some heavy feelings. Want to take a quiet minute in Stillness?
              </p>
              <p className="text-[11px] text-[#636674] dark:text-[#9EA2B8]">
                A gentle, unhurried space to decompress and draw stars or untangle threads.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-center flex-shrink-0">
            <button
              type="button"
              onClick={() => {
                setStressSuggestion(null);
                if (onNavigateTab) onNavigateTab('stillness');
              }}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-indigo-700 hover:bg-indigo-800 text-white text-xs font-medium transition-all duration-200 cursor-pointer shadow-2xs active:scale-95"
            >
              <span>Visit Stillness</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setStressSuggestion(null)}
              className="p-1.5 rounded-lg text-[#858376] hover:text-[#3A3A35] dark:text-[#8E8C7F] dark:hover:text-[#EDEAE2] hover:bg-indigo-100/60 dark:hover:bg-indigo-950/60 transition-colors duration-200 cursor-pointer"
              title="Dismiss suggestion"
              aria-label="Dismiss suggestion"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </section>
      )}

      {/* 2. Active Journaling Workspace Card */}
      <section
        id="active-journaling-workspace"
        className="rounded-2xl border border-[#E6E4DD] dark:border-[#2E2C26] bg-[#FFFFFF] dark:bg-[#22211C] shadow-xs overflow-hidden flex flex-col transition-all"
      >
        {/* Workspace Sub-Header */}
        <div className="px-5 py-3.5 border-b border-[#E6E4DD] dark:border-[#2E2C26] flex items-center justify-between bg-[#FAF9F5] dark:bg-[#1D1C18] flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-emerald-600 dark:bg-emerald-400 animate-pulse" />
            <span className="text-xs font-semibold text-[#5A5A40] dark:text-[#D4D0C2] uppercase tracking-wider font-sans">
              Active Journal Session
            </span>
          </div>

          {messages.length > 0 && (
            <div className="flex items-center gap-2">
              {isDiscarding ? (
                <div className="flex items-center gap-1.5 text-xs bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900/60 px-2 py-1 rounded-lg text-rose-800 dark:text-rose-200 animate-in fade-in duration-150">
                  <span className="text-[11px]">Discard draft?</span>
                  <button
                    type="button"
                    onClick={handleDiscardDraft}
                    className="px-2 py-0.5 rounded bg-rose-600 hover:bg-rose-700 text-white font-medium text-[11px] cursor-pointer"
                  >
                    Yes
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsDiscarding(false)}
                    className="px-2 py-0.5 rounded bg-stone-200 dark:bg-stone-800 text-stone-700 dark:text-stone-300 font-medium text-[11px] hover:bg-stone-300 dark:hover:bg-stone-700 cursor-pointer"
                  >
                    No
                  </button>
                </div>
              ) : (
                <button
                  id="discard-draft-btn-header"
                  type="button"
                  onClick={() => setIsDiscarding(true)}
                  disabled={isSaving || isGenerating}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-[#757469] hover:text-rose-700 dark:text-[#A6A498] dark:hover:text-rose-400 hover:bg-[#F0EEE6] dark:hover:bg-[#2A2823] transition-colors cursor-pointer disabled:opacity-40"
                  title="Discard this draft session"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Discard</span>
                </button>
              )}

              <button
                id="end-save-session-btn-header"
                type="button"
                disabled={isSaving || isGenerating}
                onClick={handleEndAndSaveSession}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-[#4A4A38] hover:bg-[#38382A] text-[#F8F7F3] dark:bg-[#D4D0C2] dark:hover:bg-[#E2DFD6] dark:text-[#1A1916] transition-colors shadow-2xs cursor-pointer disabled:opacity-50"
              >
                {isSaving ? (
                  <div className="w-3.5 h-3.5 border-2 border-[#D5D2C7] border-t-[#F8F7F3] rounded-full animate-spin" />
                ) : (
                  <BookmarkCheck className="w-3.5 h-3.5" />
                )}
                <span>{isSaving ? 'Saving Entry...' : 'Save & End Session'}</span>
              </button>
            </div>
          )}
        </div>

        {/* Conversation Thread Area */}
        <div
          id="chat-thread-container"
          className={`${
            messages.length === 0
              ? 'min-h-0 sm:min-h-[160px] p-3 sm:p-6'
              : 'min-h-[180px] sm:min-h-[220px] p-4 sm:p-6'
          } max-h-[480px] overflow-y-auto space-y-3 sm:space-y-4 bg-[#FAF9F5]/40 dark:bg-[#1A1916]/40 scroll-smooth font-sans`}
        >
          {messages.length === 0 ? (
            <div className="py-2 sm:py-6 flex flex-col items-center justify-center text-center px-2">
              <div className="hidden sm:flex w-9 h-9 rounded-full bg-[#EAE8E0] dark:bg-[#282621] items-center justify-center text-[#5A5A40] dark:text-[#D4D0C2] mb-2.5 shadow-2xs">
                <Compass className="w-4 h-4" />
              </div>
              <p className="font-serif text-sm sm:text-base font-medium text-[#3A3A35] dark:text-[#EDEAE2]">
                Your quiet reflection begins here.
              </p>
            </div>
          ) : (
            messages.map((msg) => {
              const isUser = msg.role === 'user';
              return (
                <div
                  key={msg.id}
                  className={`flex gap-3 ${isUser ? 'justify-end' : 'justify-start'}`}
                >
                  {!isUser && (
                    <div className="w-7 h-7 rounded-full bg-[#4A4A38] dark:bg-[#D4D0C2] text-[#F8F7F3] dark:text-[#1A1916] flex items-center justify-center flex-shrink-0 text-xs shadow-2xs mt-0.5">
                      <Sparkles className="w-3.5 h-3.5" />
                    </div>
                  )}

                  <div
                    className={`max-w-[85%] sm:max-w-[75%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                      isUser
                        ? 'bg-[#4A4A38] text-[#F8F7F3] dark:bg-[#D4D0C2] dark:text-[#1A1916] rounded-tr-xs'
                        : 'bg-[#FFFFFF] dark:bg-[#282621] text-[#3A3A35] dark:text-[#EDEAE2] border border-[#E6E4DD] dark:border-[#38362F] rounded-tl-xs shadow-2xs'
                    }`}
                  >
                    <p className="whitespace-pre-wrap">{msg.text}</p>
                    <span
                      className={`block text-[10px] mt-1.5 ${
                        isUser
                          ? 'text-[#D5D2C7] dark:text-[#5A5A40] text-right'
                          : 'text-[#858376] dark:text-[#8E8C7F]'
                      }`}
                    >
                      {formatLocalTime(msg.timestamp)}
                    </span>
                  </div>

                  {isUser && (
                    <UserAvatar
                      user={user}
                      customAvatar={customAvatar}
                      size="sm"
                      className="mt-0.5 shrink-0"
                    />
                  )}
                </div>
              );
            })
          )}

          {/* Gemini Generating Indicator */}
          {isGenerating && (
            <div className="flex items-center gap-3">
              <div className="w-7 h-7 rounded-full bg-[#4A4A38] dark:bg-[#D4D0C2] text-[#F8F7F3] dark:text-[#1A1916] flex items-center justify-center flex-shrink-0 text-xs shadow-2xs">
                <Sparkles className="w-3.5 h-3.5 animate-spin" />
              </div>
              <div className="px-4 py-3 rounded-2xl bg-[#FFFFFF] dark:bg-[#282621] border border-[#E6E4DD] dark:border-[#38362F] rounded-tl-xs flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-[#757469] animate-bounce" />
                <span className="w-1.5 h-1.5 rounded-full bg-[#757469] animate-bounce [animation-delay:0.2s]" />
                <span className="w-1.5 h-1.5 rounded-full bg-[#757469] animate-bounce [animation-delay:0.4s]" />
                <span className="text-xs text-[#757469] dark:text-[#A6A498] ml-1.5 font-medium">
                  Reflect is listening & thinking...
                </span>
              </div>
            </div>
          )}

          <div ref={chatBottomRef} />
        </div>

        {/* Save Error Notice */}
        {saveError && (
          <div className="mx-5 mb-2 p-3 text-xs bg-rose-50 dark:bg-rose-950/40 text-rose-800 dark:text-rose-300 border border-rose-200 dark:border-rose-900/60 rounded-xl flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span className="flex-1">{saveError}</span>
            <button
              type="button"
              onClick={handleEndAndSaveSession}
              className="font-semibold underline hover:no-underline cursor-pointer"
            >
              Retry Save
            </button>
          </div>
        )}

        {/* 3. Ice-breaker Starter Prompts (Visible ONLY before conversation starts) */}
        {/* Starter Reflections (Collapsible with clear toggle, non-repeating shuffle, optional async AI) */}
        {messages.length === 0 && (
          <div
            id="ice-breaker-section"
            className="px-5 py-3.5 border-t border-[#E6E4DD] dark:border-[#2E2C26] bg-[#FAF9F5] dark:bg-[#1D1C18] animate-in fade-in duration-150 space-y-3"
          >
            <div className="flex items-center justify-between gap-2">
              {/* Expand / Collapse Header Toggle */}
              <button
                type="button"
                id="toggle-prompts-btn"
                onClick={togglePromptsExpanded}
                className="flex items-center gap-2 text-left group cursor-pointer select-none rounded-lg -ml-1.5 px-1.5 py-1 hover:bg-[#EAE8E0]/70 dark:hover:bg-[#282620] transition-colors"
                title={isPromptsExpanded ? 'Collapse prompt suggestions' : 'Expand prompt suggestions'}
              >
                {isPromptsExpanded ? (
                  <ChevronDown className="w-3.5 h-3.5 text-[#5A5A40] dark:text-[#D4D0C2] transition-transform" />
                ) : (
                  <ChevronRight className="w-3.5 h-3.5 text-[#858376] dark:text-[#8E8C7F] transition-transform" />
                )}
                <span className="text-[11px] font-semibold text-[#5A5A40] dark:text-[#A6A498] uppercase tracking-wider font-sans group-hover:text-[#3A3A35] dark:group-hover:text-[#EDEAE2] transition-colors">
                  Starter Reflections
                </span>
                {!isPromptsExpanded && (
                  <span className="text-[11px] text-[#858376] dark:text-[#8E8C7F] font-normal font-sans">
                    · {prompts.length} ideas available
                  </span>
                )}
              </button>

              {/* Shuffle Prompts (Visible when expanded) */}
              {isPromptsExpanded && (
                <button
                  id="shuffle-prompts-btn"
                  type="button"
                  onClick={shufflePrompts}
                  className="px-2.5 py-1 rounded-lg text-[#757469] hover:text-[#3A3A35] dark:text-[#A6A498] dark:hover:text-[#EDEAE2] hover:bg-[#EAE8E0] dark:hover:bg-[#2A2823] text-xs flex items-center gap-1.5 transition-colors cursor-pointer border border-transparent hover:border-[#D5D2C7] dark:hover:border-[#3E3C34]"
                  title="Shuffle for new non-repeating prompt suggestions"
                >
                  <RefreshCw className="w-3 h-3" />
                  <span>Shuffle</span>
                </button>
              )}
            </div>

            {/* Prompt Cards Grid (Rendered when expanded) */}
            {isPromptsExpanded && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-0.5 animate-in fade-in duration-200">
                {prompts.map((promptText, idx) => (
                  <button
                    key={idx}
                    id={`starter-prompt-${idx}`}
                    type="button"
                    onClick={() => handleSelectPrompt(promptText)}
                    className="text-left p-3.5 rounded-xl border border-[#D5D2C7] dark:border-[#3E3C34] bg-[#FFFFFF] dark:bg-[#252420] text-[#3A3A35] dark:text-[#EDEAE2] hover:border-[#5A5A40] dark:hover:border-[#D4D0C2] hover:bg-[#F4F1E8] dark:hover:bg-[#2E2C26] transition-all cursor-pointer shadow-2xs active:scale-[0.98] leading-relaxed"
                  >
                    <p className="font-serif text-[13px] leading-relaxed text-[#3A3A35] dark:text-[#EDEAE2]">
                      {promptText}
                    </p>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* 4. Chat Composer Area */}
        <div
          id="chat-composer-container"
          className="p-4 sm:p-5 border-t border-[#E6E4DD] dark:border-[#2E2C26] bg-[#FFFFFF] dark:bg-[#22211C] space-y-2.5"
        >
          {/* Active Audio Recording Bar, Transcribing State, Error, or Emotional Tags Card */}
          <AudioRecorderPanel
            recorder={audioRecorder}
            onTranscriptionComplete={handleAudioTranscription}
          />

          {/* Active Video Recording Studio Viewfinder, Analyzing State, or Video Breakdown Card */}
          <VideoRecorderStudio
            recorder={videoRecorder}
            onAnalysisComplete={handleVideoAnalysis}
            disabled={isGenerating || isSaving}
          />

          {/* Unobtrusive Location Indicator Pill when enabled in Settings */}
          {isLocationActive && currentLocation && (
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-[#F4F1E8] dark:bg-[#282620] border border-[#D5D2C7] dark:border-[#3E3C34] rounded-lg text-xs text-[#5A5A40] dark:text-[#D4D0C2] animate-in fade-in duration-150 w-fit max-w-full">
              <MapPin className="w-3 h-3 flex-shrink-0 text-[#5A5A40] dark:text-[#D4D0C2]" />
              <span className="text-[11px] font-medium truncate">
                {currentLocation.placeName}
              </span>
            </div>
          )}

          {isLocationActive && isLocating && !currentLocation && (
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-[#F4F1E8]/60 dark:bg-[#282620]/60 border border-[#D5D2C7] dark:border-[#3E3C34] rounded-lg text-xs text-[#757469] dark:text-[#A6A498] animate-in fade-in duration-150 w-fit">
              <Loader2 className="w-3 h-3 flex-shrink-0 animate-spin text-[#5A5A40] dark:text-[#D4D0C2]" />
              <span className="text-[11px] truncate">Acquiring current location...</span>
            </div>
          )}

          {/* Location Error Notice (if active) */}
          {locationError && isLocationActive && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 rounded-lg text-xs text-amber-800 dark:text-amber-200 animate-in fade-in duration-150">
              <AlertCircle className="w-3 h-3 flex-shrink-0 text-amber-600" />
              <span className="text-[11px] truncate flex-1">{locationError}</span>
              <button
                type="button"
                onClick={() => setLocationError(null)}
                className="p-0.5 hover:text-amber-950 rounded cursor-pointer"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          )}

          <div className="relative flex items-end gap-1.5 sm:gap-2 bg-[#FAF9F5] dark:bg-[#1D1C18] rounded-2xl border border-[#D5D2C7] dark:border-[#3E3C34] p-1.5 sm:p-2 focus-within:border-[#5A5A40] dark:focus-within:border-[#D4D0C2] transition-all duration-200">
            <textarea
              ref={textareaRef}
              id="journal-input-textarea"
              rows={1}
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={
                isMobileDevice
                  ? "What's on your mind?"
                  : "What feels important to write down right now? (Enter to send, Shift+Enter for new line)"
              }
              className="w-full resize-none overflow-hidden bg-transparent py-1.5 px-2 text-sm text-[#3A3A35] dark:text-[#EDEAE2] placeholder:text-[#858376] dark:placeholder:text-[#8E8C7F] focus:outline-none leading-normal min-h-[36px]"
            />

            {/* Desktop Action Controls */}
            <div className="hidden sm:flex items-center gap-1.5 flex-shrink-0 pb-1 pr-1">
              <AudioRecordButton
                recorder={audioRecorder}
                disabled={isGenerating || isSaving || videoRecorder.isRecording}
                size="md"
              />
              <VideoRecordButton
                recorder={videoRecorder}
                disabled={isGenerating || isSaving || audioRecorder.isRecording}
              />
              <button
                id="send-message-button"
                type="button"
                disabled={!inputText.trim() || isGenerating}
                onClick={handleSendMessage}
                className="p-2.5 rounded-xl bg-[#4A4A38] hover:bg-[#38382A] text-[#F8F7F3] dark:bg-[#D4D0C2] dark:hover:bg-[#E2DFD6] dark:text-[#1A1916] transition-all duration-200 cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed shadow-2xs active:scale-95"
                title="Send message"
                aria-label="Send message"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>

            {/* Mobile Compact Action Controls */}
            <div className="flex sm:hidden items-center gap-1 flex-shrink-0 pb-1 pr-0.5">
              {/* '+' menu button for secondary video/multimodal tools */}
              <button
                id="mobile-more-tools-button"
                type="button"
                onClick={() => setIsMoreMenuOpen((v) => !v)}
                className={`p-1.5 rounded-lg border transition-all duration-200 cursor-pointer shadow-2xs flex items-center justify-center ${
                  isMoreMenuOpen
                    ? 'bg-[#5A5A40] text-white border-[#5A5A40] dark:bg-[#D4D0C2] dark:text-[#1A1916]'
                    : 'bg-[#FFFFFF] dark:bg-[#282621] text-[#757469] dark:text-[#A6A498] border-[#D5D2C7] dark:border-[#3E3C34] hover:bg-[#F4F1E8] dark:hover:bg-[#2A2823]'
                }`}
                title="More reflection tools"
                aria-label="More reflection tools"
              >
                <Plus className={`w-3.5 h-3.5 transition-transform duration-200 ${isMoreMenuOpen ? 'rotate-45' : ''}`} />
              </button>

              {/* Mic / Voice Recording Button */}
              <AudioRecordButton
                recorder={audioRecorder}
                disabled={isGenerating || isSaving || videoRecorder.isRecording}
                size="sm"
              />

              {/* Send Button */}
              <button
                id="mobile-send-message-button"
                type="button"
                disabled={!inputText.trim() || isGenerating}
                onClick={handleSendMessage}
                className="p-1.5 rounded-lg bg-[#4A4A38] hover:bg-[#38382A] text-[#F8F7F3] dark:bg-[#D4D0C2] dark:hover:bg-[#E2DFD6] dark:text-[#1A1916] transition-all duration-200 cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed shadow-2xs active:scale-95"
                title="Send message"
                aria-label="Send message"
              >
                <Send className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Mobile Secondary Tools Expandable Bar */}
          {isMoreMenuOpen && (
            <div className="sm:hidden flex items-center justify-between gap-2 p-2 bg-[#FAF9F5] dark:bg-[#1D1C18] rounded-xl border border-[#D5D2C7] dark:border-[#3E3C34] animate-in fade-in slide-in-from-top-1 text-xs">
              <div className="flex items-center gap-2">
                <VideoRecordButton
                  recorder={videoRecorder}
                  disabled={isGenerating || isSaving || audioRecorder.isRecording}
                />
                <span className="text-xs text-[#5A5A40] dark:text-[#D4D0C2] font-medium">
                  Video Reflection Studio
                </span>
              </div>
              {isLocationActive && (
                <button
                  type="button"
                  onClick={fetchLocation}
                  disabled={isLocating}
                  className="px-2 py-1 text-[11px] text-[#757469] dark:text-[#A6A498] hover:text-[#3A3A35] dark:hover:text-[#EDEAE2] rounded flex items-center gap-1 cursor-pointer"
                  title="Refresh location"
                >
                  <MapPin className="w-3 h-3" />
                  <span>Refresh Loc</span>
                </button>
              )}
            </div>
          )}

          {/* Quick Actions Below Composer */}
          <div className="flex items-center justify-between mt-2.5 px-1 text-xs text-[#858376] dark:text-[#8E8C7F]">
            <span>
              {messages.length > 0
                ? `${messages.length} message${messages.length > 1 ? 's' : ''} in this active session`
                : 'Share as little or as much as you wish'}
            </span>
          </div>
        </div>
      </section>

      {/* 5. Collapsible Side Panel / Drawer for Past Reflections History */}
      <div
        id="history-drawer-overlay"
        className={`fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-xs transition-opacity duration-300 ease-in-out ${
          isHistoryOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        onClick={() => setIsHistoryOpen(false)}
      >
        {/* Drawer Container */}
        <aside
          id="history-drawer-panel"
          className={`w-full sm:w-[480px] h-full bg-[#FAF9F5] dark:bg-[#1E1D18] border-l border-[#E6E4DD] dark:border-[#2E2C26] shadow-2xl flex flex-col transform transition-transform duration-300 ease-in-out ${
            isHistoryOpen ? 'translate-x-0' : 'translate-x-full'
          } text-[#3A3A35] dark:text-[#EDEAE2]`}
          onClick={(e) => e.stopPropagation()}
          aria-label="Past reflections history panel"
        >
          {/* Drawer Header */}
          <div className="px-5 py-4 border-b border-[#E6E4DD] dark:border-[#2E2C26] flex items-center justify-between bg-[#F4F1E8] dark:bg-[#191814] flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-[#5A5A40] dark:text-[#D4D0C2]" />
              <h3 className="font-serif text-lg font-medium text-[#3A3A35] dark:text-[#EDEAE2]">
                Past Reflections
              </h3>
              <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-[#EAE8E0] dark:bg-[#2E2C26] text-[#5A5A40] dark:text-[#D4D0C2]">
                {entries.length}
              </span>
            </div>

            <div className="flex items-center gap-2">
              {/* Export to PDF Button: Supports export of selected reflections */}
              {entries.length > 0 && (
                <div className="flex items-center gap-1.5">
                  <button
                    id="history-export-pdf-btn"
                    type="button"
                    onClick={() => {
                      setPdfExportSelectedIds(
                        selectedHistoryEntryIds.size > 0
                          ? Array.from(selectedHistoryEntryIds)
                          : undefined
                      );
                      setIsPdfExportOpen(true);
                    }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-all cursor-pointer shadow-2xs ${
                      selectedHistoryEntryIds.size > 0
                        ? 'bg-[#5A5A40] text-white hover:bg-[#484833] dark:bg-[#D4D0C2] dark:text-[#1A1916] dark:hover:bg-[#EDEAE2]'
                        : 'border border-[#D5D2C7] dark:border-[#3E3C34] bg-[#FFFFFF] dark:bg-[#252420] text-[#3A3A35] dark:text-[#EDEAE2] hover:border-[#5A5A40] dark:hover:border-[#D4D0C2] hover:bg-[#F4F1E8] dark:hover:bg-[#2A2823]'
                    }`}
                    title="Export selected reflections into clean print-ready PDF format for physical archives"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    <span>
                      {selectedHistoryEntryIds.size > 0
                        ? `Export Selected (${selectedHistoryEntryIds.size}) to PDF`
                        : 'Export to PDF'}
                    </span>
                  </button>

                  {selectedHistoryEntryIds.size > 0 && (
                    <button
                      type="button"
                      onClick={() => setSelectedHistoryEntryIds(new Set())}
                      className="text-[11px] text-[#757469] hover:text-[#3A3A35] dark:text-[#A6A498] dark:hover:text-[#EDEAE2] underline cursor-pointer px-1"
                      title="Clear selection"
                    >
                      Clear
                    </button>
                  )}
                </div>
              )}

              {/* Sort Order Control */}
              {entries.length > 1 && (
                <div className="flex items-center bg-[#EAE8E0] dark:bg-[#2A2823] p-0.5 rounded-lg border border-[#D5D2C7] dark:border-[#3E3C34] text-xs">
                  <button
                    id="history-sort-newest-btn"
                    type="button"
                    onClick={() => setSortOrder('newest')}
                    className={`px-2 py-1 rounded-md text-[11px] font-medium transition-colors cursor-pointer ${
                      sortOrder === 'newest'
                        ? 'bg-[#FFFFFF] dark:bg-[#1A1916] text-[#3A3A35] dark:text-[#EDEAE2] shadow-2xs font-semibold'
                        : 'text-[#757469] dark:text-[#A6A498] hover:text-[#3A3A35] dark:hover:text-[#EDEAE2]'
                    }`}
                    title="Sort newest reflections first"
                  >
                    Newest first
                  </button>
                  <button
                    id="history-sort-oldest-btn"
                    type="button"
                    onClick={() => setSortOrder('oldest')}
                    className={`px-2 py-1 rounded-md text-[11px] font-medium transition-colors cursor-pointer ${
                      sortOrder === 'oldest'
                        ? 'bg-[#FFFFFF] dark:bg-[#1A1916] text-[#3A3A35] dark:text-[#EDEAE2] shadow-2xs font-semibold'
                        : 'text-[#757469] dark:text-[#A6A498] hover:text-[#3A3A35] dark:hover:text-[#EDEAE2]'
                    }`}
                    title="Sort oldest reflections first"
                  >
                    Oldest first
                  </button>
                </div>
              )}

              <button
                id="close-history-drawer-btn"
                type="button"
                onClick={() => setIsHistoryOpen(false)}
                className="p-1.5 rounded-lg text-[#858376] hover:text-[#3A3A35] dark:text-[#A6A498] dark:hover:text-[#EDEAE2] hover:bg-[#EAE8E0] dark:hover:bg-[#2A2823] transition-colors duration-200 cursor-pointer"
                title="Close past reflections"
                aria-label="Close past reflections"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Drawer Body / Scrollable Content */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 font-sans">
            {entries.length === 0 ? (
              <div
                id="empty-history-notice"
                className="p-8 rounded-2xl border border-dashed border-[#D5D2C7] dark:border-[#3E3C34] bg-[#FFFFFF] dark:bg-[#22211C] text-center my-8"
              >
                <MessageSquare className="w-8 h-8 mx-auto text-[#858376] dark:text-[#8E8C7F] mb-2.5 opacity-80" />
                <p className="font-serif text-base font-medium text-[#3A3A35] dark:text-[#EDEAE2] mb-1">
                  No saved entries yet
                </p>
                <p className="text-xs text-[#757469] dark:text-[#A6A498] max-w-xs mx-auto">
                  Whenever you complete a reflection and tap "Save & End Session", your entries with smart mood categories will be archived here.
                </p>
              </div>
            ) : (
              <div className="space-y-5" id="journal-history-list">
                {(sortOrder === 'newest'
                  ? (['Today', 'Yesterday', 'This Week', 'Earlier'] as DateGroupCategory[])
                  : (['Earlier', 'This Week', 'Yesterday', 'Today'] as DateGroupCategory[])
                ).map((groupTitle) => {
                  const rawGroupEntries = entries.filter(
                    (e) => categorizeDateGroup(e.createdAtMillis) === groupTitle
                  );
                  if (rawGroupEntries.length === 0) return null;

                  const groupEntries = [...rawGroupEntries].sort((a, b) =>
                    sortOrder === 'newest'
                      ? (b.createdAtMillis || 0) - (a.createdAtMillis || 0)
                      : (a.createdAtMillis || 0) - (b.createdAtMillis || 0)
                  );

                  return (
                    <div key={groupTitle} className="space-y-2.5">
                      {/* Date Group Header */}
                      <div className="sticky top-0 z-10 flex items-center justify-between px-3 py-1.5 bg-[#FAF9F5]/95 dark:bg-[#1E1D18]/95 backdrop-blur-xs border-y border-[#E6E4DD] dark:border-[#2E2C26] rounded-lg">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-[#5A5A40] dark:text-[#A6A498] font-sans">
                          {groupTitle}
                        </span>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#EAE8E0] dark:bg-[#2E2C26] text-[#5A5A40] dark:text-[#D4D0C2]">
                          {groupEntries.length} {groupEntries.length === 1 ? 'reflection' : 'reflections'}
                        </span>
                      </div>

                      {/* List of Entries in this Date Group */}
                      <div className="space-y-3">
                          {groupEntries.map((entry) => {
                            const isExpanded = expandedEntryId === entry.id;
                            const timeDisplay =
                              groupTitle === 'Today' || groupTitle === 'Yesterday'
                                ? formatLocalTime(entry.createdAtMillis)
                                : formatEntryDate(entry.createdAtMillis);

                            return (
                              <div
                                key={entry.id}
                                id={`journal-entry-card-${entry.id}`}
                                className="rounded-xl border border-[#E6E4DD] dark:border-[#2E2C26] bg-[#FFFFFF] dark:bg-[#22211C] transition-all duration-200 hover:border-[#5A5A40] dark:hover:border-[#423F36] shadow-2xs overflow-hidden"
                              >
                                {/* Entry Header / Summary Row: Time — Category Chip — One-line Summary */}
                                <div
                                  className="p-3.5 flex flex-col gap-2.5 cursor-pointer select-none"
                                  onClick={() =>
                                    setExpandedEntryId(isExpanded ? null : entry.id)
                                  }
                                >
                                  {/* Top Row: Time (small/muted) — Category Chip — Message count & Chevron */}
                                  <div className="flex items-center justify-between gap-2 flex-wrap">
                                    <div
                                      className="flex items-center gap-2 flex-wrap"
                                      onClick={(e) => e.stopPropagation()}
                                    >
                                      {/* Checkbox for PDF Export Selection */}
                                      <button
                                        id={`select-entry-${entry.id}`}
                                        type="button"
                                        onClick={(e) => toggleHistoryEntrySelection(entry.id, e)}
                                        className="p-1 -ml-1 text-[#858376] hover:text-[#5A5A40] dark:text-[#8E8C7F] dark:hover:text-[#D4D0C2] transition-colors cursor-pointer rounded"
                                        title={
                                          selectedHistoryEntryIds.has(entry.id)
                                            ? 'Deselect reflection from PDF export'
                                            : 'Select reflection for PDF export'
                                        }
                                        aria-label="Select entry for PDF export"
                                      >
                                        {selectedHistoryEntryIds.has(entry.id) ? (
                                          <CheckSquare className="w-4 h-4 text-[#5A5A40] dark:text-[#D4D0C2]" />
                                        ) : (
                                          <Square className="w-4 h-4 text-[#B8B5A7] dark:text-[#504D41]" />
                                        )}
                                      </button>

                                      {/* 1. Time (small/muted) */}
                                      <div className="flex items-center gap-1 text-xs text-[#757469] dark:text-[#A6A498] font-mono">
                                        <Clock className="w-3.5 h-3.5 text-[#858376] dark:text-[#8E8C7F]" />
                                        <span>{timeDisplay}</span>
                                      </div>

                                      {/* Geotag place badge if present */}
                                      {entry.location?.placeName && (
                                        <>
                                          <span className="text-[#D5D2C7] dark:text-[#3E3C34] text-xs select-none">·</span>
                                          <div
                                            className="flex items-center gap-1 text-xs text-[#5A5A40] dark:text-[#D4D0C2] max-w-[160px] truncate font-sans"
                                            title={`Written at ${entry.location.placeName}`}
                                          >
                                            <MapPin className="w-3 h-3 flex-shrink-0" />
                                            <span className="truncate">{entry.location.placeName}</span>
                                          </div>
                                        </>
                                      )}

                                      <span className="text-[#D5D2C7] dark:text-[#3E3C34] text-xs select-none">·</span>

                                      {/* 2. Category Chip */}
                                      <CategoryChip
                                        currentCategory={entry.userCategory || entry.aiCategory}
                                        aiCategory={entry.aiCategory}
                                        onSelectCategory={(newCat) =>
                                          handleCategoryOverride(entry.id, newCat)
                                        }
                                      />
                                    </div>

                                    {/* Right: Message count and Expand Chevron */}
                                    <div className="flex items-center gap-2">
                                      <span className="text-[11px] text-[#858376] dark:text-[#8E8C7F]">
                                        {entry.messages.length} {entry.messages.length === 1 ? 'msg' : 'msgs'}
                                      </span>
                                      <button
                                        id={`expand-entry-btn-${entry.id}`}
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setExpandedEntryId(isExpanded ? null : entry.id);
                                        }}
                                        className="p-1 text-[#858376] hover:text-[#3A3A35] dark:hover:text-[#EDEAE2] rounded-md hover:bg-[#EAE8E0] dark:hover:bg-[#2E2C26] transition-colors duration-200 cursor-pointer"
                                        title={isExpanded ? 'Collapse transcript' : 'Read full transcript'}
                                      >
                                        {isExpanded ? (
                                          <ChevronDown className="w-4 h-4" />
                                        ) : (
                                          <ChevronRight className="w-4 h-4" />
                                        )}
                                      </button>
                                    </div>
                                  </div>

                                  {/* 3. One-Line Summary */}
                                  <p className="font-serif text-sm font-medium text-[#3A3A35] dark:text-[#EDEAE2] leading-snug line-clamp-2">
                                    {entry.summary}
                                  </p>
                                </div>

                                {/* Expanded Read-Only Conversation Viewer */}
                                {isExpanded && (
                                  <div
                                    id={`expanded-content-${entry.id}`}
                                    className="border-t border-[#E6E4DD] dark:border-[#2E2C26] bg-[#FAF9F5] dark:bg-[#1A1916] p-4 space-y-3 animate-in fade-in duration-200 font-sans"
                                  >
                                    {deleteError && (
                                      <div className="p-2 rounded-lg bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900/60 text-[11px] text-rose-800 dark:text-rose-200">
                                        {deleteError}
                                      </div>
                                    )}

                                    <div className="flex items-center justify-between pb-2 border-b border-[#E6E4DD] dark:border-[#2E2C26] text-xs text-[#757469] dark:text-[#A6A498] flex-wrap gap-2">
                                      <span className="font-semibold uppercase tracking-wider text-[10px]">
                                        Full Transcript
                                      </span>

                                      <div className="flex items-center gap-3">
                                        {/* Export Single Reflection to PDF */}
                                        <button
                                          id={`export-single-pdf-btn-${entry.id}`}
                                          type="button"
                                          onClick={() => {
                                            setPdfExportSelectedIds([entry.id]);
                                            setIsPdfExportOpen(true);
                                          }}
                                          className="text-[#757469] hover:text-[#5A5A40] dark:text-[#A6A498] dark:hover:text-[#D4D0C2] flex items-center gap-1 transition-colors duration-200 cursor-pointer text-xs"
                                          title="Export this reflection to clean print-ready PDF"
                                        >
                                          <Printer className="w-3.5 h-3.5" />
                                          <span>Print / PDF</span>
                                        </button>

                                        {confirmDeleteId === entry.id ? (
                                          <div className="flex items-center gap-1.5 bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-900/80 px-2.5 py-1 rounded-lg text-rose-800 dark:text-rose-200 text-xs animate-in fade-in duration-150">
                                            <span className="text-[11px] font-medium">Delete this reflection?</span>
                                            <button
                                              id={`confirm-delete-btn-${entry.id}`}
                                              type="button"
                                              disabled={deletingId === entry.id}
                                              onClick={() => handleExecuteDeleteEntry(entry.id)}
                                              className="px-2 py-0.5 rounded bg-rose-600 hover:bg-rose-700 text-white font-medium text-[11px] cursor-pointer disabled:opacity-50 transition-colors"
                                            >
                                              {deletingId === entry.id ? 'Deleting...' : 'Delete'}
                                            </button>
                                            <button
                                              id={`cancel-delete-btn-${entry.id}`}
                                              type="button"
                                              onClick={() => setConfirmDeleteId(null)}
                                              className="px-2 py-0.5 rounded bg-stone-200 dark:bg-stone-800 text-stone-700 dark:text-stone-300 font-medium text-[11px] hover:bg-stone-300 dark:hover:bg-stone-700 cursor-pointer transition-colors"
                                            >
                                              Cancel
                                            </button>
                                          </div>
                                        ) : (
                                          <button
                                            id={`delete-entry-btn-${entry.id}`}
                                            type="button"
                                            disabled={deletingId === entry.id}
                                            onClick={() => {
                                              setDeleteError(null);
                                              setConfirmDeleteId(entry.id);
                                            }}
                                            className="text-[#858376] hover:text-rose-700 dark:hover:text-rose-400 flex items-center gap-1 transition-colors duration-200 cursor-pointer text-xs"
                                            title="Delete this entry"
                                          >
                                            <Trash2 className="w-3.5 h-3.5" />
                                            <span>Delete</span>
                                          </button>
                                        )}
                                      </div>
                                    </div>

                                    {/* Geotagged Location Details if present */}
                                    {entry.location && (
                                      <div className="mb-2 p-2.5 rounded-xl bg-[#FAF9F5] dark:bg-[#1E1D18] border border-[#E6E4DD] dark:border-[#38362F] flex items-center justify-between text-xs text-[#555249] dark:text-[#C5C2B6] gap-2">
                                        <div className="flex items-center gap-1.5 truncate">
                                          <MapPin className="w-3.5 h-3.5 text-[#5A5A40] dark:text-[#D4D0C2] flex-shrink-0" />
                                          <span className="font-semibold text-[11px] text-[#5A5A40] dark:text-[#D4D0C2]">Location:</span>
                                          <span className="truncate">{entry.location.placeName}</span>
                                        </div>
                                        {entry.location.latitude && entry.location.longitude && (
                                          <span className="text-[10px] text-[#858376] dark:text-[#8E8C7F] font-mono flex-shrink-0">
                                            {entry.location.latitude.toFixed(3)}°, {entry.location.longitude.toFixed(3)}°
                                          </span>
                                        )}
                                      </div>
                                    )}

                                    {/* Next-Day Micro-commitment Tag/Status if exists */}
                                    {entry.nextDayCommitment && (
                                      <div className="mb-3 p-2.5 rounded-xl bg-[#FAF9F5] dark:bg-[#1D1C18] border border-[#E6E4DD] dark:border-[#38362F] flex items-start gap-2 text-xs">
                                        <Target className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 mt-0.5 flex-shrink-0" />
                                        <div className="space-y-0.5 flex-1 min-w-0">
                                          <div className="flex items-center gap-1.5">
                                            <span className="font-semibold text-[10px] uppercase tracking-wider text-[#5A5A40] dark:text-[#A6A498]">
                                              Micro-commitment
                                            </span>
                                            {entry.commitmentCheckin ? (
                                              <span
                                                className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                                                  entry.commitmentCheckin.status === 'yes'
                                                    ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300'
                                                    : entry.commitmentCheckin.status === 'not_yet'
                                                    ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300'
                                                    : 'bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-400'
                                                }`}
                                              >
                                                {entry.commitmentCheckin.status === 'yes'
                                                  ? 'Completed'
                                                  : entry.commitmentCheckin.status === 'not_yet'
                                                  ? 'Not yet'
                                                  : 'Skipped'}
                                              </span>
                                            ) : (
                                              <span className="text-[10px] px-1.5 py-0.5 rounded font-medium bg-stone-100 dark:bg-stone-800 text-stone-500 dark:text-stone-400">
                                                Pending check-in
                                              </span>
                                            )}
                                          </div>
                                          <p className="font-serif italic text-xs text-[#3A3A35] dark:text-[#EDEAE2]">
                                            "{entry.nextDayCommitment}"
                                          </p>
                                        </div>
                                      </div>
                                    )}

                                    <div className="space-y-2.5 max-h-80 overflow-y-auto pr-1">
                                      {entry.messages.map((m, mIdx) => {
                                        const isUser = m.role === 'user';
                                        return (
                                          <div
                                            key={m.id || mIdx}
                                            className={`flex gap-2 ${
                                              isUser ? 'justify-end' : 'justify-start'
                                            }`}
                                          >
                                            {!isUser && (
                                              <div className="w-5 h-5 rounded-full bg-[#4A4A38] dark:bg-[#D4D0C2] text-[#F8F7F3] dark:text-[#1A1916] flex items-center justify-center flex-shrink-0 text-[10px] mt-0.5">
                                                <Sparkles className="w-2.5 h-2.5" />
                                              </div>
                                            )}
                                            <div
                                              className={`max-w-[85%] rounded-xl px-3 py-2 text-xs leading-relaxed ${
                                                isUser
                                                  ? 'bg-[#4A4A38] text-[#F8F7F3] dark:bg-[#D4D0C2] dark:text-[#1A1916]'
                                                  : 'bg-[#FFFFFF] dark:bg-[#252420] text-[#3A3A35] dark:text-[#EDEAE2] border border-[#E6E4DD] dark:border-[#38362F] shadow-2xs'
                                              }`}
                                            >
                                              <p className="whitespace-pre-wrap">{m.text}</p>
                                              <span className="block text-[9px] text-[#858376] dark:text-[#8E8C7F] mt-1 opacity-80">
                                                {formatLocalTime(m.timestamp)}
                                              </span>
                                            </div>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
              </div>
            )}
          </div>
        </aside>
      </div>

      {/* 6. Clean Minimalist Print-Ready PDF Export Modal */}
      <PdfExportModal
        isOpen={isPdfExportOpen}
        onClose={() => {
          setIsPdfExportOpen(false);
          setPdfExportSelectedIds(undefined);
        }}
        entries={entries}
        user={user}
        userDisplayName={user?.displayName || 'Friend'}
        initialSelectedIds={pdfExportSelectedIds}
      />
    </div>
  );
};
