import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { UserProfile, JournalMessage, JournalCategory, JournalLocation, STARTER_PROMPTS_POOL } from '../types';
import { saveJournalEntry } from '../lib/firebase';

interface ReflectionContextType {
  messages: JournalMessage[];
  inputText: string;
  isGenerating: boolean;
  isSaving: boolean;
  saveError: string | null;
  isHistoryOpen: boolean;
  expandedEntryId: string | null;
  setInputText: React.Dispatch<React.SetStateAction<string>>;
  setMessages: React.Dispatch<React.SetStateAction<JournalMessage[]>>;
  setIsHistoryOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setExpandedEntryId: React.Dispatch<React.SetStateAction<string | null>>;
  handleSendMessage: (customText?: string) => Promise<void>;
  handleEndAndSaveSession: (
    streak: number,
    onSuccess?: (category?: JournalCategory) => void,
    location?: JournalLocation | null
  ) => Promise<boolean>;
  handleDiscardDraft: () => void;
  clearSaveError: () => void;
}

const ReflectionContext = createContext<ReflectionContextType | undefined>(undefined);

interface ReflectionProviderProps {
  user: UserProfile;
  dailyCheckinsEnabled?: boolean;
  children: React.ReactNode;
}

export const ReflectionProvider: React.FC<ReflectionProviderProps> = ({
  user,
  dailyCheckinsEnabled = true,
  children,
}) => {
  const DRAFT_STORAGE_KEY = `reflect_draft_${user.uid}`;

  // Active chat messages
  const [messages, setMessages] = useState<JournalMessage[]>(() => {
    try {
      const saved = sessionStorage.getItem(`reflect_draft_${user.uid}`);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed.messages)) {
          return parsed.messages;
        }
      }
    } catch (e) {
      console.warn('Could not read draft from sessionStorage', e);
    }
    return [];
  });

  // Active input text
  const [inputText, setInputText] = useState<string>(() => {
    try {
      const saved = sessionStorage.getItem(`reflect_draft_${user.uid}`);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (typeof parsed.inputText === 'string') {
          return parsed.inputText;
        }
      }
    } catch (e) {
      console.warn('Could not read draft input from sessionStorage', e);
    }
    return '';
  });

  // Background in-flight states
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // History panel state
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [expandedEntryId, setExpandedEntryId] = useState<string | null>(null);

  // Sync draft to sessionStorage on state updates
  useEffect(() => {
    try {
      if (messages.length > 0 || inputText.trim().length > 0) {
        sessionStorage.setItem(
          DRAFT_STORAGE_KEY,
          JSON.stringify({
            messages,
            inputText,
            lastUpdated: Date.now(),
          })
        );
      } else {
        sessionStorage.removeItem(DRAFT_STORAGE_KEY);
      }
    } catch (e) {
      console.warn('Failed to sync draft to sessionStorage:', e);
    }
  }, [messages, inputText, DRAFT_STORAGE_KEY]);

  const clearSaveError = () => setSaveError(null);

  // Send message to Gemini (runs in background across all tab views)
  const handleSendMessage = async (customText?: string) => {
    const textToSend = typeof customText === 'string' ? customText : inputText;
    const trimmed = textToSend.trim();
    if (!trimmed || isGenerating) return;

    const userMessage: JournalMessage = {
      id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      role: 'user',
      text: trimmed,
      timestamp: Date.now(),
    };

    const nextMessages = [...messages, userMessage];
    setMessages(nextMessages);
    setInputText('');
    setIsGenerating(true);
    setSaveError(null);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: nextMessages.map((m) => ({
            role: m.role,
            text: m.text,
          })),
        }),
      });

      if (!response.ok) {
        const errJson = await response.json().catch(() => ({}));
        throw new Error(errJson.error || `Server error: ${response.status}`);
      }

      const data = await response.json();
      const geminiMessage: JournalMessage = {
        id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
        role: 'model',
        text: data.reply || 'I am here with you. What else comes to mind?',
        timestamp: Date.now(),
      };

      setMessages((prev) => [...prev, geminiMessage]);
    } catch (err: any) {
      console.error('Failed to get Gemini response:', err);
      const fallbackErrorMsg: JournalMessage = {
        id: `msg-err-${Date.now()}`,
        role: 'model',
        text: "I'm listening, but had a slight hiccup connecting. Please feel free to continue reflecting, or save your thoughts whenever you're ready.",
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, fallbackErrorMsg]);
    } finally {
      setIsGenerating(false);
    }
  };

  // End and save session to Firestore
  const handleEndAndSaveSession = async (
    streak: number,
    onSuccess?: (category?: JournalCategory) => void,
    location?: JournalLocation | null
  ): Promise<boolean> => {
    if (messages.length === 0 || isSaving) return false;

    setIsSaving(true);
    setSaveError(null);

    try {
      // 1. Send conversation to Gemini for auto-summary, categorization & (if enabled) next-day micro-commitment
      let summary = 'Mindful journaling session';
      let aiCategory: JournalCategory = 'Reflection';
      let nextDayCommitment: string | null = null;

      try {
        const sumResponse = await fetch('/api/session/summarize', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messages: messages.map((m) => ({ role: m.role, text: m.text })),
            extractCommitment: dailyCheckinsEnabled,
          }),
        });

        if (sumResponse.ok) {
          const sumData = await sumResponse.json();
          if (sumData.summary) summary = sumData.summary;
          if (sumData.category) aiCategory = sumData.category;
          if (dailyCheckinsEnabled && sumData.nextDayCommitment) {
            nextDayCommitment = sumData.nextDayCommitment;
          }
        }
      } catch (sumErr) {
        console.warn('Summarization fallback triggered:', sumErr);
      }

      // 2. Persist to Firestore under users/{uid}/entries
      await saveJournalEntry(user.uid, {
        messages,
        summary,
        aiCategory,
        userCategory: aiCategory,
        streakCount: streak + 1,
        nextDayCommitment: dailyCheckinsEnabled ? (nextDayCommitment || null) : null,
        location: location || null,
      });

      // 3. Clear current conversation buffer, delete saved session storage
      setMessages([]);
      setInputText('');
      try {
        sessionStorage.removeItem(DRAFT_STORAGE_KEY);
      } catch (e) {
        console.warn('Could not clear sessionStorage draft', e);
      }

      if (onSuccess) onSuccess(aiCategory);
      return true;
    } catch (err: any) {
      console.error('Failed to save journal session:', err);
      setSaveError(
        'Failed to save your session to Firestore. Your thoughts are preserved. Please try saving again.'
      );
      return false;
    } finally {
      setIsSaving(false);
    }
  };

  // Discard draft completely
  const handleDiscardDraft = () => {
    setMessages([]);
    setInputText('');
    try {
      sessionStorage.removeItem(DRAFT_STORAGE_KEY);
    } catch (e) {
      console.warn('Could not clear sessionStorage draft', e);
    }
  };

  return (
    <ReflectionContext.Provider
      value={{
        messages,
        inputText,
        isGenerating,
        isSaving,
        saveError,
        isHistoryOpen,
        expandedEntryId,
        setInputText,
        setMessages,
        setIsHistoryOpen,
        setExpandedEntryId,
        handleSendMessage,
        handleEndAndSaveSession,
        handleDiscardDraft,
        clearSaveError,
      }}
    >
      {children}
    </ReflectionContext.Provider>
  );
};

export const useReflection = () => {
  const context = useContext(ReflectionContext);
  if (!context) {
    throw new Error('useReflection must be used within a ReflectionProvider');
  }
  return context;
};
