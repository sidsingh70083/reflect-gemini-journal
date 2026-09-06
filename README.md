# Reflect — Mindful Personal Journaling Application

Reflect is a user-authenticated personal journaling web application powered by Google Cloud Run, Cloud Firestore, Firebase Authentication, and the Gemini API (`gemini-3.6-flash`).

It goes beyond a chat wrapper: reflections are automatically categorised by emotional theme, surfaced back as weekly AI retrospectives and longitudinal cadence heatmaps, and turned into small next-day commitments the app gently follows up on. Entries can be written, dictated by voice, or recorded as video, and users can schedule letters to their future selves.

---

## ✨ Features

### Core

| Capability | Implementation |
| :--- | :--- |
| **User Authentication** | Google Sign-In via Firebase Authentication. No email/password credentials are stored by the application. |
| **Multi-turn AI Journaling** | Real conversational sessions with Gemini, warm and non-clinical in tone, with full context preserved across turns. |
| **Isolated Data Storage** | Every document lives under `users/{uid}/…` and is enforced by owner-bound Firestore security rules. Zero cross-user visibility. |
| **Secure Key Management** | `GEMINI_API_KEY` is resolved server-side only, from Google Cloud Secret Manager / environment binding. The client bundle contains no secrets and never calls Gemini directly. |

### Original feature enhancements

- **Smart emotional categorisation with user override** — on save, Gemini assigns one of seven categories (Gratitude, Stress, Reflection, Excitement, Problem-Solving, Sadness, Neutral) plus a one-line summary. Both the AI's assignment (`aiCategory`) and the user's correction (`userCategory`) are retained, so overrides persist without destroying the model's original judgement.
- **Micro-commitment loop** — at the end of a session, Gemini extracts one small, concrete action for the next day. On a later calendar day the app surfaces a single non-intrusive check-in for the most recent outstanding commitment, records the response, and never asks twice.
- **Weekly AI retrospective digests** — once enough reflections accumulate, Gemini synthesises the window into a structured digest: date range, recurring theme chips, mood-shift narrative, category distribution, gentle observations, and a closing encouragement. Digests persist to `users/{uid}/digests/{digestId}` and remain browsable.
- **Cadence & emotional heatmap** — a calendar heatmap of journaling frequency coloured by each day's dominant mood, plus time-of-day pattern analysis, computed from the user's own entry history in their local timezone.
- **Dear Future Me** — compose a letter, schedule it for a future date, and have it stay sealed until then. On unlock the letter is revealed with a Gemini-generated reflection question inviting comparison between who wrote it and who is reading it. Both the written date and arrival date are shown.
- **Voice and video journaling** — dictate an entry via audio capture with server-side Gemini transcription, or record a video reflection for analysis, for days when typing is too much friction.
- **Growing streak** — consecutive journaling days are represented as a growth metaphor rather than a bare counter, progressing through Ready to Bloom → Seedling Sprout → Flourishing Growth → Blooming Lotus → Deep-Rooted Tree.
- **Ice-breaker starter prompts** — a large curated pool of introspective openers, three surfaced at a time with a shuffle that avoids repeats, occasionally supplemented by Gemini-generated prompts conditioned on recent entries. Collapsible so returning users aren't crowded, expanded by default for newcomers.
- **PDF export** — export reflections as a formatted document.
- **Optional location context** — opt-in reverse geocoding to give entries a sense of place, off by default and stored only with consent.

### Experience

- Draft sessions survive tab navigation and page reloads; in-flight Gemini responses continue generating in the background rather than being dropped when the user switches tabs.
- Collapsible **Past Reflections** side drawer, grouped by Today / Yesterday / This Week / Earlier, with newest-first or oldest-first sorting.
- Inline delete confirmation (avoids `window.confirm`, which is unreliable in sandboxed iframes).
- Persistent dark mode, theme-matched scrollbars, and calm 200–300ms transitions throughout.

---

## 🛡️ Threat Modelling & Security Architecture

