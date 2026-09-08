# Reflect — Mindful Personal Journaling Application

<div align="center">

![Reflect Banner](https://img.shields.io/badge/Reflect-Mindful%20Journaling-4A4A38?style=for-the-badge&logoColor=white)
<br/>

[![React 19](https://img.shields.io/badge/React-19.0-61DAFB?style=flat-square&logo=react&logoColor=black)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-3178C6?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-6.2-646CFF?style=flat-square&logo=vite&logoColor=white)](https://vitejs.dev/)
[![Tailwind CSS 4](https://img.shields.io/badge/Tailwind_CSS-4.1-38B2AC?style=flat-square&logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)
[![Express](https://img.shields.io/badge/Express-4.21-000000?style=flat-square&logo=express&logoColor=white)](https://expressjs.com/)
[![Gemini API](https://img.shields.io/badge/Gemini_API-3.8_Flash-8E75B2?style=flat-square&logo=google&logoColor=white)](https://ai.google.dev/)
[![Cloud Firestore](https://img.shields.io/badge/Cloud_Firestore-Firebase_12-FFA611?style=flat-square&logo=firebase&logoColor=black)](https://firebase.google.com/)
[![Cloud Run](https://img.shields.io/badge/Google_Cloud-Cloud_Run-4285F4?style=flat-square&logo=google-cloud&logoColor=white)](https://cloud.google.com/run)

<p align="center">
  <strong>A calm, private, and restorative journaling companion powered by Gemini AI and Cloud Firestore.</strong><br/>
  Conversational reflection · Smart emotional categorization · Voice & video journaling · Weekly retrospective digests · Astronomical stillness space · Time-capsule letters · Ambient sound bed
</p>

</div>

---

## 🌿 Table of Contents

- [Overview](#-overview)
- [Key Features](#-key-features)
  - [1. Conversational Reflection & Memory](#1-conversational-reflection--memory)
  - [2. Multimodal Journaling: Voice & Video](#2-multimodal-journaling-voice--video)
  - [3. Cadence Heatmap & Longitudinal Patterns](#3-cadence-heatmap--longitudinal-patterns)
  - [4. Stillness Calm Space: Astronomy & Untangle](#4-stillness-calm-space-astronomy--untangle)
  - [5. Dear Future Me (Time-Capsule Letters)](#5-dear-future-me-time-capsule-letters)
  - [6. Sensory Experience & Ambient Sound Bed](#6-sensory-experience--ambient-sound-bed)
  - [7. Mobile-First Adaptive Experience](#7-mobile-first-adaptive-experience)
- [System Architecture](#-system-architecture)
  - [High-Level Topology](#high-level-topology)
  - [Backend API Route Matrix](#backend-api-route-matrix)
  - [Firestore Document Schema](#firestore-document-schema)
- [Security & Threat Architecture](#-security--threat-architecture)
  - [Zero-Secret Client Hygiene](#zero-secret-client-hygiene)
  - [Firestore Security Rules](#firestore-security-rules)
  - [Model Fallback Ladder](#model-fallback-ladder)
- [Getting Started](#-getting-started)
  - [Prerequisites](#prerequisites)
  - [Local Development Setup](#local-development-setup)
- [Production Deployment](#-production-deployment)
  - [Secret Manager Configuration](#secret-manager-configuration)
  - [Google Cloud Run Deployment](#google-cloud-run-deployment)
- [Verification & Testing Guide](#-verification--testing-guide)
- [Tech Stack](#-tech-stack)

---

## 📖 Overview

**Reflect** is designed from the ground up as a private sanctuary for daily thought, not a standard chatbot. It provides an unhurried, empathetic space where users can untangle feelings, build self-awareness, and capture personal growth over time.

- **Non-Clinical Companion Persona**: Gemini responds with mindful inquiry and gentle reflections rather than prescriptive advice, diagnostic language, or unsolicited action plans.
- **Durable Cloud Persistence**: Every thought, session, weekly retrospective, and letter is secured in Google Cloud Firestore under owner-isolated security rules.
- **Privacy First**: Zero third-party telemetry, zero client-exposed API keys, and fully opt-in multimedia/geolocation features.

---

## ✨ Key Features

### 1. Conversational Reflection & Memory
* **Multi-Turn Contextual Dialog**: Chat naturally with Gemini as your reflective sounding board. The model holds conversational continuity within a session, acknowledging subtleties and asking meaningful open-ended questions.
* **Smart Emotional Categorization**: When saving a reflection, Gemini categorizes the entry into one of seven emotional themes:
  * 🌿 **Gratitude** (Emerald) — Appreciation, contentment, thankfulness
  * 🍊 **Stress** (Orange) — Pressure, overwhelm, tension
  * 🌊 **Reflection** (Royal Blue) — Introspection, understanding, self-discovery
  * ☀️ **Excitement** (Amber) — Joy, anticipation, high energy
  * 🧭 **Problem-Solving** (Teal) — Clarity, decisions, analytical thinking
  * 🌸 **Sadness** (Rose) — Grief, vulnerability, melancholy
  * 🕊️ **Neutral** (Zinc) — General observations, daily logs, balanced thoughts
* **Dual-Track Category Retention**: Both `aiCategory` (Gemini's initial classification) and `userCategory` (the user's manual correction) are saved, allowing users to override labels without erasing the original AI insight.
* **Next-Day Micro-Commitment Loop**: Gemini extracts one realistic, bite-sized intention for tomorrow. On the subsequent calendar day, a gentle check-in banner appears (*"Did you get a chance to take a 10-minute walk?"*) with one-tap confirmation that marks it done.
* **Ice-Breaker Starters**: A randomized pool of 40+ introspective prompts with shuffle mechanics that prevent repeats within a session, augmented asynchronously with contextual prompts generated by Gemini.
* **Session Resilience**: Active drafts survive tab navigation and browser refreshes (`sessionStorage`). In-flight Gemini generation continues running smoothly in the background when switching views.
* **Expandable History Drawer**: Browse past reflections grouped into *Today*, *Yesterday*, *This Week*, and *Earlier*, with chronological sorting, full-text reading, and inline non-blocking deletion.
* **Print-Ready PDF Archiving**: Export single or bulk reflections as cleanly formatted typography documents suitable for physical printing or offline archiving.

### 2. Multimodal Journaling: Voice & Video
* **Voice Dictation & Transcription**: Capture stream-of-consciousness thoughts through the microphone. Features a live canvas audio waveform visualizer and server-side transcription using Gemini, returning transcribed text, emotional tone summaries, and sentiment tags.
* **Video Notes**: Record short video journal entries with front/back camera toggling. Gemini processes your spoken thoughts and reflection tone to generate emotional insights and summaries directly alongside your entries.
* **Opt-In Geocoding**: Tag reflections with human-readable location names (e.g., *"Kyoto, Japan"*) via OpenStreetMap Nominatim reverse geocoding, requiring explicit permission.

### 3. Cadence Heatmap & Longitudinal Patterns
* **Interactive Frequency Heatmap**: Visualizes annual and monthly journaling cadence, color-coded by the dominant emotional category of each day.
* **Diurnal Rhythm Breakdown**: Dissects reflection habits across four diurnal periods:
  * 🌅 **Morning** (6am – 12pm)
  * ☀️ **Afternoon** (12pm – 6pm)
  * 🌆 **Evening** (6pm – 11pm)
  * 🌙 **Night** (11pm – 6am)
* **Weekly AI Retrospective Digests**: Once a week (or upon request when entries accumulate), Gemini synthesizes reflections into a structured digest featuring:
  * Poetic title capturing the week's essence
  * Dominant themes chips
  * Emotional journey narrative
  * Category distribution percentage breakdown
  * Gentle, non-judgmental observations
  * Closing affirmation and encouragement

### 4. Stillness Calm Space: Astronomy & Untangle
* **Authentic Constellation Tracing**: Select from 14 real astronomical constellations (Orion, Ursa Major, Cassiopeia, Cygnus, Scorpius, etc.). Tap or drag between genuine star coordinates in a peaceful night sky. Correct connections lock with a radiant glow; incorrect attempts dissolve gently without buzzers, timers, or error penalties.
* **Astronomical Lore & Myth**: Upon completing a constellation, Gemini provides a warm, authentic cultural and astronomical narrative describing the constellation's history, notable stars, and sky visibility.
* **Free Sky Mode**: An unguided star canvas allowing users to place stars, draw celestial connections, and create custom constellations without rules or scores.
* **Planar Graph Untangling**: A tranquil physics-based node puzzle where intersecting lines softly glow amber and resolve to emerald as lines are disentangled.
* **Gentle Stress Referral**: When an entry is classified as *Stress* or *Sadness*, a gentle dismissible banner offers an invitation to decompress in the Stillness space.

### 5. Dear Future Me (Time-Capsule Letters)
* **Sealed Future Delivery**: Write letters to your future self and schedule them for 1 month, 3 months, 6 months, 1 year, or a custom target date.
* **Lock State**: Letters remain sealed in Cloud Firestore until the designated date arrives, displaying a gentle countdown.
* **Unlock Ceremony & Reflection Prompt**: Once unlocked, letters reveal the original composition alongside a Gemini-generated introspection question comparing who wrote the letter to who is reading it.

### 6. Sensory Experience & Ambient Sound Bed
* **In-Browser Web Audio Synthesizer**: Generates a soft, non-melodic filtered pink/brown noise bed layered with dual grounding sine hums at harmonic frequencies (108 Hz & 162 Hz).
* **Context-Aware Acoustic Filtering**: Automatically shifts its filter cutoff frequency higher (~380 Hz) in the Stillness space for an ethereal atmosphere, settling into a warmer tone (~250 Hz) during journaling.
* **Smooth Fades & Zero Assets**: Completely synthesized in real time via the Web Audio API without downloading bulky MP3 files. Includes an unobtrusive volume slider and persistent toggle state.
* **Mindful Avatar System**: Choose from 6 custom zen avatars (*Zen Lotus*, *Crescent Moon*, *Inner Compass*, *Mountain Peak*, *Gentle Wave*, *Quiet Flame*) or your Google profile photo, synchronized across the header, chat messages, and settings.
* **Growing Streak Metaphor**: Celebrates habit formation with an organic growth ladder:
  * 0 Days: *Ready to Bloom* 🌱
  * 1–2 Days: *Seedling Sprout* 🌿
  * 3–6 Days: *Flourishing Growth* 🌸
  * 7–13 Days: *Blooming Lotus* 🪷
  * 14+ Days: *Deep-Rooted Tree* 🌳

### 7. Mobile-First Adaptive Experience
* **Fixed Bottom Navigation Bar**: On mobile viewports (<768px), navigation transitions to a persistent, thumb-friendly bottom bar with equal-width touch targets for *My Space*, *Patterns*, *Future Me*, and *Stillness*, complete with safe-area padding.
* **Adaptive Single-Line Composer**: Textarea auto-grows dynamically with input while maintaining a clean single-line profile at rest without internal scrollbars. Secondary multimodal tools collapse into a compact `+` menu on narrow screens.
* **Warm Obsidian & Cream Palette**: High-contrast, WCAG AA-compliant light mode with warm stone neutrals, paired with an eye-safe dark mode.

---

## 🏗️ System Architecture

### High-Level Topology

```
┌─────────────────────────────────────────────────────────────────────────┐
│                      CLIENT (Browser / Mobile PWA)                       │
│  React 19 + TypeScript + Vite 6 + Tailwind CSS 4 + Motion + Lucide     │
│                                                                         │
│   ┌───────────────────────────┐      ┌───────────────────────────────┐  │
│   │   Firebase Auth (GSI)     │      │   Web Audio Synthesizer       │  │
│   │   Google Popup Sign-In    │      │   Pink/Brown Noise + Sine     │  │
│   └─────────────┬─────────────┘      └───────────────────────────────┘  │
└─────────────────┼───────────────────────────────────┬───────────────────┘
                  │ Identity JWT                      │
                  ▼                                   ▼
┌───────────────────────────────────┐    ┌────────────────────────────────┐
│      Cloud Firestore (GCP)        │    │  Express Full-Stack Server     │
│                                   │    │  Cloud Run (Port 3000)         │
│  Owner-Bound Path Isolation:      │    │                                │
│  users/{uid}/entries/{entryId}    │    │  • Multi-turn Dialog Proxy     │
│  users/{uid}/digests/{digestId}   │    │  • Audio/Video Transcribe      │
│  users/{uid}/letters/{letterId}   │    │  • Reverse Geocode Proxy       │
│  users/{uid}/settings             │    │  • Constellation Lore Engine   │
│                                   │    └───────────────┬────────────────┘
│  Enforced via firestore.rules     │                    │ Server-Side Secret
└───────────────────────────────────┘                    ▼
                                         ┌────────────────────────────────┐
                                         │       Gemini 3.8 / 3.6 API     │
                                         │       @google/genai SDK        │
                                         └────────────────────────────────┘
```

### Backend API Route Matrix

All AI and external requests route through the Express server to prevent API key exposure and apply payload validation.

| Method | Route | Description | Primary Payload |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/health` | Liveness and readiness probe for container orchestrator | None |
| `POST` | `/api/chat` | Multi-turn conversational companion response | `{ messages, userContext }` |
| `POST` | `/api/session/summarize` | Summarizes reflection, assigns emotional category, extracts commitment | `{ transcript }` |
| `POST` | `/api/audio/transcribe` | Transcribes audio recording with emotion tags and sentiment analysis | `{ audioBase64, mimeType }` |
| `POST` | `/api/video/analyze` | Analyzes video note keyframes and audio for spoken thoughts and mood | `{ frames, audioData, mimeType }` |
| `POST` | `/api/letter/unlock-reflection` | Generates comparative introspective question for unlocked letter | `{ letterContent, createdDate }` |
| `POST` | `/api/constellation/lore` | Generates rich astronomical and cultural narrative for completed constellation | `{ constellationName, stars }` |
| `POST` | `/api/constellation/name` | Suggests poetic celestial name for freeform sky drawing | `{ stars, connections }` |
| `POST` | `/api/digest/generate` | Synthesizes accumulated entries into a weekly retrospective digest | `{ entries[] }` |
| `POST` | `/api/prompts/generate` | Generates personalized journaling prompts based on recent themes | `{ recentCategories[] }` |
| `GET` | `/api/geocode/reverse` | Reverse geocodes coordinates via OpenStreetMap Nominatim | `?lat={lat}&lon={lon}` |

### Firestore Document Schema

```
databases/(default)/documents
└── users/{userId}
    ├── settings/preferences
    │     ├── theme: "light" | "dark" | "system"
    │     ├── customAvatar: "default" | "lotus" | "moon" | "compass" | ...
    │     ├── locationEnabled: boolean
    │     ├── ambientSoundEnabled: boolean
    │     └── dailyCheckinsEnabled: boolean
    │
    ├── entries/{entryId}
    │     ├── createdAt: Timestamp
    │     ├── createdAtMillis: number
    │     ├── summary: string
    │     ├── aiCategory: EmotionalCategory
    │     ├── userCategory: EmotionalCategory | null
    │     ├── messages: Array<{ role: 'user' | 'assistant', text: string, timestamp: number }>
    │     ├── locationTag: string | null
    │     ├── nextDayCommitment: string | null
    │     ├── commitmentCheckin: { status: 'completed' | 'not_yet' | 'skipped', date: string } | null
    │     └── multimedia: { type: 'audio' | 'video', summary: string } | null
    │
    ├── digests/{digestId}
    │     ├── createdAt: Timestamp
    │     ├── createdAtMillis: number
    │     ├── title: string
    │     ├── dateRange: { startDate: string, endDate: string, startMillis: number, endMillis: number }
    │     ├── entryCount: number
    │     ├── themes: string[]
    │     ├── moodShift: string
    │     ├── distribution: Record<EmotionalCategory, number>
    │     ├── observations: string[]
    │     └── closingAffirmation: string
    │
    └── letters/{letterId}
          ├── createdAt: Timestamp
          ├── createdAtMillis: number
          ├── scheduledDate: string
          ├── scheduledMillis: number
          ├── content: string
          ├── unlocked: boolean
          └── reflectionQuestion: string | null
```

---

## 🛡️ Security & Threat Architecture

### Zero-Secret Client Hygiene
- **Strict Server Proxying**: `GEMINI_API_KEY` is loaded strictly on the Node.js server via `process.env.GEMINI_API_KEY` or Google Cloud Secret Manager. No client build bundle (`dist/`) contains any secret keys.
- **Defensive Request Boundaries**: Express enforces strict 50MB payload limits for multimodal requests and structured JSON schema validation.
- **Client Sanitization**: All user inputs are rendered through React JSX escaping to eliminate XSS risks.

### Firestore Security Rules
All read and write access is locked to the authenticated owner. Subcollections inherit this isolation via recursive matching:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // User data isolation: only authenticated owner can read or write
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;

      match /{allSubcollections=**} {
        allow read, write: if request.auth != null && request.auth.uid == userId;
      }
    }
  }
}
```

### Model Fallback Ladder
To ensure uninterrupted journaling even during API rate limits or regional quotas, the backend implements a resilient fallback ladder:

```
gemini-3.8-flash  ──►  gemini-3.6-flash  ──►  gemini-flash-latest  ──►  gemini-3.1-flash-lite
                                                                                │
                                           Offline Mindful Companion ◄──────────┘
```

If upstream network connectivity fails completely, an internal mindful companion engine steps in gracefully to preserve the user's reflection without throwing blocking errors.

---

## 🚀 Getting Started

### Prerequisites
* **Node.js**: v20.0.0 or higher
* **npm**: v10.0.0 or higher
* **Google Cloud Project**: With Billing and Firestore enabled
* **Gemini API Key**: From [Google AI Studio](https://aistudio.google.com/)

### Local Development Setup

1. **Clone the Repository**
   ```bash
   git clone https://github.com/your-username/reflect.git
   cd reflect
   ```

2. **Install Dependencies**
   ```bash
   npm install
   ```

3. **Configure Environment Variables**
   Create a `.env` file in the project root:
   ```env
   # Server Secrets
   GEMINI_API_KEY=your_gemini_api_key_here
   PORT=3000
   NODE_ENV=development

   # Client Firebase Configuration (Safe for browser)
   VITE_FIREBASE_API_KEY=your_firebase_api_key
   VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
   VITE_FIREBASE_PROJECT_ID=your_project_id
   VITE_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
   VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
   VITE_FIREBASE_APP_ID=your_app_id
   ```

4. **Start the Development Server**
   ```bash
   npm run dev
   ```
   Open your browser to `http://localhost:3000`.

---

## 📦 Production Deployment

### Secret Manager Configuration

Store the `GEMINI_API_KEY` securely in Google Cloud Secret Manager:

```bash
# 1. Create and populate the secret
gcloud secrets create GEMINI_API_KEY --replication-policy="automatic"
echo -n "YOUR_GEMINI_API_KEY" | gcloud secrets versions add GEMINI_API_KEY --data-file=-

# 2. Grant the Cloud Run compute service account access
PROJECT_NUMBER=$(gcloud projects describe $(gcloud config get-value project) --format="value(projectNumber)")

gcloud secrets add-iam-policy-binding GEMINI_API_KEY \
  --member="serviceAccount:${PROJECT_NUMBER}-compute@developer.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"
```

### Google Cloud Run Deployment

Deploy the containerized full-stack application directly using Cloud Build:

```bash
gcloud run deploy reflect \
  --source . \
  --region us-central1 \
  --allow-unauthenticated \
  --set-secrets GEMINI_API_KEY=GEMINI_API_KEY:latest \
  --set-env-vars NODE_ENV=production
```

Deploy Firestore Security Rules:
```bash
firebase deploy --only firestore:rules
```

---

## 🧪 Verification & Testing Guide

| # | Test Scenario | Steps & Verification |
| :-: | :--- | :--- |
| **1** | **Authentication** | Click **Sign in with Google**. Authenticate via popup. Verify profile avatar, streak counter, and tabs render immediately. |
| **2** | **Starter Prompts** | Tap **Shuffle** on the prompt cards. Verify three new questions display without repeats. Click a card to pre-fill the composer. |
| **3** | **Conversational Dialog** | Send a reflection. Verify thinking indicator appears and Gemini replies empathetically. Send follow-up messages to verify context continuity. |
| **4** | **Voice Dictation** | Click the microphone icon. Speak a thought. Verify the waveform animates and transcribed text appears in the composer. |
| **5** | **Save & Auto-Categorization** | Click **Save & End Session**. Verify summary and category badge are assigned and the session resets. |
| **6** | **Category Override** | Open **Past Reflections**, tap the category chip, and change the mood. Verify the color updates and persists to Firestore. |
| **7** | **Micro-Commitment Loop** | Mention a goal for tomorrow in a reflection. Save the session. Revisit on a subsequent day to verify the check-in banner appears. |
| **8** | **Draft Persistence** | Start typing an entry, navigate to *Patterns* or *Stillness*, then return. Verify draft text and messages remain intact. |
| **9** | **Cadence Heatmap** | Navigate to **Patterns**. Verify reflection activity displays across calendar days with category color coding and diurnal cards. |
| **10** | **Retrospective Digest** | In **Patterns**, click **Generate Retrospective**. Verify Gemini generates a titled retrospective with themes and observations. |
| **11** | **Constellation Tracing** | Navigate to **Stillness** → **Constellation**. Trace star threads. Verify correct paths illuminate and completion reveals lore. |
| **12** | **Untangle Mode** | In **Stillness**, select **Untangle**. Drag nodes until lines no longer cross. Verify lines transition from amber to emerald. |
| **13** | **Dear Future Me** | Navigate to **Future Me**. Write a letter and schedule delivery. Verify the letter is sealed with countdown intact. |
| **14** | **Ambient Sound Bed** | Click the speaker icon in the header. Verify the ambient noise bed fades in smoothly and adjusts volume without clicks. |
| **15** | **Dark Mode** | Click the sun/moon icon. Verify all components transition smoothly between warm light and dark palettes with state persistence. |
| **16** | **Data Isolation** | Sign in with a different Google account. Verify zero access to the previous user's reflections, digests, or letters. |

---

## 🧰 Tech Stack

| Domain | Technology | Version | Purpose |
| :--- | :--- | :--- | :--- |
| **Frontend Framework** | React | 19.0.1 | Reactive component architecture & state hooks |
| **Language** | TypeScript | 5.8.2 | Strict type safety across client and server |
| **Build & Dev Tool** | Vite | 6.2.3 | Instant HMR and optimized production bundling |
| **Styling & Design** | Tailwind CSS | 4.1.14 | Modern utility-first CSS design system |
| **Animations** | Motion | 12.23.24 | Smooth micro-interactions and transitions |
| **Icons** | Lucide React | 0.546.0 | Minimalist iconography |
| **Backend Server** | Express | 4.21.2 | Full-stack API proxy and static asset serving |
| **Server Runtime** | Node.js / tsx | 22.x / 4.21.0 | Fast server execution and bundling |
| **AI SDK** | `@google/genai` | 2.4.0 | Official Google GenAI TypeScript SDK |
| **Authentication** | Firebase Auth | 12.18.0 | Secure client-side Google OAuth popup login |
| **Database** | Cloud Firestore | 12.18.0 | Real-time NoSQL cloud document storage |
| **Cloud Hosting** | Google Cloud Run | Managed | Fully managed serverless container runtime |
| **Secret Storage** | Secret Manager | Managed | Secure server-side credential management |

---

<div align="center">
  <sub>Reflect · Built with care for mindful, private, and intentional self-reflection.</sub>
</div>
