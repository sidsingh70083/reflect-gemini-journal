# Reflect — Mindful Personal Journaling Application

Reflect is a mindful, user-authenticated personal journaling web application powered by Google Cloud Run, Cloud Firestore, and the Gemini API (`gemini-3.6-flash`). It offers multi-turn conversational journaling, intelligent AI-driven emotional categorization, manual user mood overrides, daily streak progression, and introspective icebreaker prompts.

---

## 🛡️ Agentic Threat Modeling & Security Architecture

| Threat Zone | Identified Risks | Countermeasures & Applied Controls |
| :--- | :--- | :--- |
| **Input Surfaces** | Malicious chat payloads, XSS in journal entries, oversized request bodies. | Strict Express body limits (`2MB`), React JSX output encoding, defensive payload sanitization, and structured prompt isolation. |
| **Planning & Reasoning** | Prompt injection attempting to alter categorization taxonomy or companion persona. | Isolated system instructions, structured output parsing with deterministic fallback heuristics, non-executable message boundaries. |
| **Tool & API Execution** | API key leakage, unauthorized AI proxy usage, server overload / status code errors. | Server-side Gemini API proxy, resilient fallback ladder (`gemini-3.6-flash` → `gemini-flash-latest`), null-safe error recovery. |
| **Memory & State** | Cross-user data contamination, unauthorized reading/writing of other users' journals. | Strict Cloud Firestore owner-bound path isolation (`users/{userId}/entries/{entryId}`) validated by security rules (`request.auth.uid == userId`). |
| **Inter-System Communication** | Token interception, unauthorized database mutations. | HTTPS/TLS transport encryption, Firebase Auth JWT verification, client-side zero-secret architecture. |

---

## 📋 Prerequisites

1. **Google Cloud Project**: An active GCP project with billing enabled.
2. **Google Cloud SDK (`gcloud` CLI)**: Installed and authenticated.
3. **Node.js**: v20+ and npm.
4. **Firebase CLI**: Installed (`npm install -g firebase-tools`).

Enable the necessary APIs:
```bash
gcloud services enable \
  run.googleapis.com \
  secretmanager.googleapis.com \
  firestore.googleapis.com \
  cloudbuild.googleapis.com \
  aiplatform.googleapis.com
```

---

## 🔑 Secret Management Setup

Reflect adheres to strict zero-hardcoding hygiene. The `GEMINI_API_KEY` is managed securely via Google Cloud Secret Manager.

```bash
# 1. Create and populate the secret in Secret Manager
gcloud secrets create GEMINI_API_KEY --replication-policy="automatic"
echo -n "YOUR_GEMINI_API_KEY_HERE" | gcloud secrets versions add GEMINI_API_KEY --data-file=-

# 2. Grant the Cloud Run compute service account permission to access the secret
PROJECT_NUMBER=$(gcloud projects describe $(gcloud config get-value project) --format="value(projectNumber)")

gcloud secrets add-iam-policy-binding GEMINI_API_KEY \
  --member="serviceAccount:${PROJECT_NUMBER}-compute@developer.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"
```

---

## 🔒 Cloud Firestore Security Rules

Deploy the owner-bound security rules to ensure zero insecure defaults and complete user data isolation:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // User data isolation: only authenticated owner can read or modify their entries
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
      
      match /{allSubcollections=**} {
        allow read, write: if request.auth != null && request.auth.uid == userId;
      }
    }
  }
}
```

Deploy rules using Firebase CLI:
```bash
firebase deploy --only firestore:rules
```

---

## 🚀 Cloud Run Deployment

Deploy the containerized full-stack application to Cloud Run with attached Secret Manager secrets:

```bash
gcloud run deploy reflect-app \
  --source . \
  --region us-central1 \
  --allow-unauthenticated \
  --set-secrets GEMINI_API_KEY=GEMINI_API_KEY:latest \
  --set-env-vars NODE_ENV=production
```

### Mandatory Campaign Verification Label

Apply the required challenge label for automated verification:

```bash
gcloud run services update reflect-app \
  --update-labels=dev-tutorial=cloud-run-ai-challenge \
  --region=us-central1