| Threat Zone | Identified Risks | Countermeasures & Applied Controls |
| :--- | :--- | :--- |
| **Input Surfaces** | Malicious chat payloads, XSS in journal entries, oversized request bodies. | Express body limits (`50MB`, sized for audio/video payloads), React JSX output encoding, defensive payload sanitisation, structured prompt isolation. |
| **Planning & Reasoning** | Prompt injection attempting to alter categorisation taxonomy or companion persona. | Isolated system instructions, structured output parsing with deterministic fallback heuristics, non-executable message boundaries. |
| **Tool & API Execution** | API key leakage, unauthorised AI proxy usage, upstream model unavailability. | Server-side Gemini proxy (all eight client calls target first-party `/api/*` routes), resilient model fallback ladder (`gemini-3.6-flash` → `gemini-flash-latest`), null-safe error recovery. |
| **Memory & State** | Cross-user data contamination, unauthorised reads or writes of other users' journals. | Owner-bound Firestore path isolation (`users/{userId}/…`) validated by security rules (`request.auth.uid == userId`), applied recursively to all subcollections. |
| **Inter-System Communication** | Token interception, unauthorised database mutations. | HTTPS/TLS transport encryption, Firebase Auth JWT verification, client-side zero-secret architecture. |

---

## 🏗️ Architecture

```
Client (React 19 + TypeScript + Vite + Tailwind)
  │  Firebase Auth (Google Sign-In)  ──►  Firebase
  │  Firestore SDK (owner-scoped reads/writes, enforced by rules)
  │
  └─ fetch /api/*  ──►  Express server (server.ts) on Cloud Run
                          │  GEMINI_API_KEY from Secret Manager (server-only)
                          └─ @google/genai  ──►  Gemini API
```

### Server routes

| Route | Purpose |
| :--- | :--- |
| `GET /api/health` | Liveness probe. |
| `POST /api/chat` | Multi-turn conversational journaling. |
| `POST /api/session/summarize` | Summary, category assignment, and next-day commitment extraction. |
| `POST /api/audio/transcribe` | Voice note transcription. |
| `POST /api/video/analyze` | Video reflection analysis. |
| `POST /api/prompts/generate` | Contextual prompt generation. |
| `POST /api/letter/unlock-reflection` | Reflection question generated when a scheduled letter unlocks. |
| `POST /api/digest/generate` | Weekly retrospective synthesis. |
| `GET /api/geocode/reverse` | Opt-in reverse geocoding for location context. |

### Firestore data model

```
users/{uid}
  ├── entries/{entryId}
  │     createdAt, messages[{role, text, timestamp}], summary,
  │     aiCategory, userCategory, nextDayCommitment, commitmentCheckin
  ├── digests/{digestId}
  │     dateRange, title, themes[], moodShift, distribution, observations
  └── letters/{letterId}
        content, createdAt, scheduledDate, scheduledMillis, unlocked
```

---

## 📋 Prerequisites

- **Google Cloud Project** with billing enabled
- **Google Cloud SDK** (`gcloud` CLI), installed and authenticated
- **Node.js** v20+ and npm
- **Firebase CLI** (`npm install -g firebase-tools`)

Enable the required APIs:

```bash
gcloud services enable \
  run.googleapis.com \
  secretmanager.googleapis.com \
  firestore.googleapis.com \
  cloudbuild.googleapis.com
```

---

## 🔑 Secret Management Setup

The `GEMINI_API_KEY` is never hardcoded or exposed to the client. It is stored in Google Cloud Secret Manager and bound to the Cloud Run service at runtime.

```bash
# 1. Create and populate the secret
gcloud secrets create GEMINI_API_KEY --replication-policy="automatic"
echo -n "YOUR_GEMINI_API_KEY_HERE" | gcloud secrets versions add GEMINI_API_KEY --data-file=-

# 2. Grant the Cloud Run service account read access
PROJECT_NUMBER=$(gcloud projects describe $(gcloud config get-value project) --format="value(projectNumber)")

gcloud secrets add-iam-policy-binding GEMINI_API_KEY \
  --member="serviceAccount:${PROJECT_NUMBER}-compute@developer.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"
```

---

