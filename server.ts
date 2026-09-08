import express, { Request, Response } from 'express';
import path from 'path';
import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';
import { createServer as createViteServer } from 'vite';

dotenv.config();

const app = express();
const PORT = 3000;

// Mount body parsing middleware before all API routes (support audio recording payloads)
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Lazy GoogleGenAI client accessor with safety check
let aiClient: GoogleGenAI | null = null;
function getAIClient(): GoogleGenAI {
  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.warn('GEMINI_API_KEY is not set. AI requests will fail until configured.');
    }
    aiClient = new GoogleGenAI({
      apiKey: apiKey || '',
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }
  return aiClient;
}

// Resilient Model Fallback Ladder
const MODEL_FALLBACK_LADDER = [
  'gemini-3.8-flash',
  'gemini-3.6-flash',
  'gemini-flash-latest',
  'gemini-3.1-flash-lite',
];

interface FallbackOptions {
  contents: any;
  systemInstruction?: string;
  temperature?: number;
}

async function generateContentWithFallback(options: FallbackOptions): Promise<{ text: string; modelUsed: string }> {
  const ai = getAIClient();
  let lastError: any = null;

  for (const model of MODEL_FALLBACK_LADDER) {
    try {
      const response = await ai.models.generateContent({
        model,
        contents: options.contents,
        config: {
          systemInstruction: options.systemInstruction,
          temperature: options.temperature ?? 0.7,
        },
      });

      const responseText = response.text || '';
      return { text: responseText, modelUsed: model };
    } catch (err: any) {
      lastError = err;
      const errMsg = err?.message || String(err);
      const statusCode = err?.status || err?.statusCode || (err?.error && err?.error?.code);
      
      const isRecoverable =
        statusCode === 429 ||
        statusCode === 503 ||
        statusCode === 500 ||
        statusCode === 404 ||
        statusCode === 403 ||
        errMsg.includes('429') ||
        errMsg.includes('404') ||
        errMsg.includes('RESOURCE_EXHAUSTED') ||
        errMsg.includes('UNAVAILABLE') ||
        errMsg.includes('quota') ||
        errMsg.includes('exceeded') ||
        errMsg.includes('no longer available');

      // If project prepayment credits are depleted, subsequent models on the same project will also fail
      const isDepleted = errMsg.includes('prepayment credits are depleted') || errMsg.includes('depleted') || errMsg.includes('prepay');
      if (isDepleted) {
        console.log(`[Gemini API] Prepayment credits depleted on project for model '${model}'.`);
        break;
      }

      console.log(`[Gemini Fallback] Model '${model}' unavailable (status: ${statusCode || 'n/a'}), checking next model.`);

      if (isRecoverable) {
        continue;
      }
    }
  }

  const isPrepaymentDepleted = String(lastError?.message || '').includes('depleted') || String(lastError?.message || '').includes('prepayment');
  if (isPrepaymentDepleted) {
    throw new Error('Prepayment credits are depleted on this project.');
  }

  throw new Error(`All Gemini models in fallback ladder failed. Last error: ${lastError?.message || 'Unknown error'}`);
}

