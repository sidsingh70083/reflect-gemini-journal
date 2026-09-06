export type JournalCategory =
  | 'Gratitude'
  | 'Stress'
  | 'Reflection'
  | 'Excitement'
  | 'Problem-Solving'
  | 'Sadness'
  | 'Neutral';

export const JOURNAL_CATEGORIES: JournalCategory[] = [
  'Gratitude',
  'Stress',
  'Reflection',
  'Excitement',
  'Problem-Solving',
  'Sadness',
  'Neutral',
];

export interface CategoryMeta {
  name: JournalCategory;
  color: string;
  bgLight: string;
  bgDark: string;
  textLight: string;
  textDark: string;
  borderLight: string;
  borderDark: string;
  description: string;
}

export const CATEGORY_CONFIG: Record<JournalCategory, CategoryMeta> = {
  Gratitude: {
    name: 'Gratitude',
    color: '#059669',
    bgLight: 'bg-emerald-50',
    bgDark: 'dark:bg-emerald-950/40',
    textLight: 'text-emerald-700',
    textDark: 'dark:text-emerald-300',
    borderLight: 'border-emerald-200',
    borderDark: 'dark:border-emerald-800/60',
    description: 'Appreciation, thankfulness, and contentment',
  },
  Stress: {
    name: 'Stress',
    color: '#d97706',
    bgLight: 'bg-amber-50',
    bgDark: 'dark:bg-amber-950/40',
    textLight: 'text-amber-700',
    textDark: 'dark:text-amber-300',
    borderLight: 'border-amber-200',
    borderDark: 'dark:border-amber-800/60',
    description: 'Pressure, overwhelm, and tension',
  },
  Reflection: {
    name: 'Reflection',
    color: '#2563eb',
    bgLight: 'bg-sky-50',
    bgDark: 'dark:bg-sky-950/40',
    textLight: 'text-sky-700',
    textDark: 'dark:text-sky-300',
    borderLight: 'border-sky-200',
    borderDark: 'dark:border-sky-800/60',
    description: 'Introspection, understanding, and self-discovery',
  },
  Excitement: {
    name: 'Excitement',
    color: '#7c3aed',
    bgLight: 'bg-violet-50',
    bgDark: 'dark:bg-violet-950/40',
    textLight: 'text-violet-700',
    textDark: 'dark:text-violet-300',
    borderLight: 'border-violet-200',
    borderDark: 'dark:border-violet-800/60',
    description: 'Enthusiasm, joy, anticipation, and high energy',
  },
  'Problem-Solving': {
    name: 'Problem-Solving',
    color: '#0284c7',
    bgLight: 'bg-teal-50',
    bgDark: 'dark:bg-teal-950/40',
    textLight: 'text-teal-700',
    textDark: 'dark:text-teal-300',
    borderLight: 'border-teal-200',
    borderDark: 'dark:border-teal-800/60',
    description: 'Decision-making, planning, and untangling challenges',
  },
  Sadness: {
    name: 'Sadness',
    color: '#4f46e5',
    bgLight: 'bg-indigo-50',
    bgDark: 'dark:bg-indigo-950/40',
    textLight: 'text-indigo-700',
    textDark: 'dark:text-indigo-300',
    borderLight: 'border-indigo-200',
    borderDark: 'dark:border-indigo-800/60',
    description: 'Grief, vulnerability, melancholy, or heavy emotions',
  },
  Neutral: {
    name: 'Neutral',
    color: '#4b5563',
    bgLight: 'bg-stone-100',
    bgDark: 'dark:bg-stone-800/60',
    textLight: 'text-stone-700',
    textDark: 'dark:text-stone-300',
    borderLight: 'border-stone-200',
    borderDark: 'dark:border-stone-700',
    description: 'General observations, daily logs, and balanced thoughts',
  },
};

export interface JournalMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  timestamp: number;
}

export interface CommitmentCheckin {
  status: 'yes' | 'not_yet' | 'skip';
  respondedAt: number;
}

export interface JournalLocation {
  latitude: number;
  longitude: number;
  city?: string;
  region?: string;
  country?: string;
  placeName?: string;
}

export interface JournalEntry {
  id: string;
  createdAt: any; // Firestore Timestamp or number
  createdAtMillis?: number;
  messages: JournalMessage[];
  summary: string;
  aiCategory: JournalCategory;
  userCategory: JournalCategory;
  streakCount?: number;
  nextDayCommitment?: string | null;
  commitmentCheckin?: CommitmentCheckin | null;
  location?: JournalLocation | null;
}

export interface UserProfile {
  uid: string;
  displayName: string | null;
  email: string | null;
  photoURL: string | null;
}

export interface LetterToFuture {
  id: string;
  createdAt: any;
  createdAtMillis: number;
  scheduledDate: string; // YYYY-MM-DD
  scheduledMillis: number;
  content: string;
  unlocked: boolean;
  unlockedAtMillis?: number;
  reflectionPrompt?: string | null;
}

export interface WeeklyDigest {
  id: string;
  createdAt: any;
  createdAtMillis: number;
  dateRange: {
    startDate: string;
    endDate: string;
    startMillis: number;
    endMillis: number;
  };
  entryCount: number;
  title: string;
  themes: string[];
  moodShift: string;
  categoryBreakdown: Partial<Record<JournalCategory, number>>;
  observations: string[];
  encouragement: string;
}

export interface DraftSession {
  messages: JournalMessage[];
  inputText: string;
  lastUpdated: number;
}

export interface AudioTranscriptionResult {
  transcription: string;
  emotionalTags: string[];
  dominantCategory: JournalCategory;
  emotionalSummary: string;
  modelUsed?: string;
}

export interface VideoAnalysisResult {
  transcription: string;
  dominantCategory: JournalCategory;
  emotionalTags: string[];
  visualMoodAnalysis: string;
  overallSentiment: string;
  emotionalSummary: string;
  suggestedCommitment?: string | null;
  videoThumbnail?: string | null;
  modelUsed?: string;
}

export const STARTER_PROMPTS_POOL: string[] = [
  "What's on your mind today?",
  "Something that went well recently...",
  "What's been hard lately?",
  "A moment of stillness I noticed today...",
  "Something I'm quietly grateful for...",
  "A decision I've been wrestling with...",
  "How does my mind and body feel right now?",
  "One thing I wish I could tell someone today...",
  "What drained my energy today, and what restored it?",
  "A boundary I held or wish I had protected...",
  "What is something I want to give myself permission to feel?",
  "Where did I find unexpected beauty or peace today?",
];

export const SUPPORTIVE_GREETINGS: string[] = [
  "Take a slow breath. This is your quiet space to reflect without judgment.",
  "Every thought and feeling is welcome here. Take all the time you need.",
  "Here to help you untangle your thoughts and find calm clarity.",
  "A few moments with yourself can change the rhythm of your day.",
  "Whatever you are carrying today, let's explore it gently together.",
  "Your words don't need to be polished. Just start wherever feels right.",
];