```

---

## 🧪 Functional Walkthrough & Test Guide

Every user interaction has a corresponding verification test case:

### Test Case 1: Unauthenticated Landing & Google Sign-In
- **Action**: Open the application URL without an active Firebase session.
- **Expected Result**: Minimal, calm landing page showing the app name ("Reflect"), one-line tagline, and the single "Sign in with Google" button.
- **Action**: Click "Sign in with Google". Complete popup authentication.
- **Expected Result**: Transitions instantly to the private dashboard, displaying the user's name, avatar, streak counter, and tabs.

### Test Case 2: Greeting & Starter Reflection Prompts
- **Action**: Navigate to "My Space".
- **Expected Result**: Personalized greeting displays "Welcome, {FirstName}!" with a rotating supportive message. Three randomized starter prompt chips are displayed.
- **Action**: Click the "Shuffle" button.
- **Expected Result**: Prompts rotate to 3 new introspective questions from the pool.
- **Action**: Click one starter prompt (e.g. "Something that went well recently...").
- **Expected Result**: The chat composer text area is populated with that prompt text and focused for editing.

### Test Case 3: Multi-turn Conversational Journaling with Gemini
- **Action**: Type a thought and hit Enter or click the Send button.
- **Expected Result**: User message renders aligned to the right. A thinking indicator appears. Gemini returns an empathetic, non-clinical reflection and follow-up inquiry.
- **Action**: Send 2-3 follow-up reflections within the same session.
- **Expected Result**: Complete conversation scrolls smoothly, preserving context throughout the session.

### Test Case 4: Voice Input Tooltip
- **Action**: Click the microphone icon in the chat composer.
- **Expected Result**: A tooltip appears stating "Voice input coming soon" and disappears smoothly after 2.8 seconds.

### Test Case 5: Save & End Session with Smart Auto-Categorization
- **Action**: Click "Save & End Session" at the top or bottom of the active workspace.
- **Expected Result**: Active session is sent to `/api/session/summarize`. Gemini categorizes the theme (e.g. Gratitude, Stress, Reflection) and generates a one-line summary. The entry persists to Firestore under `users/{uid}/entries/{entryId}`. The chat area resets cleanly.

### Test Case 6: Category Mood Override
- **Action**: Locate the saved entry in the "Past Reflections" section.
- **Expected Result**: Entry displays the date, one-line summary, and assigned category chip.
- **Action**: Click the category chip. Select a different mood (e.g. switch from "Reflection" to "Gratitude").
- **Expected Result**: Chip updates immediately to the new color/tag and persists to Firestore under `userCategory` while preserving `aiCategory`.

### Test Case 7: Expandable History Drawer & Safe Inline Deletion
- **Action**: Click the "Past Reflections" button in the top right of My Space.
- **Expected Result**: The past reflections slide-out side panel drawer opens smoothly.
- **Action**: Click a past entry card.
- **Expected Result**: Expands to reveal the full read-only transcript with message timestamps.
- **Action**: Click "Delete" on the entry.
- **Expected Result**: An inline confirmation prompts: *"Delete this entry? This can't be undone."* with [Delete] and [Cancel] buttons (guaranteeing reliability in iframe sandboxes without `window.confirm`).
- **Action**: Click [Delete].
- **Expected Result**: Entry document is immediately deleted from Firestore (`users/{uid}/entries/{entryId}`) and disappears from the history list.

### Test Case 8: In-Progress Draft Persistence Across Tab Navigation & Page Reload
- **Action**: In "My Space", type an entry and send 1-2 messages with Gemini.
- **Expected Result**: Active conversation is displayed with option to Save & End Session or Discard.
- **Action**: Click the "Trends" tab or "Letter to Future" tab in the navigation bar.
- **Action**: Switch back to "My Space" tab (or refresh the browser tab).
- **Expected Result**: The in-progress draft conversation and textarea buffer are fully preserved without loss.
- **Action**: Click "Discard" and confirm.
- **Expected Result**: The active draft is safely cleared.

### Test Case 9: Global Dark Mode Toggle Persistence
- **Action**: Click the sun/moon dark mode toggle in the header.
- **Expected Result**: The entire application (header, tabs, composer, history drawer, cards, and text) seamlessly switches between warm light and dark palettes.
- **Action**: Refresh the page.
- **Expected Result**: The selected theme preference is remembered and applied automatically from `localStorage`.

### Test Case 10: Weekly AI Retrospective Digest in Trends Tab
- **Action**: Click the "Trends" tab.
- **Expected Result**: Displays the Weekly Retrospective dashboard with current progress (e.g. `X / 7 reflections`, `Y / 7 days active`).
- **Action**: Click "Generate Retrospective" (or "Generate Early Retrospective").
- **Expected Result**: Gemini synthesizes the window of reflections into a structured weekly digest featuring:
  - Date range & reflection count
  - Poetic title
  - Recurring themes chips
  - Mood shift narrative
  - Category distribution breakdown
  - Gentle observations
  - Compassionate encouragement closing
- **Action**: Digest is saved to Firestore under `users/{uid}/digests/{digestId}` and rendered in reverse-chronological order.
- **Action**: Click the digest card to expand/collapse full details, or click Delete to remove from archives.

### Test Case 11: Letter to Future Placeholder
- **Action**: Click "Letter to Future".
- **Expected Result**: Renders the clean "Coming soon" screen explaining scheduled introspective letters.
