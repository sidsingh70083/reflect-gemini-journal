import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut as fbSignOut,
  onAuthStateChanged,
  User,
} from 'firebase/auth';
import {
  getFirestore,
  collection,
  doc,
  addDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  orderBy,
  onSnapshot,
  serverTimestamp,
  Timestamp,
  DocumentData,
  QuerySnapshot,
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';
import {
  JournalCategory,
  JournalEntry,
  JournalMessage,
  WeeklyDigest,
  LetterToFuture,
  CommitmentCheckin,
  JournalLocation,
  UserSettings,
  DEFAULT_USER_SETTINGS,
} from '../types';
import { getLocalDateKey, parseDocTimestamp } from './dateUtils';

// Initialize Firebase App
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

// Auth Instance
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

// Firestore Instance (supporting custom database ID if present)
export const db = firebaseConfig.firestoreDatabaseId
  ? getFirestore(app, firebaseConfig.firestoreDatabaseId)
  : getFirestore(app);

// Authentication Helpers
export async function signInWithGoogle(): Promise<User> {
  const result = await signInWithPopup(auth, googleProvider);
  return result.user;
}

export async function logOut(): Promise<void> {
  await fbSignOut(auth);
}

export function subscribeToAuth(callback: (user: User | null) => void) {
  return onAuthStateChanged(auth, callback);
}

// Utility: Strip undefined values to prevent Firestore crashes
function sanitizePayload<T extends Record<string, any>>(obj: T): T {
  return JSON.parse(
    JSON.stringify(obj, (key, value) => (value === undefined ? null : value))
  );
}

// Subscribe to User Journal Entries (Real-time)
export function subscribeToUserEntries(
  userId: string,
  onUpdate: (entries: JournalEntry[]) => void,
  onError?: (error: Error) => void
) {
  const entriesRef = collection(db, 'users', userId, 'entries');
  const q = query(entriesRef, orderBy('createdAt', 'desc'));

  return onSnapshot(
    q,
    (snapshot: QuerySnapshot<DocumentData>) => {
      const entries: JournalEntry[] = snapshot.docs.map((docSnap) => {
        const data = docSnap.data();
        const createdAtMillis = parseDocTimestamp(data);

        return {
          id: docSnap.id,
          createdAt: data.createdAt,
          createdAtMillis,
          messages: Array.isArray(data.messages) ? data.messages : [],
          summary: data.summary || 'Mindful Reflection',
          aiCategory: data.aiCategory || 'Reflection',
          userCategory: data.userCategory || data.aiCategory || 'Reflection',
          streakCount: data.streakCount || 1,
          nextDayCommitment: data.nextDayCommitment || null,
          commitmentCheckin: data.commitmentCheckin || null,
          location: data.location || null,
        };
      });

      onUpdate(entries);
    },
    (err) => {
      console.error('Firestore entries subscription error:', err);
      if (onError) onError(err);
    }
  );
}

// Save a new journal session entry
export async function saveJournalEntry(
  userId: string,
  data: {
    messages: JournalMessage[];
    summary: string;
    aiCategory: JournalCategory;
    userCategory?: JournalCategory;
    streakCount?: number;
    nextDayCommitment?: string | null;
    location?: JournalLocation | null;
  }
): Promise<string> {
  const entriesRef = collection(db, 'users', userId, 'entries');
  const now = Date.now();
  const payload = sanitizePayload({
    messages: data.messages,
    summary: data.summary,
    aiCategory: data.aiCategory,
    userCategory: data.userCategory || data.aiCategory,
    createdAt: serverTimestamp(),
    createdAtMillis: now,
    streakCount: data.streakCount || 1,
    nextDayCommitment: data.nextDayCommitment || null,
    commitmentCheckin: null,
    location: data.location || null,
  });

  const docRef = await addDoc(entriesRef, payload);
  return docRef.id;
}

// Update commitment check-in status on an entry
export async function updateJournalEntryCheckin(
  userId: string,
  entryId: string,
  checkin: CommitmentCheckin
): Promise<void> {
  const docRef = doc(db, 'users', userId, 'entries', entryId);
  await updateDoc(docRef, {
    commitmentCheckin: sanitizePayload(checkin),
  });
}

// Update category override
export async function updateEntryCategory(
  userId: string,
  entryId: string,
  newCategory: JournalCategory
): Promise<void> {
  const docRef = doc(db, 'users', userId, 'entries', entryId);
  await updateDoc(docRef, {
    userCategory: newCategory,
  });
}

// Delete an entry
export async function deleteJournalEntry(userId: string, entryId: string): Promise<void> {
  const docRef = doc(db, 'users', userId, 'entries', entryId);
  await deleteDoc(docRef);
}

// Subscribe to User Weekly Digests (Real-time)
export function subscribeToUserDigests(
  userId: string,
  onUpdate: (digests: WeeklyDigest[]) => void,
  onError?: (error: Error) => void
) {
  const digestsRef = collection(db, 'users', userId, 'digests');
  const q = query(digestsRef, orderBy('createdAt', 'desc'));

  return onSnapshot(
    q,
    (snapshot: QuerySnapshot<DocumentData>) => {
      const digests: WeeklyDigest[] = snapshot.docs.map((docSnap) => {
        const data = docSnap.data();
        const createdAtMillis = parseDocTimestamp(data);

        return {
          id: docSnap.id,
          createdAt: data.createdAt,
          createdAtMillis,
          dateRange: data.dateRange || {
            startDate: '',
            endDate: '',
            startMillis: 0,
            endMillis: Date.now(),
          },
          entryCount: data.entryCount || 0,
          title: data.title || 'Weekly Retrospective',
          themes: Array.isArray(data.themes) ? data.themes : [],
          moodShift: data.moodShift || '',
          categoryBreakdown: data.categoryBreakdown || {},
          observations: Array.isArray(data.observations) ? data.observations : [],
          encouragement: data.encouragement || '',
        };
      });

      onUpdate(digests);
    },
    (err) => {
      console.error('Firestore digests subscription error:', err);
      if (onError) onError(err);
    }
  );
}

// Save a new weekly digest
export async function saveWeeklyDigest(
  userId: string,
  digest: Omit<WeeklyDigest, 'id' | 'createdAt'>
): Promise<string> {
  const digestsRef = collection(db, 'users', userId, 'digests');
  const now = Date.now();
  const payload = sanitizePayload({
    ...digest,
    createdAt: serverTimestamp(),
    createdAtMillis: now,
  });

  const docRef = await addDoc(digestsRef, payload);
  return docRef.id;
}

// Delete a digest
export async function deleteWeeklyDigest(userId: string, digestId: string): Promise<void> {
  const docRef = doc(db, 'users', userId, 'digests', digestId);
  await deleteDoc(docRef);
}

// Subscribe to User Letters to Future Self (Real-time)
export function subscribeToUserLetters(
  userId: string,
  onUpdate: (letters: LetterToFuture[]) => void,
  onError?: (error: Error) => void
) {
  const lettersRef = collection(db, 'users', userId, 'letters');
  const q = query(lettersRef, orderBy('scheduledMillis', 'asc'));

  return onSnapshot(
    q,
    (snapshot: QuerySnapshot<DocumentData>) => {
      const letters: LetterToFuture[] = snapshot.docs.map((docSnap) => {
        const data = docSnap.data();
        const createdAtMillis = parseDocTimestamp(data);

        return {
          id: docSnap.id,
          createdAt: data.createdAt,
          createdAtMillis,
          scheduledDate: data.scheduledDate || '',
          scheduledMillis: typeof data.scheduledMillis === 'number' ? data.scheduledMillis : Date.now(),
          content: data.content || '',
          unlocked: !!data.unlocked,
          unlockedAtMillis: data.unlockedAtMillis,
          reflectionPrompt: data.reflectionPrompt || null,
        };
      });

      onUpdate(letters);
    },
    (err) => {
      console.error('Firestore letters subscription error:', err);
      if (onError) onError(err);
    }
  );
}

// Save a new letter to future self
export async function saveLetterToFuture(
  userId: string,
  letter: {
    scheduledDate: string;
    scheduledMillis: number;
    content: string;
  }
): Promise<string> {
  const lettersRef = collection(db, 'users', userId, 'letters');
  const now = Date.now();
  const payload = sanitizePayload({
    content: letter.content,
    scheduledDate: letter.scheduledDate,
    scheduledMillis: letter.scheduledMillis,
    unlocked: false,
    createdAt: serverTimestamp(),
    createdAtMillis: now,
  });

  const docRef = await addDoc(lettersRef, payload);
  return docRef.id;
}

// Unlock a letter
export async function unlockLetter(
  userId: string,
  letterId: string,
  reflectionPrompt?: string | null
): Promise<void> {
  const docRef = doc(db, 'users', userId, 'letters', letterId);
  await updateDoc(docRef, {
    unlocked: true,
    unlockedAtMillis: Date.now(),
    reflectionPrompt: reflectionPrompt || null,
  });
}

// Delete a letter
export async function deleteLetter(userId: string, letterId: string): Promise<void> {
  const docRef = doc(db, 'users', userId, 'letters', letterId);
  await deleteDoc(docRef);
}

// Calculate streak: consecutive calendar days with at least one journal entry in local timezone
export function calculateStreak(entries: JournalEntry[]): number {
  if (!entries || entries.length === 0) return 0;

  // Extract unique sorted dates formatted as local YYYY-MM-DD
  const dateSet = new Set<string>();
  entries.forEach((e) => {
    const millis = e.createdAtMillis || (e.createdAt?.toMillis ? e.createdAt.toMillis() : Date.now());
    const localDateStr = getLocalDateKey(millis);
    dateSet.add(localDateStr);
  });

  const sortedDates = Array.from(dateSet).sort().reverse();
  if (sortedDates.length === 0) return 0;

  const now = new Date();
  const todayStr = getLocalDateKey(now);

  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = getLocalDateKey(yesterday);

  // Most recent entry must be today or yesterday (in user's local timezone) to have an active streak
  const mostRecent = sortedDates[0];
  if (mostRecent !== todayStr && mostRecent !== yesterdayStr) {
    return 0;
  }

  let streak = 0;
  // Parse year, month, day of most recent date
  const [y, m, d] = mostRecent.split('-').map((v) => parseInt(v, 10));
  let checkDate = new Date(y, m - 1, d);

  for (const dateStr of sortedDates) {
    const expectedStr = getLocalDateKey(checkDate);
    if (dateStr === expectedStr) {
      streak += 1;
      checkDate.setDate(checkDate.getDate() - 1);
    } else {
      break;
    }
  }

  return streak;
}

// Subscribe to User Settings in Firestore under users/{userId}/settings/preferences
export function subscribeToUserSettings(
  userId: string,
  onUpdate: (settings: UserSettings) => void,
  onError?: (err: any) => void
) {
  const settingsDocRef = doc(db, 'users', userId, 'settings', 'preferences');

  return onSnapshot(
    settingsDocRef,
    (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        const settings: UserSettings = {
          theme: data.theme === 'dark' ? 'dark' : 'light',
          ambientSoundEnabled:
            typeof data.ambientSoundEnabled === 'boolean'
              ? data.ambientSoundEnabled
              : DEFAULT_USER_SETTINGS.ambientSoundEnabled,
          ambientSoundTexture:
            data.ambientSoundTexture &&
            ['soft-wash', 'airy', 'warm-drone', 'rain'].includes(data.ambientSoundTexture)
              ? data.ambientSoundTexture
              : DEFAULT_USER_SETTINGS.ambientSoundTexture,
          ambientSoundVolume:
            typeof data.ambientSoundVolume === 'number'
              ? data.ambientSoundVolume
              : DEFAULT_USER_SETTINGS.ambientSoundVolume,
          dailyCheckinsEnabled:
            typeof data.dailyCheckinsEnabled === 'boolean'
              ? data.dailyCheckinsEnabled
              : DEFAULT_USER_SETTINGS.dailyCheckinsEnabled,
          interactionSoundsEnabled:
            typeof data.interactionSoundsEnabled === 'boolean'
              ? data.interactionSoundsEnabled
              : DEFAULT_USER_SETTINGS.interactionSoundsEnabled,
          locationEnabled:
            typeof data.locationEnabled === 'boolean'
              ? data.locationEnabled
              : DEFAULT_USER_SETTINGS.locationEnabled,
          customAvatar: data.customAvatar || DEFAULT_USER_SETTINGS.customAvatar,
          updatedAt: data.updatedAt || Date.now(),
        };
        onUpdate(settings);
      } else {
        // Doc doesn't exist yet, return default settings
        onUpdate(DEFAULT_USER_SETTINGS);
      }
    },
    (err) => {
      console.warn('Could not read user settings from Firestore:', err);
      if (onError) onError(err);
    }
  );
}

// Save or merge user settings in Firestore under users/{userId}/settings/preferences
export async function saveUserSettings(
  userId: string,
  updatedSettings: Partial<UserSettings>
): Promise<void> {
  const settingsDocRef = doc(db, 'users', userId, 'settings', 'preferences');
  const payload = sanitizePayload({
    ...updatedSettings,
    updatedAt: Date.now(),
  });

  await setDoc(settingsDocRef, payload, { merge: true });
}