## 🔒 Cloud Firestore Security Rules

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // User data isolation: only the authenticated owner may read or modify their documents
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;

      match /{allSubcollections=**} {
        allow read, write: if request.auth != null && request.auth.uid == userId;
      }
    }
  }
}
```

The recursive `{allSubcollections=**}` match extends owner-binding to `entries`, `digests`, and `letters`, so no subcollection can be reached by a non-owner even if a client attempted a direct path read.

Deploy:

```bash
firebase deploy --only firestore:rules
```

---

## 🚀 Cloud Run Deployment

```bash
gcloud run deploy reflect-app \
  --source . \
  --region us-central1 \
  --allow-unauthenticated \
  --set-secrets GEMINI_API_KEY=GEMINI_API_KEY:latest \
  --set-env-vars NODE_ENV=production
```

### Verification label

```bash
gcloud run services update reflect-app \
  --update-labels=dev-tutorial=cloud-run-ai-challenge \
  --region=us-central1
```

---

## 🧪 Functional Walkthrough & Test Guide

**1. Unauthenticated landing & Google Sign-In**
Open the application URL without an active session. A minimal landing page shows the app name, a one-line tagline, and a single "Sign in with Google" button. Completing the popup transitions to the private dashboard with the user's name, avatar, streak indicator, and tabs.

**2. Greeting & starter prompts**
On **My Space**, a personalised greeting appears with a rotating supportive line and three starter prompt chips. Shuffle rotates to three new prompts without repeating within the session. Tapping a prompt pre-fills the composer for editing. The block collapses via its chevron and remembers that preference.

**3. Multi-turn conversational journaling**
Send a message. It renders right-aligned, a thinking indicator appears, and Gemini replies with an empathetic reflection and follow-up. Context is preserved across several turns.

**4. Voice journaling**
Tap the microphone in the composer. Recording state is visually indicated; audio is transcribed server-side and appended into the composer for editing before sending. Unsupported browsers show a clear disabled state rather than failing silently.

**5. Save & end session with auto-categorisation**
Click **Save & End Session**. The session is summarised, assigned a category, and persisted to `users/{uid}/entries/{entryId}`. Gemini also extracts a next-day micro-commitment where one naturally arises. The composer resets.

**6. Category override**
In **Past Reflections**, tap an entry's category chip and select a different mood. The chip updates immediately and persists as `userCategory` while `aiCategory` is preserved.

**7. History drawer, sorting, and deletion**
Open the **Past Reflections** drawer. Entries are grouped under Today / Yesterday / This Week / Earlier, each showing its own creation time, category chip, and summary. Sorting toggles between newest-first and oldest-first. Tapping expands the full read-only transcript. Delete prompts an inline confirmation before removing the document from Firestore.

**8. Draft persistence & uninterrupted generation**
Start a conversation, then switch to **Patterns** or **Dear Future Me** and return, or reload the tab. The in-progress draft is preserved. A Gemini response still generating when you navigate away continues in the background and is intact on return.

**9. Micro-commitment check-in**
On a later calendar day, a slim dismissible banner surfaces the most recent outstanding commitment with quick-tap responses. Once answered or dismissed it is recorded and not shown again.

**10. Dark mode**
Toggle in the header switches the entire interface between light and dark palettes. The preference persists across reloads.

**11. Weekly retrospective**
On **Patterns**, view progress toward the next digest and generate one when eligible. Gemini produces a titled digest with themes, mood-shift narrative, category distribution, observations, and a closing note, saved to `users/{uid}/digests/{digestId}` and listed in reverse-chronological order.

**12. Cadence & emotional heatmap**
Below the retrospectives, a calendar heatmap shows journaling frequency coloured by each day's dominant mood, alongside time-of-day pattern analysis. Sparse histories show a friendly encouragement rather than an empty grid.

**13. Dear Future Me**
Compose a letter and schedule it for a future date. Sealed letters list their unlock date with content hidden. On or after the scheduled date, the letter unlocks with a distinct reveal, shows both its written and arrival dates, and is accompanied by a Gemini-generated reflection question.

**14. Cross-user isolation**
Sign in with a second Google account in a separate browser profile. Create entries on both. Neither account can see the other's entries, digests, or letters — enforced by security rules, not merely hidden in the UI.

---

## 🧰 Tech Stack

React 19 · TypeScript · Vite 6 · Tailwind CSS 4 · Motion · Lucide · Express 4 · `@google/genai` · Firebase Auth · Cloud Firestore · Cloud Run · Secret Manager · Gemini API