// Health check route
app.get('/api/health', (req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Chat conversational endpoint
app.post('/api/chat', async (req: Request, res: Response) => {
  try {
    const body = req.body && typeof req.body === 'object' ? req.body : {};
    const messages = Array.isArray(body.messages) ? body.messages : [];

    if (messages.length === 0) {
      res.status(400).json({ error: 'Messages array is required and must not be empty.' });
      return;
    }

    // Format conversation history for Gemini SDK
    const contents = messages.map((m: any) => ({
      role: m.role === 'model' ? 'model' : 'user',
      parts: [{ text: String(m.text || '') }],
    }));

    const systemInstruction = `You are Reflect, a thoughtful, warm, and mindful personal journaling companion.
Your purpose is to help the user explore and untangle their inner thoughts, emotions, dilemmas, and daily experiences.

Tone & Style Principles:
- Tone: Warm, calm, introspective, non-judgmental, and deeply empathetic.
- Non-clinical: Avoid clinical therapist clichés (do not say "How does that make you feel?", "I hear you saying...", or repetitive generic validations).
- Conversational depth: Offer genuine reflections, gentle follow-up questions, fresh angles to consider, or light brainstorming prompts based on what the user shared.
- Concise & natural: Keep responses grounded (2 to 4 sentences or a short paragraph). Do not overwhelm with giant walls of text.
- Be present: Acknowledge the user's authentic reality without toxic positivity.`;

    const { text, modelUsed } = await generateContentWithFallback({
      contents,
      systemInstruction,
      temperature: 0.75,
    });

    res.json({ reply: text, modelUsed });
  } catch (error: any) {
    const isCreditsDepleted = String(error?.message).includes('depleted') || String(error?.message).includes('prepayment');
    console.log('[Chat API] Companion fallback active:', isCreditsDepleted ? 'Prepayment credits depleted' : error?.message);
    res.json({
      reply: isCreditsDepleted
        ? "I am holding space for your reflection. While the workspace Gemini API credits are currently depleted, your words and insights are safely preserved here. What else is on your mind?"
        : "I'm listening and holding space for your thoughts. While the AI reflection service is temporarily resting, your words and insights are safely preserved here. What else is on your mind?",
      modelUsed: 'offline-mindful-companion',
      isFallback: true,
      creditsDepleted: isCreditsDepleted,
      error: error?.message,
    });
  }
});

// Session summarize, categorization, and next-day micro-commitment endpoint
app.post('/api/session/summarize', async (req: Request, res: Response) => {
  try {
    const body = req.body && typeof req.body === 'object' ? req.body : {};
    const messages = Array.isArray(body.messages) ? body.messages : [];
    const extractCommitment = body.extractCommitment !== false;

    if (messages.length === 0) {
      res.status(400).json({ error: 'Messages array is required for session summary.' });
      return;
    }

    // Transcript formatting
    const transcript = messages
      .map((m: any) => `${m.role === 'user' ? 'User' : 'Journal Companion'}: ${m.text}`)
      .join('\n\n');

    const prompt = extractCommitment
      ? `Analyze this personal journal conversation session:

${transcript}

Tasks:
1. Provide a concise, meaningful one-line summary (maximum 15 words) that captures the core essence of this reflection.
2. Select EXACTLY ONE category from this fixed set that best describes the dominant theme or mood:
   - "Gratitude"
   - "Stress"
   - "Reflection"
   - "Excitement"
   - "Problem-Solving"
   - "Sadness"
   - "Neutral"
3. Extract ONE single tiny, concrete, actionable micro-commitment the user could realistically do the next day, based directly on what they discussed (e.g., "Take a 10-minute walk without your phone during lunch", "Drink a glass of water and stretch before checking emails", "Send a quick thank-you message"). If nothing suitable, realistic, or natural emerges from the conversation, set this field to null — do not force one.

Respond ONLY with valid JSON in this exact structure, with no extra commentary or markdown formatting:
{
  "summary": "...",
  "category": "...",
  "nextDayCommitment": "..." or null
}`
      : `Analyze this personal journal conversation session:

${transcript}

Tasks:
1. Provide a concise, meaningful one-line summary (maximum 15 words) that captures the core essence of this reflection.
2. Select EXACTLY ONE category from this fixed set that best describes the dominant theme or mood:
   - "Gratitude"
   - "Stress"
   - "Reflection"
   - "Excitement"
   - "Problem-Solving"
   - "Sadness"
   - "Neutral"

Respond ONLY with valid JSON in this exact structure, with no extra commentary or markdown formatting:
{
  "summary": "...",
  "category": "..."
}`;

    const { text, modelUsed } = await generateContentWithFallback({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      systemInstruction: 'You are an accurate analytical classifier and mindful reflection assistant for journal entries. You always output strict JSON.',
      temperature: 0.2,
    });

    // Parse JSON safely
    let parsedData: { summary: string; category: any; nextDayCommitment: string | null } = {
      summary: 'Journal reflection session',
      category: 'Reflection',
      nextDayCommitment: null,
    };

    try {
      const cleanJson = text.replace(/```json/gi, '').replace(/```/g, '').trim();
      const raw = JSON.parse(cleanJson);
      if (raw.summary && typeof raw.summary === 'string') {
        parsedData.summary = raw.summary.trim();
      }
      const validCategories = ['Gratitude', 'Stress', 'Reflection', 'Excitement', 'Problem-Solving', 'Sadness', 'Neutral'];
      if (raw.category && validCategories.includes(raw.category)) {
        parsedData.category = raw.category;
      }
      if (raw.nextDayCommitment && typeof raw.nextDayCommitment === 'string' && raw.nextDayCommitment.trim().length > 3) {
        parsedData.nextDayCommitment = raw.nextDayCommitment.trim();
      } else {
        parsedData.nextDayCommitment = null;
      }
    } catch (parseErr) {
      console.warn('Failed to parse Gemini summary JSON, falling back to heuristic parsing:', text);
      const matchCat = text.match(/(Gratitude|Stress|Reflection|Excitement|Problem-Solving|Sadness|Neutral)/i);
      if (matchCat) {
        parsedData.category = matchCat[1] as any;
      }
      if (text.length > 5) {
        parsedData.summary = text.slice(0, 100).replace(/["{}]/g, '').trim();
      }
    }

    res.json({
      summary: parsedData.summary,
      category: parsedData.category,
      nextDayCommitment: parsedData.nextDayCommitment,
      modelUsed,
    });
  } catch (error: any) {
    console.log('[Session Summarize API] Heuristic fallback active:', error?.message);
    res.json({
      summary: 'Mindful journaling reflection',
      category: 'Reflection',
      nextDayCommitment: null,
      modelUsed: 'heuristic-fallback',
      isFallback: true,
    });
  }
});

// Audio transcription and emotional tagging endpoint using MediaRecorder audio
app.post('/api/audio/transcribe', async (req: Request, res: Response) => {
  try {
    const body = req.body && typeof req.body === 'object' ? req.body : {};
    let audioData = typeof body.audioData === 'string' ? body.audioData : '';
    let mimeType = typeof body.mimeType === 'string' ? body.mimeType : 'audio/webm';

    if (!audioData) {
      res.status(400).json({ error: 'Audio data is required for transcription.' });
      return;
    }

    // Strip data URI prefix if present (e.g., "data:audio/webm;base64,")
    const match = audioData.match(/^data:([^;]+);base64,(.+)$/);
    if (match) {
      mimeType = match[1];
      audioData = match[2];
    }

    // Normalize MIME type for Gemini
    let cleanMimeType = mimeType.split(';')[0].trim().toLowerCase();
    if (!cleanMimeType || cleanMimeType === 'audio/unknown') {
      cleanMimeType = 'audio/webm';
    }

    const prompt = `You are an empathetic, mindful journaling transcription and emotional analysis companion.
Listen carefully to this personal audio recording from a journal session.

Tasks:
1. "transcription": Transcribe the spoken audio verbatim and accurately. If there are authentic pauses, emotional sighs, or natural self-corrections, capture the true meaning gently. If the audio is completely silent or unintelligible noise, transcribe as empty string or summarize what was heard.
2. "emotionalTags": Provide 2 to 4 nuanced emotional tags that reflect the speaker's emotional state, cadence, and tone (e.g., ["Vulnerable", "Grateful", "Exhausted", "Relieved", "Introspective", "Hopeful", "Anxious", "Determined", "Peaceful"]).
3. "dominantCategory": Select EXACTLY ONE category that best fits the mood and content from:
   - "Gratitude"
   - "Stress"
   - "Reflection"
   - "Excitement"
   - "Problem-Solving"
   - "Sadness"
   - "Neutral"
4. "emotionalSummary": Provide a 1-sentence warm, compassionate observation of the speaker's tone and sentiment (e.g. "Spoken with a calm and reflective cadence, expressing quiet relief.", "A heartfelt reflection carried with openness and gratitude.").

Respond ONLY with valid JSON in this exact structure, with no extra commentary or markdown formatting:
{
  "transcription": "...",
  "emotionalTags": ["...", "..."],
  "dominantCategory": "...",
  "emotionalSummary": "..."
}`;

    const contents = [
      {
        role: 'user',
        parts: [
          {
            inlineData: {
              mimeType: cleanMimeType,
              data: audioData,
            },
          },
          {
            text: prompt,
          },
        ],
      },
    ];

    const { text, modelUsed } = await generateContentWithFallback({
      contents,
      systemInstruction: 'You are an accurate audio transcription and mindful emotional sentiment analyzer for personal reflections. Always output strict JSON.',
      temperature: 0.2,
    });

    let result: {
      transcription: string;
      emotionalTags: string[];
      dominantCategory: string;
      emotionalSummary: string;
    } = {
      transcription: '',
      emotionalTags: ['Reflective'],
      dominantCategory: 'Reflection',
      emotionalSummary: 'A mindful voice reflection.',
    };

    try {
      const cleanJson = text.replace(/```json/gi, '').replace(/```/g, '').trim();
      const parsed = JSON.parse(cleanJson);
      if (typeof parsed.transcription === 'string') {
        result.transcription = parsed.transcription.trim();
      }
      if (Array.isArray(parsed.emotionalTags) && parsed.emotionalTags.length > 0) {
        result.emotionalTags = parsed.emotionalTags.map((t: any) => String(t).trim()).slice(0, 5);
      }
      const validCategories = ['Gratitude', 'Stress', 'Reflection', 'Excitement', 'Problem-Solving', 'Sadness', 'Neutral'];
      if (parsed.dominantCategory && validCategories.includes(parsed.dominantCategory)) {
        result.dominantCategory = parsed.dominantCategory;
      }
      if (typeof parsed.emotionalSummary === 'string' && parsed.emotionalSummary.trim().length > 0) {
        result.emotionalSummary = parsed.emotionalSummary.trim();
      }
    } catch (parseErr) {
      console.log('[Audio API] Using raw text fallback transcription.');
      result.transcription = text.replace(/[{}"\\]/g, '').trim();
    }

    res.json({
      ...result,
      modelUsed,
    });
  } catch (error: any) {
    console.log('[Audio API] Voice reflection fallback active:', error?.message);
    res.json({
      transcription: 'Voice reflection captured.',
      emotionalTags: ['Reflective', 'Mindful'],
      dominantCategory: 'Reflection',
      emotionalSummary: 'A mindful voice reflection recorded and saved.',
      modelUsed: 'voice-fallback',
      isFallback: true,
    });
  }
});

// Video reflection recording & multimodal mood/talks analysis endpoint
app.post('/api/video/analyze', async (req: Request, res: Response) => {
  let thumbnail: string | null = null;
  try {
    const body = req.body && typeof req.body === 'object' ? req.body : {};
    let audioData = typeof body.audioData === 'string' ? body.audioData : '';
    let audioMimeType = typeof body.audioMimeType === 'string' ? body.audioMimeType : 'audio/webm';
    const frames: string[] = Array.isArray(body.frames) ? body.frames : [];
    thumbnail = typeof body.thumbnail === 'string' ? body.thumbnail : null;

    if (!audioData && frames.length === 0) {
      res.status(400).json({ error: 'Video frames or audio data are required for analysis.' });
      return;
    }

    // Prepare multimodal parts for Gemini
    const parts: any[] = [];

    // 1. Add sampled camera video frames
    frames.slice(0, 6).forEach((frameStr: string) => {
      let frameData = frameStr;
      let frameMime = 'image/jpeg';
      const match = frameStr.match(/^data:([^;]+);base64,(.+)$/);
      if (match) {
        frameMime = match[1];
        frameData = match[2];
      }
      if (frameData && frameData.length > 50) {
        parts.push({
          inlineData: {
            mimeType: frameMime,
            data: frameData,
          },
        });
      }
    });

    // 2. Add spoken audio track
    if (audioData) {
      let cleanAudio = audioData;
      let cleanMime = audioMimeType;
      const match = audioData.match(/^data:([^;]+);base64,(.+)$/);
      if (match) {
        cleanMime = match[1];
        cleanAudio = match[2];
      }
      cleanMime = cleanMime.split(';')[0].trim().toLowerCase() || 'audio/webm';

      if (cleanAudio && cleanAudio.length > 50) {
        parts.push({
          inlineData: {
            mimeType: cleanMime,
            data: cleanAudio,
          },
        });
      }
    }

    const prompt = `You are an empathetic, emotionally intelligent mindful journaling companion and video reflection analyst.
You are reviewing a video journal entry recorded by the user. You are provided with sampled camera frames capturing their visual presence and facial expressions, alongside their spoken audio.

Tasks:
1. "transcription": Provide an accurate, verbatim transcript of what the user spoke during their video reflection. If there were long silences or pauses, transcribe what was said accurately.
2. "dominantCategory": Select EXACTLY ONE category that best fits the dominant theme or mood:
   - "Gratitude"
   - "Stress"
   - "Reflection"
   - "Excitement"
   - "Problem-Solving"
   - "Sadness"
   - "Neutral"
3. "emotionalTags": Provide 3 to 5 nuanced emotional descriptors capturing both verbal sentiment and visual energy (e.g., ["Introspective", "Calm", "Vulnerable", "Hopeful", "Relieved", "Resolute", "Tender"]).
4. "visualMoodAnalysis": Provide 2-3 thoughtful sentences analyzing the speaker's visual presence, facial expressions, micro-expressions, posture, eye engagement, and physical cues, noting how visual demeanor aligns with or deepens what they expressed verbally.
5. "overallSentiment": A short 1-3 word sentiment summary (e.g. "Peacefully Centered", "Gently Reflective", "Underlying Overwhelm", "Energized & Uplifted", "Quiet Vulnerability").
6. "emotionalSummary": A warm, compassionate 1-2 sentence holistic observation synthesizing their visual and spoken reflection into an empathetic mirror.
7. "suggestedCommitment": Extract one small, concrete, actionable next-day micro-commitment or grounding practice if naturally fitting, or null if not applicable.

Respond ONLY with valid JSON in this exact structure, with no markdown code fences or conversational text:
{
  "transcription": "...",
  "dominantCategory": "...",
  "emotionalTags": ["...", "...", "..."],
  "visualMoodAnalysis": "...",
  "overallSentiment": "...",
  "emotionalSummary": "...",
  "suggestedCommitment": "..." or null
}`;

    parts.push({ text: prompt });

    const { text, modelUsed } = await generateContentWithFallback({
      contents: [{ role: 'user', parts }],
      systemInstruction: 'You are an accurate, compassionate multimodal video reflection and emotional mood analyzer. Always return strict JSON.',
      temperature: 0.2,
    });

    let result = {
      transcription: '',
      dominantCategory: 'Reflection',
      emotionalTags: ['Reflective', 'Mindful'],
      visualMoodAnalysis: 'Calm facial expression and open posture throughout the reflection.',
      overallSentiment: 'Gently Reflective',
      emotionalSummary: 'A heartfelt, centered video reflection.',
      suggestedCommitment: null as string | null,
      videoThumbnail: thumbnail,
    };

    try {
      const cleanJson = text.replace(/```json/gi, '').replace(/```/g, '').trim();
      const parsed = JSON.parse(cleanJson);
      if (typeof parsed.transcription === 'string') {
        result.transcription = parsed.transcription.trim();
      }
      const validCategories = ['Gratitude', 'Stress', 'Reflection', 'Excitement', 'Problem-Solving', 'Sadness', 'Neutral'];
      if (parsed.dominantCategory && validCategories.includes(parsed.dominantCategory)) {
        result.dominantCategory = parsed.dominantCategory;
      }
      if (Array.isArray(parsed.emotionalTags) && parsed.emotionalTags.length > 0) {
        result.emotionalTags = parsed.emotionalTags.map((t: any) => String(t).trim()).slice(0, 5);
      }
      if (typeof parsed.visualMoodAnalysis === 'string' && parsed.visualMoodAnalysis.trim().length > 0) {
        result.visualMoodAnalysis = parsed.visualMoodAnalysis.trim();
      }
      if (typeof parsed.overallSentiment === 'string' && parsed.overallSentiment.trim().length > 0) {
        result.overallSentiment = parsed.overallSentiment.trim();
      }
      if (typeof parsed.emotionalSummary === 'string' && parsed.emotionalSummary.trim().length > 0) {
        result.emotionalSummary = parsed.emotionalSummary.trim();
      }
      if (parsed.suggestedCommitment && typeof parsed.suggestedCommitment === 'string' && parsed.suggestedCommitment.trim().length > 3) {
        result.suggestedCommitment = parsed.suggestedCommitment.trim();
      }
    } catch (parseErr) {
      console.log('[Video API] Video analysis fallback parsing.');
      if (text.length > 0) {
        result.transcription = text.replace(/[{}"\\]/g, '').trim();
      }
    }

    res.json({
      ...result,
      modelUsed,
    });
  } catch (error: any) {
    console.log('[Video API] Video reflection fallback active:', error?.message);
    res.json({
      transcription: 'Video reflection recorded.',
      dominantCategory: 'Reflection',
      emotionalTags: ['Reflective', 'Mindful'],
      visualMoodAnalysis: 'Video reflection recorded with centered presence.',
      overallSentiment: 'Gently Reflective',
      emotionalSummary: 'A heartfelt video reflection captured.',
      suggestedCommitment: null,
      videoThumbnail: thumbnail,
      modelUsed: 'video-fallback',
      isFallback: true,
    });
  }
});

// Letter unlock reflection prompt generator
app.post('/api/letter/unlock-reflection', async (req: Request, res: Response) => {
  try {
    const body = req.body && typeof req.body === 'object' ? req.body : {};
    const content = typeof body.content === 'string' ? body.content : '';
    const scheduledDate = typeof body.scheduledDate === 'string' ? body.scheduledDate : '';

    const prompt = `A user has just unlocked a personal letter they wrote to their future self back in the past (${scheduledDate}):

Letter Content:
"""
${content.slice(0, 1500)}
"""

Task:
Generate a gentle, compassionate 1-2 sentence reflection prompt inviting the user to compare how they feel now versus when they wrote this letter. Keep the tone warm, peaceful, non-intrusive, and deeply introspective.

Respond ONLY with the reflection prompt text, no quotes or surrounding boilerplate.`;

    const { text, modelUsed } = await generateContentWithFallback({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      systemInstruction: 'You are a mindful journaling companion crafting gentle introspective questions.',
      temperature: 0.7,
    });

    res.json({
      reflectionPrompt: text.trim().replace(/^["']|["']$/g, ''),
      modelUsed,
    });
  } catch (error: any) {
    console.error('Error in /api/letter/unlock-reflection:', error);
    res.json({
      reflectionPrompt: 'As you read this note from your past self, take a gentle breath: what has shifted in your heart and world since these words were written?',
    });
  }
});

// Reverse Geocoding endpoint to convert coordinates into human-readable place tags
app.get('/api/geocode/reverse', async (req: Request, res: Response) => {
  try {
    const lat = parseFloat(req.query.lat as string);
    const lng = parseFloat(req.query.lng as string);

    if (isNaN(lat) || isNaN(lng)) {
      res.status(400).json({ error: 'Valid lat and lng query parameters required' });
      return;
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4500);
      const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}`;
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Reflect-Mindful-Journal/1.0',
          'Accept': 'application/json',
        },
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (response.ok) {
        const data: any = await response.json();
        const address = data.address || {};
        const city =
          address.city ||
          address.town ||
          address.village ||
          address.hamlet ||
          address.suburb ||
          address.municipality ||
          address.county ||
          '';
        const region = address.state || address.province || address.region || '';
        const country = address.country || '';

        let placeName = '';
        if (city && region) {
          placeName = `${city}, ${region}`;
        } else if (city && country) {
          placeName = `${city}, ${country}`;
        } else if (region && country) {
          placeName = `${region}, ${country}`;
        } else if (data.display_name) {
          placeName = data.display_name.split(',').slice(0, 2).join(',').trim();
        } else {
          const latLabel = `${Math.abs(lat).toFixed(2)}° ${lat >= 0 ? 'N' : 'S'}`;
          const lngLabel = `${Math.abs(lng).toFixed(2)}° ${lng >= 0 ? 'E' : 'W'}`;
          placeName = `${latLabel}, ${lngLabel}`;
        }

        res.json({
          latitude: lat,
          longitude: lng,
          city,
          region,
          country,
          placeName,
        });
        return;
      }
    } catch (osmErr) {
      console.warn('Reverse geocode service warning:', osmErr);
    }

    // Clean coordinate fallback
    const latLabel = `${Math.abs(lat).toFixed(2)}° ${lat >= 0 ? 'N' : 'S'}`;
    const lngLabel = `${Math.abs(lng).toFixed(2)}° ${lng >= 0 ? 'E' : 'W'}`;
    res.json({
      latitude: lat,
      longitude: lng,
      placeName: `${latLabel}, ${lngLabel}`,
    });
  } catch (err: any) {
    console.error('Error in /api/geocode/reverse:', err);
    res.status(500).json({ error: 'Geocode reverse lookup failed' });
  }
});

// Dynamic AI Prompt Generator for varied, creative reflection ideas
app.post('/api/prompts/generate', async (req: Request, res: Response) => {
  let isFuture = false;
  try {
    const { type, theme, recentCategories, recentSummaries } = req.body || {};
    isFuture = type === 'future' || type === 'future_letter';

    const contextAddition = Array.isArray(recentCategories) && recentCategories.length > 0
      ? `User's recent reflection themes: ${recentCategories.join(', ')}. Gently condition one or more prompts to either resonate with or offer a peaceful counterbalance to these themes.`
      : '';

    const prompt = isFuture
      ? `You are an imaginative, emotionally perceptive creative writing mentor and mindfulness guide.
The user wants 3 brand-new, original, deeply evocative prompt ideas for writing a letter to their future self ("Dear Future Me").
Requested Theme / Tone: "${theme || 'Vivid, unconventional, introspective'}".
${contextAddition}
Avoid generic, tired questions like "Where do you see yourself in 5 years?" or "Did you buy a house?".
Instead, offer poetic, tender, or thought-provoking angles:
- Sensory time capsules (textures, songs on repeat, exact taste of morning coffee)
- Emotional forgiveness and letting go of invisible burdens
- Questions about learning to soften one's inner critic
- Secret creative aspirations and quiet leaps
- Values anchors to never compromise

Respond ONLY with valid JSON in this exact structure:
{
  "prompts": [
    "...",
    "...",
    "..."
  ]
}`
      : `You are an imaginative, emotionally perceptive mindfulness companion and journal guide.
The user wants 3 brand-new, deeply thoughtful, refreshing, and unconventional journaling prompts.
Requested Theme / Tone: "${theme || 'Original, honest, thought-provoking'}".
${contextAddition}
Avoid repetitive, boring clichés like "What are 3 things you are grateful for today?" or "How was your day?".
Instead, offer prompts that spark genuine psychological insight, bodily grounding, or naming unspoken feelings:
- Paradoxes and conflicting emotions felt at the same time
- Things being outgrown or beliefs quietly shifting
- Subtle, unsung moments of grace or ordinary wonder
- Whispers to one's younger self or gentle self-protection
- Conversations carried internally that were never spoken

Respond ONLY with valid JSON in this exact structure:
{
  "prompts": [
    "...",
    "...",
    "..."
  ]
}`;

    const { text, modelUsed } = await generateContentWithFallback({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      systemInstruction: 'You are an original, empathetic mindfulness companion crafting novel journaling questions. Always return strict JSON.',
      temperature: 0.95,
    });

    let prompts: string[] = [];
    try {
      const cleanJson = text.replace(/```json/gi, '').replace(/```/g, '').trim();
      const parsed = JSON.parse(cleanJson);
      if (Array.isArray(parsed.prompts) && parsed.prompts.length > 0) {
        prompts = parsed.prompts
          .map((p: any) => String(p).trim().replace(/^["']|["']$/g, ''))
          .filter((p: string) => p.length > 10);
      }
    } catch {
      const lines = text
        .split('\n')
        .map((l) => l.replace(/^[-*0-9.)"\s]+|["\s]+$/g, '').trim())
        .filter((l) => l.length > 15);
      prompts = lines.slice(0, 3);
    }

    res.json({
      prompts: prompts.slice(0, 3),
      modelUsed,
    });
  } catch (err: any) {
    console.log('[Prompts API] Curated prompt fallback active:', err?.message);
    const fallbackPrompts = isFuture
      ? [
          'What is one quiet truth you hope your future self has never forgotten?',
          'Describe the exact sounds, scents, and textures of your life in this very moment.',
          'What is something you are navigating today that you hope will feel resolved or softened?',
        ]
      : [
          'What is a quiet feeling you noticed today that you have not put into words yet?',
          'Where did you feel tension or ease in your body today, and what was it trying to tell you?',
          'What is one act of patience or kindness you can offer yourself before tomorrow begins?',
        ];
    res.json({
      prompts: fallbackPrompts,
      modelUsed: 'curated-fallback',
      isFallback: true,
    });
  }
});

// Constellation real lore endpoint (Trace the Sky)
app.post('/api/constellation/lore', async (req: Request, res: Response) => {
  try {
    const { name, commonName, notableStars = [], season = '' } = req.body || {};
    if (!name) {
      res.status(400).json({ error: 'Constellation name is required' });
      return;
    }

    const prompt = `You are a quiet, warm celestial guide and astronomer.
The user has just completed tracing the real constellation: ${name}${commonName ? ` (${commonName})` : ''}.
${notableStars && notableStars.length > 0 ? `Notable stars in this pattern include: ${notableStars.join(', ')}.` : ''}
${season ? `Visibility in the sky: ${season}.` : ''}

In the app's warm, serene, non-clinical voice:
1. Explain what this real celestial pattern represents and its rich cultural or mythological stories (feel free to include non-Western traditions such as Polynesian, Arabic, Chinese, Ojibwe, or Indigenous lore where accurate and relevant).
2. Mention one or two of its notable stars and when or where in the real sky it can be discovered.
3. Keep it to a short, readable 2 to 4 sentences. This is a calm moment of quiet discovery, not an encyclopedia entry.
4. Because the constellation name is real (${name}), describe ONLY this real constellation and do not invent fictional facts or fictional stars.

Respond ONLY with valid JSON in this exact structure:
{
  "lore": "The 2 to 4 sentences describing the real constellation in a warm, calm, reflective voice."
}`;

    const { text, modelUsed } = await generateContentWithFallback({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      systemInstruction: 'You are a warm, contemplative celestial guide. You describe real astronomical constellations accurately and peacefully. Always return strict JSON.',
      temperature: 0.6,
    });

    let lore = '';
    try {
      const cleanJson = text.replace(/```json/gi, '').replace(/```/g, '').trim();
      const parsed = JSON.parse(cleanJson);
      if (parsed.lore && typeof parsed.lore === 'string') {
        lore = parsed.lore.trim();
      }
    } catch {
      lore = text.trim();
    }

    res.json({ lore: lore || null, modelUsed });
  } catch (err: any) {
    console.log('[Constellation Lore API] Fallback active:', err?.message);
    res.json({
      lore: null,
      modelUsed: 'handwritten-fallback',
      isFallback: true,
    });
  }
});

// Constellation poetic naming endpoint
app.post('/api/constellation/name', async (req: Request, res: Response) => {
  try {
    const { starCount = 5, lineCount = 4, shapeDescription = '' } = req.body || {};

    const prompt = `You are a quiet, poetic astronomer and mindfulness guide.
A person just drew a custom constellation in their quiet night sky.
Details:
- Number of stars: ${starCount}
- Number of connecting threads: ${lineCount}
${shapeDescription ? `- Shape characteristics: ${shapeDescription}` : ''}

Invent a short, evocative, non-clichéd constellation name (2-4 words, like "The Solitary Sail", "The Weaver's Knot", "The River of Breaths", "The Lantern Bearer", "The Quiet Anchor", "The Mountain Hearth").
Also provide a single poetic, grounding line about it (1 sentence, warm, meditative, peaceful).

Respond ONLY with valid JSON in this exact structure:
{
  "name": "The Evocative Name",
  "poeticLine": "A single sentence that feels comforting and poetic."
}`;

    const { text, modelUsed } = await generateContentWithFallback({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      systemInstruction: 'You are a warm, poetic mindfulness companion. Always return strict JSON.',
      temperature: 0.9,
    });

    let result = {
      name: 'The Quiet Anchor',
      poeticLine: 'A reminder that stillness is not the absence of life, but the quiet center where it gathers.',
    };

    try {
      const cleanJson = text.replace(/```json/gi, '').replace(/```/g, '').trim();
      const parsed = JSON.parse(cleanJson);
      if (parsed.name && typeof parsed.name === 'string') result.name = parsed.name.trim();
      if (parsed.poeticLine && typeof parsed.poeticLine === 'string') result.poeticLine = parsed.poeticLine.trim();
    } catch {
      // Keep defaults
    }

    res.json({ ...result, modelUsed });
  } catch (err: any) {
    console.log('[Constellation API] Poetic fallback active:', err?.message);
    const poeticFallbacks = [
      {
        name: 'The Quiet Anchor',
        poeticLine: 'A reminder that stillness is not the absence of life, but the quiet center where it gathers.',
      },
      {
        name: 'The Lantern Bearer',
        poeticLine: 'Carrying just enough gentle warmth to illuminate the next step into dusk.',
      },
      {
        name: 'The River of Breaths',
        poeticLine: 'Slow currents woven through dark water, finding patience in the natural bends.',
      },
      {
        name: 'The Solitary Sail',
        poeticLine: 'Drifting between quiet horizons, peaceful in the presence of gentle wind.',
      },
      {
        name: 'The Weaver’s Knot',
        poeticLine: 'Holding together thoughts that felt scattered until you traced the line.',
      },
      {
        name: 'The Meadow’s Edge',
        poeticLine: 'Where the noise of the day softens into the cricket song of night.',
      },
    ];
    const picked = poeticFallbacks[Math.floor(Math.random() * poeticFallbacks.length)];
    res.json({ ...picked, modelUsed: 'poetic-fallback', isFallback: true });
  }
});

// Weekly Retrospective Digest generation endpoint
app.post('/api/digest/generate', async (req: Request, res: Response) => {
  try {
    const body = req.body && typeof req.body === 'object' ? req.body : {};
    const entries = Array.isArray(body.entries) ? body.entries : [];

    if (entries.length === 0) {
      res.status(400).json({ error: 'Entries array is required to generate a weekly retrospective.' });
      return;
    }

    // Format entries for Gemini synthesis
    const entriesOverview = entries
      .map((e: any, index: number) => {
        const dateStr = e.createdAtMillis ? new Date(e.createdAtMillis).toLocaleDateString() : `Entry #${index + 1}`;
        const cat = e.userCategory || e.aiCategory || 'Reflection';
        const sum = e.summary || 'Journal reflection';
        const msgSample = Array.isArray(e.messages)
          ? e.messages
              .filter((m: any) => m.role === 'user')
              .map((m: any) => m.text)
              .slice(0, 3)
              .join(' | ')
          : '';
        return `[${dateStr}] Category: ${cat}\nSummary: ${sum}\nUser Snippets: ${msgSample.slice(0, 200)}`;
      })
      .join('\n---\n');

    const prompt = `You are Reflect's retrospective companion. Analyze this collection of personal journal entries from the past week (${entries.length} entries in total):

${entriesOverview}

Your goal is to synthesize these entries into a thoughtful, structured weekly retrospective digest.

Tone & Style Principles:
- Warm, compassionate, introspective, and non-clinical.
- Avoid therapist clichés or clinical jargon.
- Highlight genuine patterns, emotional arcs, and quiet victories.

Tasks:
1. "title": A poetic, gentle title for this week's retrospective (e.g. "A Week of Grounding & Gentle Momentum", "Untangling Pressure & Finding Clarity").
2. "themes": A list of 2 to 4 recurring themes, questions, or topics that came up during the week (e.g., ["Reclaiming evening boundaries", "Navigating work transitions", "Moments of quiet gratitude"]).
3. "moodShift": A thoughtful paragraph (2-4 sentences) describing any noticeable shifts in mood, emotional balance, or category distribution compared to earlier days in the week.
4. "observations": 1 or 2 gentle, grounded observations based on patterns across the week (e.g., ["You tend to feel most grounded when writing in the morning", "Work stress peaked mid-week, followed by intentional rest"]).
5. "encouragement": One or two warm, supportive sentences offering gentle encouragement for the week ahead.

Respond ONLY with valid JSON in this exact structure, with no markdown code fences or conversational text:
{
  "title": "...",
  "themes": ["...", "..."],
  "moodShift": "...",
  "observations": ["...", "..."],
  "encouragement": "..."
}`;

    const { text, modelUsed } = await generateContentWithFallback({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      systemInstruction: 'You are an introspective AI journaling assistant specialized in mindful retrospectives. Always output strict JSON.',
      temperature: 0.7,
    });

    let digestData = {
      title: 'A Week of Thoughtful Reflection',
      themes: ['Finding balance in daily routines', 'Processing emotions with patience'],
      moodShift: 'Across this week, your reflections show a steady movement from navigating daily pressures towards intentional moments of stillness and clarity.',
      observations: ['You consistently returned to journaling during moments of transition throughout your days.'],
      encouragement: 'Carry forward the calm awareness you nurtured this week. Be gentle with your pace as each day unfolds.',
    };

    try {
      const cleanJson = text.replace(/```json/gi, '').replace(/```/g, '').trim();
      const raw = JSON.parse(cleanJson);
      if (raw.title && typeof raw.title === 'string') digestData.title = raw.title.trim();
      if (Array.isArray(raw.themes) && raw.themes.length > 0) digestData.themes = raw.themes.map((t: any) => String(t).trim());
      if (raw.moodShift && typeof raw.moodShift === 'string') digestData.moodShift = raw.moodShift.trim();
      if (Array.isArray(raw.observations) && raw.observations.length > 0) digestData.observations = raw.observations.map((o: any) => String(o).trim());
      if (raw.encouragement && typeof raw.encouragement === 'string') digestData.encouragement = raw.encouragement.trim();
    } catch (parseErr) {
      console.log('[Digest API] Structured digest fallback parsing.');
    }

    res.json({
      ...digestData,
      modelUsed,
    });
  } catch (error: any) {
    console.log('[Digest API] Retrospective fallback active:', error?.message);
    res.json({
      title: 'Weekly Journal Retrospective',
      themes: ['Mindful daily journaling', 'Emotional balance', 'Intentional presence'],
      moodShift: 'Across this week, your reflections demonstrate quiet dedication to self-awareness and mindful stillness.',
      observations: ['You consistently carved out moments for yourself amidst the rhythm of your week.'],
      encouragement: 'Take pride in the space you created for yourself. Carry this gentle clarity into the days ahead.',
      modelUsed: 'digest-fallback',
      isFallback: true,
    });
  }
});

// Vite & Static Asset Handling
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Reflect server running at http://0.0.0.0:${PORT}`);
  });
}

startServer();
